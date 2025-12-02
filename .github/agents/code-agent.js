#!/usr/bin/env node

/**
 * Code Agent - Generate and apply code changes based on implementation plan
 * 
 * Input: FixPlan from planner agent
 * Output: Commit[] with diffs, validation results, commit SHAs
 * 
 * Contract: specs/001-github-auto-fix/contracts/code-agent.md
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { getGitHubClient } from './shared/github-client.js';
import { getAIClient } from './shared/ai-client.js';
import { AutoFixError } from './shared/error-handler.js';
import * as gitOps from './shared/git-operations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Environment variables
const ISSUE_NUMBER = process.env.ISSUE_NUMBER;
const FIX_PLAN_PATH = process.env.FIX_PLAN_PATH || './fix-plan.json';
const OUTPUT_PATH = process.env.OUTPUT_PATH || './commit-result.json';
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '120000', 10);
const DEFAULT_BRANCH = process.env.DEFAULT_BRANCH || 'main';

/**
 * Main entry point
 */
async function main() {
  const startTime = Date.now();
  console.log(`[Code Agent] Starting for issue #${ISSUE_NUMBER}`);

  // Resolve absolute output path BEFORE any chdir (in agents directory)
  const outputAbsPath = join(__dirname, OUTPUT_PATH);

  try {
    // Set timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new AutoFixError('TIMEOUT', 'Code agent timeout exceeded 120s')), TIMEOUT_MS);
    });

    // Run code generation with timeout
    const resultPromise = runCodeGeneration();
    const result = await Promise.race([resultPromise, timeoutPromise]);

    // Write output to agents directory
    writeFileSync(outputAbsPath, JSON.stringify(result, null, 2));

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Code Agent] ✓ Completed in ${duration}s`);
    process.exit(0);

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[Code Agent] ✗ Failed after ${duration}s:`, error.message);

    // Attempt rollback
    try {
      await rollback();
    } catch (rollbackError) {
      console.error('[Code Agent] Rollback failed:', rollbackError.message);
    }

    // Write error output to agents directory
    const errorResult = {
      success: false,
      error: {
        code: error.code || 'CODE_GENERATION_FAILED',
        message: error.message,
        details: error.details || {},
        recoverable: false
      }
    };
    writeFileSync(outputAbsPath, JSON.stringify(errorResult, null, 2));
    process.exit(1);
  }
}

/**
 * Run code generation and validation
 */
async function runCodeGeneration() {
  // Capture agents dir & compute repo root; adjust working directory for git operations
  const agentsDir = __dirname; // .github/agents
  const repoRoot = join(__dirname, '..', '..');

  // Resolve absolute paths for inputs before chdir
  const fixPlanAbs = join(agentsDir, FIX_PLAN_PATH);
  const outputAbs = join(agentsDir, OUTPUT_PATH);

  // Load fix plan (from agents dir)
  const fixPlanResult = JSON.parse(readFileSync(fixPlanAbs, 'utf8'));

  if (!fixPlanResult.success) {
    throw new AutoFixError('INVALID_INPUT', 'Fix plan indicates failure');
  }

  const fixPlan = fixPlanResult.data;

  console.log(`[Code Agent] Branch: ${fixPlan.branch_name}`);
  console.log(`[Code Agent] Files to modify: ${fixPlan.file_changes.length}`);

  // Graceful early exit if no file changes (nothing to do)
  if (fixPlan.file_changes.length === 0) {
    console.log('[Code Agent] No file_changes provided; creating no-op result');
    return {
      success: true,
      data: [{
        issue_number: fixPlan.issue_number,
        message: 'No changes required',
        diff: '',
        files_changed: [],
        timestamp: new Date().toISOString(),
        validation_results: [],
        sha: null
      }]
    };
  }

  // Change to repo root for all git operations & patch application
  try {
    process.chdir(repoRoot);
    console.log('[Code Agent] Changed working directory to repo root');
  } catch (e) {
    throw new AutoFixError('CHDIR_FAILED', `Failed to change directory to repo root: ${e.message}`);
  }

  // Get GitHub client
  const github = getGitHubClient();
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

  // Fetch issue details
  const { data: issue } = await github.rest.issues.get({
    owner,
    repo,
    issue_number: parseInt(ISSUE_NUMBER, 10)
  });

  // Security pre-check
  securityPreCheck(fixPlan.file_changes);

  // Fetch repository style config
  const styleConfig = await fetchStyleConfig(github, owner, repo);

  // Create or checkout branch (idempotent)
  await createBranch(fixPlan.branch_name);

  // Generate and apply changes for each file
  const allDiffs = [];
  for (const fileChange of fixPlan.file_changes) {
    console.log(`[Code Agent] Processing ${fileChange.path} (${fileChange.operation})`);

    // Fetch current file content (Baseline from default branch)
    const currentContent = await fetchFileContent(github, owner, repo, fileChange.path, DEFAULT_BRANCH);

    // Fallback: simple DOCS typo correction for README.md when issue mentions 'typo'
    const isDocsTypo = fixPlan.classification === 'DOCS' && /typo/i.test(issue.title) && fileChange.path === 'README.md';
    let diff;
    if (isDocsTypo) {
      const updatedContent = applyDocsTypoReplacements(currentContent);
      if (updatedContent !== currentContent) {
        // Write updated content directly
        writeFileSync(fileChange.path, updatedContent, 'utf8');
        diff = buildFullFileDiff(fileChange.path, currentContent, updatedContent);
        console.log('[Code Agent] ✓ Applied deterministic README.md typo fix without AI');
      } else {
        console.log('[Code Agent] No typo replacements performed; falling back to AI diff');
        diff = await generateDiff(fileChange, currentContent, issue, fixPlan, styleConfig);
        await applyDiff(diff, fileChange.path);
      }
    } else {
      // Generate diff using AI
      diff = await generateDiff(fileChange, currentContent, issue, fixPlan, styleConfig);
      await applyDiff(diff, fileChange.path);
    }

    allDiffs.push({ path: fileChange.path, diff });
  }

  // Run validation commands (may be empty)
  const validationResults = await runValidation(fixPlan.validation_commands || []);
  if ((fixPlan.validation_commands || []).length === 0) {
    console.log('[Code Agent] No validation commands to run');
  } else {
    console.log('[Code Agent] ✓ All validations passed');
  }

  // Generate conventional commit message
  const commitMessage = generateCommitMessage(issue, fixPlan);

  // Commit changes
  const commitSha = await commitChanges(fixPlan.file_changes.map(fc => fc.path), commitMessage);
  console.log(`[Code Agent] Commit: ${commitSha}`);

  // Push branch
  await pushBranch(fixPlan.branch_name);
  console.log(`[Code Agent] ✓ Pushed ${fixPlan.branch_name}`);

  // Build commit result
  const commit = {
    issue_number: issue.number,
    message: commitMessage,
    diff: allDiffs.map(d => d.diff).join('\n\n'),
    files_changed: fixPlan.file_changes.map(fc => fc.path),
    timestamp: new Date().toISOString(),
    validation_results: validationResults,
    sha: commitSha
  };

  return {
    success: true,
    data: [commit]
  };
}

/**
 * Security pre-check to block sensitive file modifications
 */
function securityPreCheck(fileChanges) {
  const BLOCKED_PATTERNS = [
    /^\.env/,
    /\.env$/,
    /config\/secrets\//,
    /\.pem$/,
    /\.key$/,
    /deployment\//,
    /^\.github\/workflows\//,
    /docker-compose/,
    /kubernetes\//
  ];

  for (const change of fileChanges) {
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(change.path)) {
        throw new AutoFixError(
          'SECURITY_VIOLATION',
          `Attempted to modify blocked file: ${change.path}`,
          { path: change.path, pattern: pattern.source }
        );
      }
    }
  }
}

/**
 * Fetch style configuration from repository
 */
async function fetchStyleConfig(github, owner, repo) {
  const defaults = {
    indent_style: 'space',
    indent_size: 2,
    end_of_line: 'lf',
    insert_final_newline: true
  };

  try {
    // Try to fetch .editorconfig
    const { data: editorconfig } = await github.rest.repos.getContent({
      owner,
      repo,
      path: '.editorconfig'
    });

    const content = Buffer.from(editorconfig.content, 'base64').toString('utf8');

    // Parse editorconfig (basic parsing)
    if (content.includes('indent_style = tab')) defaults.indent_style = 'tab';
    const sizeMatch = content.match(/indent_size = (\d+)/);
    if (sizeMatch) defaults.indent_size = parseInt(sizeMatch[1], 10);

  } catch (error) {
    // .editorconfig not found, use defaults
    console.log('[Code Agent] Using default style config');
  }

  return defaults;
}

/**
 * Create or checkout branch (idempotent)
 */
async function createBranch(branchName) {
  try {
    // Try to checkout existing branch first
    try {
      gitOps.checkoutBranch(process.cwd(), branchName);
      console.log(`[Code Agent] Branch ${branchName} exists, checked out`);
    } catch (checkoutError) {
      // Branch doesn't exist, create it
      console.log(`[Code Agent] Creating branch ${branchName}`);
      gitOps.createBranch(process.cwd(), branchName, DEFAULT_BRANCH);
    }
  } catch (error) {
    throw new AutoFixError('GIT_BRANCH_FAILED', `Failed to create/checkout branch: ${error.message}`);
  }
}

/**
 * Fetch file content from repository
 */
async function fetchFileContent(github, owner, repo, path, ref) {
  try {
    const { data: file } = await github.rest.repos.getContent({
      owner,
      repo,
      path,
      ref
    });

    if (file.type !== 'file') {
      throw new Error(`Path ${path} is not a file`);
    }

    return Buffer.from(file.content, 'base64').toString('utf8');
  } catch (error) {
    if (error.status === 404) {
      // File doesn't exist (CREATE operation)
      return '';
    }
    throw new AutoFixError('FILE_FETCH_FAILED', `Failed to fetch ${path}: ${error.message}`);
  }
}

/**
 * Generate unified diff using AI
 */
async function generateDiff(fileChange, currentContent, issue, fixPlan, styleConfig) {
  const ai = getAIClient();

  const prompt = `You are an expert code editor. Generate a minimal unified diff to implement the requested change.

CONTEXT:
- Issue #${issue.number}: ${issue.title}
- Details: ${issue.body || 'No additional details'}
- File: ${fileChange.path}
- Operation: ${fileChange.operation}
- Change Summary: ${fileChange.change_summary}
${fileChange.line_range ? `- Target Lines: ${fileChange.line_range[0]}-${fileChange.line_range[1]}` : ''}

CURRENT CONTENT:
\`\`\`
${currentContent}
\`\`\`

STYLE REQUIREMENTS:
- Indentation: ${styleConfig.indent_style === 'space' ? `${styleConfig.indent_size} spaces` : 'tabs'}
- Line endings: ${styleConfig.end_of_line.toUpperCase()}
- Final newline: ${styleConfig.insert_final_newline ? 'required' : 'optional'}

CONSTRAINTS:
1. Make ONLY the minimal change to fix the issue
2. Preserve ALL existing formatting, comments, and whitespace
3. Do NOT refactor or "improve" unrelated code
4. Output ONLY the unified diff (no explanations, no markdown blocks)
5. Diff must be directly applicable with 'git apply'
6. Do NOT include code markers like "...existing code..." in the diff

UNIFIED DIFF FORMAT:
--- a/${fileChange.path}
+++ b/${fileChange.path}
@@ -<old_start>,<old_count> +<new_start>,<new_count> @@
 <context lines>
-<removed line>
+<added line>
 <context lines>

OUTPUT (raw diff only, no formatting):`;

  const response = await ai.generateText({
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 3000
  });

  // Clean up response (remove markdown code blocks if present)
  let diff = response.trim();
  if (diff.startsWith('```')) {
    diff = diff.replace(/```diff?\n?/g, '').replace(/```\s*$/g, '').trim();
  }

  // Validate diff format
  if (!diff.startsWith('---') || !diff.includes('+++')) {
    throw new AutoFixError('INVALID_DIFF', 'Generated diff is not in valid unified diff format', { diff });
  }

  return diff;
}

/**
 * Apply unified diff to working directory
 */
async function applyDiff(diff, filePath) {
  try {
    // Write diff to temp file
    const patchFile = `/tmp/fix-${Date.now()}.patch`;
    writeFileSync(patchFile, diff);

    // Check if patch can be applied
    try {
      execSync(`git apply --check "${patchFile}"`, { stdio: 'pipe' });
    } catch (checkError) {
      throw new AutoFixError('INVALID_PATCH', `Patch check failed for ${filePath}`, {
        stderr: checkError.stderr?.toString()
      });
    }

    // Apply patch
    execSync(`git apply "${patchFile}"`, { stdio: 'pipe' });
    console.log(`[Code Agent] ✓ Applied patch to ${filePath}`);

  } catch (error) {
    if (error.code === 'INVALID_PATCH') {
      throw error;
    }
    throw new AutoFixError('GIT_APPLY_FAILED', `Failed to apply diff: ${error.message}`);
  }
}

/**
 * Run validation commands
 */
async function runValidation(commands) {
  const results = [];

  for (const command of commands) {
    console.log(`[Code Agent] Running: ${command}`);
    const startTime = Date.now();

    try {
      const output = execSync(command, {
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 90000 // 90s timeout per command
      });

      const duration = Date.now() - startTime;
      results.push({
        command,
        exit_code: 0,
        stdout: output.slice(0, 1000), // Truncate
        stderr: '',
        duration_ms: duration
      });

      console.log(`[Code Agent] ✓ ${command} passed (${duration}ms)`);

    } catch (error) {
      const duration = Date.now() - startTime;
      const result = {
        command,
        exit_code: error.status || 1,
        stdout: error.stdout?.slice(0, 1000) || '',
        stderr: error.stderr?.slice(0, 1000) || error.message,
        duration_ms: duration
      };

      results.push(result);

      // Validation failed - trigger rollback
      throw new AutoFixError('VALIDATION_FAILED', `Validation command failed: ${command}`, {
        validation_results: results
      });
    }
  }

  return results;
}

/**
 * Generate conventional commit message
 */
function generateCommitMessage(issue, fixPlan) {
  const classificationMap = {
    'BUG': 'fix',
    'FEATURE': 'feat',
    'DOCS': 'docs',
    'CHORE': 'chore',
    'OTHER': 'fix'
  };

  // Determine scope from affected files
  const firstFile = fixPlan.file_changes[0]?.path || '';
  const scope = firstFile.split('/')[0] || 'general';

  // Get type from classification
  const type = classificationMap[fixPlan.classification] || 'fix';

  // Create description (first 72 chars of title)
  const description = issue.title.slice(0, 72).toLowerCase();

  return `${type}(${scope}): ${description}\n\nFixes #${issue.number}`;
}

/**
 * Commit changes to git
 */
async function commitChanges(filePaths, message) {
  try {
    // Stage files
    gitOps.stageFiles(process.cwd(), filePaths);

    // Commit with message
    const sha = gitOps.createCommit(process.cwd(), message);

    return sha;
  } catch (error) {
    throw new AutoFixError('GIT_COMMIT_FAILED', `Failed to commit: ${error.message}`);
  }
}

/**
 * Push branch to remote
 */
async function pushBranch(branchName) {
  try {
    gitOps.pushBranch(process.cwd(), branchName);
  } catch (error) {
    throw new AutoFixError('GIT_PUSH_FAILED', `Failed to push branch: ${error.message}`, {
      branch: branchName
    });
  }
}

/**
 * Rollback changes on failure
 */
async function rollback() {
  console.log('[Code Agent] Rolling back changes...');

  try {
    // Reset working directory
    execSync('git reset --hard HEAD', { stdio: 'pipe' });

    // Switch back to default branch
    execSync(`git checkout ${DEFAULT_BRANCH}`, { stdio: 'pipe' });

    console.log('[Code Agent] ✓ Rollback complete');
  } catch (error) {
    console.error('[Code Agent] Rollback failed:', error.message);
  }
}

// Utility: apply common doc typos replacements
function applyDocsTypoReplacements(content) {
  const patterns = [
    [/\bteh\b/g, 'the'],
    [/\brecieve\b/g, 'receive'],
    [/\boccured\b/g, 'occurred'],
    [/\bseperate\b/g, 'separate'],
    [/\bdefinately\b/g, 'definitely']
  ];
  let updated = content;
  for (const [regex, replacement] of patterns) {
    updated = updated.replace(regex, replacement);
  }
  return updated;
}

// Utility: build a unified diff for full-file replacement (minimal heuristic)
function buildFullFileDiff(filePath, oldContent, newContent) {
  const oldLines = oldContent.split(/\n/);
  const newLines = newContent.split(/\n/);
  const oldCount = oldLines.length;
  const newCount = newLines.length;
  const header = `--- a/${filePath}\n+++ b/${filePath}`;
  const hunkHeader = `@@ -1,${oldCount} +1,${newCount} @@`;
  const bodyLines = [];
  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    if (oldLine === newLine) {
      bodyLines.push(` ${oldLine !== undefined ? oldLine : ''}`);
    } else {
      if (oldLine !== undefined) bodyLines.push(`-${oldLine}`);
      if (newLine !== undefined) bodyLines.push(`+${newLine}`);
    }
  }
  return `${header}\n${hunkHeader}\n${bodyLines.join('\n')}`;
}

// Run main function
main().catch(error => {
  console.error('[Code Agent] Unhandled error:', error);
  process.exit(1);
});
