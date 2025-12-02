#!/usr/bin/env node

/**
 * Auto-Fix Agent - Simplified architecture combining planning and code generation
 * 
 * Direct approach: Issue → AI (generate fix) → Apply changes → Commit
 * 
 * Input: TriageResult from triage agent
 * Output: Commit[] with diffs, validation results, commit SHAs
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { getGitHubClient } from './shared/github-client.js';
import { getAIClient } from './shared/ai-client.js';
import { AutoFixError } from './shared/error-handler.js';
import * as gitOps from './shared/git-operations.js';
import { checkSecurityFilePath, checkRiskyChangeTypes } from './shared/security-constraints.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Environment variables
const ISSUE_NUMBER = process.env.ISSUE_NUMBER;
const TRIAGE_RESULT_PATH = process.env.TRIAGE_RESULT_PATH || './triage-result.json';
const OUTPUT_PATH = process.env.OUTPUT_PATH || './commit-result.json';
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '90000', 10);
const DEFAULT_BRANCH = process.env.DEFAULT_BRANCH || 'main';

/**
 * Main entry point
 */
async function main() {
  const startTime = Date.now();
  console.log(`[Auto-Fix] Starting for issue #${ISSUE_NUMBER}`);

  // Resolve absolute output path BEFORE any chdir
  const outputAbsPath = join(__dirname, OUTPUT_PATH);

  try {
    // Set timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new AutoFixError('TIMEOUT', 'Auto-fix agent timeout exceeded 90s')), TIMEOUT_MS);
    });

    // Run auto-fix with timeout
    const resultPromise = runAutoFix();
    const result = await Promise.race([resultPromise, timeoutPromise]);

    // Write output
    writeFileSync(outputAbsPath, JSON.stringify(result, null, 2));

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Auto-Fix] ✓ Completed in ${duration}s`);
    process.exit(0);

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[Auto-Fix] ✗ Failed after ${duration}s:`, error.message);

    // Attempt rollback
    try {
      await rollback();
    } catch (rollbackError) {
      console.error('[Auto-Fix] Rollback failed:', rollbackError.message);
    }

    // Try to post error comment to issue
    try {
      await postErrorComment(error);
    } catch (commentError) {
      console.error('[Auto-Fix] Failed to post error comment:', commentError.message);
    }

    // Write error output
    const errorResult = {
      success: false,
      error: {
        code: error.code || 'AUTO_FIX_FAILED',
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
 * Run auto-fix logic (simplified: direct AI prompt → apply changes)
 */
async function runAutoFix() {
  const agentsDir = __dirname;
  const repoRoot = join(__dirname, '..', '..');

  // Resolve absolute paths before chdir
  const triageResultAbs = join(agentsDir, TRIAGE_RESULT_PATH);

  // Load triage result
  const triageResult = JSON.parse(readFileSync(triageResultAbs, 'utf8'));

  if (!triageResult.success) {
    throw new AutoFixError('INVALID_INPUT', 'Triage result indicates failure');
  }

  const triage = triageResult.data;

  // Validate auto-fix decision
  if (triage.autoFixDecision !== 'AUTO_FIX') {
    throw new AutoFixError('NOT_AUTO_FIX', `Auto-fix not approved: ${triage.autoFixDecision}`);
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

  console.log(`[Auto-Fix] Processing: ${issue.title}`);
  console.log(`[Auto-Fix] Classification: ${triage.classification}, Risk: ${triage.risk}`);

  // Security pre-check
  securityPreCheck(triage.affectedFiles || [], issue.title, issue.body || '');

  // Change to repo root for git operations
  try {
    process.chdir(repoRoot);
    console.log('[Auto-Fix] Changed working directory to repo root');
  } catch (e) {
    throw new AutoFixError('CHDIR_FAILED', `Failed to change directory: ${e.message}`);
  }

  // Generate branch name
  const branchName = generateBranchName(issue.number, triage.classification, issue.title);
  console.log(`[Auto-Fix] Branch: ${branchName}`);

  // Create or checkout branch
  await createBranch(branchName);

  // Fetch repository conventions
  const conventions = await loadConventions(github, owner, repo);

  // SIMPLIFIED: Direct AI prompt with issue context → get code changes
  const { fileChanges, commitMessage } = await generateFixDirectly(
    issue,
    triage,
    conventions,
    github,
    owner,
    repo
  );

  console.log(`[Auto-Fix] Generated ${fileChanges.length} file changes`);

  // Apply changes to working directory
  for (const fileChange of fileChanges) {
    console.log(`[Auto-Fix] Applying: ${fileChange.path}`);
    await applyFileChange(fileChange);
  }

  // Run validation commands
  const validationCommands = selectValidationCommands(triage.risk, triage.affectedFiles || [], conventions);
  const validationResults = await runValidation(validationCommands);

  if (validationCommands.length === 0) {
    console.log('[Auto-Fix] No validation commands to run');
  } else {
    console.log('[Auto-Fix] ✓ All validations passed');
  }

  // Commit changes
  const commitSha = await commitChanges(
    fileChanges.map(fc => fc.path),
    commitMessage
  );
  console.log(`[Auto-Fix] Commit: ${commitSha}`);

  // Push branch
  await pushBranch(branchName);
  console.log(`[Auto-Fix] ✓ Pushed ${branchName}`);

  // Build result
  const commit = {
    issue_number: issue.number,
    branch_name: branchName,
    message: commitMessage,
    files_changed: fileChanges.map(fc => fc.path),
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
 * Generate fix directly using AI (simplified approach)
 * Single AI call with full context → get all code changes
 */
async function generateFixDirectly(issue, triage, conventions, github, owner, repo) {
  const ai = getAIClient();

  // Fetch project context first (package.json, key files)
  const projectContext = await fetchProjectContext(github, owner, repo, DEFAULT_BRANCH);
  console.log(`[Auto-Fix] Project: ${projectContext.framework} (${projectContext.language})`);

  // Determine files to fetch based on issue and project structure
  let filesToFetch = triage.affectedFiles || [];
  
  // If no files specified, try to infer from issue and project context
  if (filesToFetch.length === 0) {
    filesToFetch = await inferAffectedFiles(issue, projectContext, github, owner, repo);
    console.log(`[Auto-Fix] Inferred files: ${filesToFetch.join(', ')}`);
  }

  // Fetch affected file contents
  const fileContents = await fetchAffectedFiles(
    github,
    owner,
    repo,
    filesToFetch,
    DEFAULT_BRANCH
  );

  // Build comprehensive prompt WITH project context
  const prompt = buildDirectFixPrompt(issue, triage, conventions, fileContents, projectContext);

  console.log('[Auto-Fix] Sending direct fix request to AI...');

  // Get AI response
  const response = await ai.generateText({
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 4000
  });

  // Parse response JSON
  let fixResult;
  try {
    let jsonText = response.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\s*$/g, '').trim();
    }
    fixResult = JSON.parse(jsonText);
  } catch (error) {
    throw new AutoFixError('INVALID_AI_OUTPUT', 'Failed to parse AI response JSON', { response });
  }

  // Validate response structure
  if (!Array.isArray(fixResult.file_changes) || fixResult.file_changes.length === 0) {
    throw new AutoFixError('INVALID_AI_OUTPUT', 'AI response missing file_changes array');
  }

  if (!fixResult.commit_message) {
    throw new AutoFixError('INVALID_AI_OUTPUT', 'AI response missing commit_message');
  }

  console.log(`[Auto-Fix] AI generated fix for ${fixResult.file_changes.length} files`);

  return {
    fileChanges: fixResult.file_changes,
    commitMessage: fixResult.commit_message
  };
}

/**
 * Build comprehensive prompt for direct fix generation
 */
function buildDirectFixPrompt(issue, triage, conventions, fileContents, projectContext) {
  const fileContexts = fileContents.map(fc => {
    return `### File: ${fc.path}\n\`\`\`${getFileExtension(fc.path)}\n${fc.content}\n\`\`\``;
  }).join('\n\n');

  // Build project structure summary
  const structureSummary = projectContext.structure
    ? `\n## Project Structure\n\`\`\`\n${projectContext.structure}\n\`\`\``
    : '';

  return `You are an expert software engineer. Fix this GitHub issue by modifying ONLY the existing files in this project.

## CRITICAL: Project Context
- **Framework**: ${projectContext.framework}
- **Language**: ${projectContext.language}
- **Project Type**: ${projectContext.projectType}
${projectContext.framework === 'Vue.js' ? `
**Vue.js Specific**:
- Use Vue 3 Composition API with <script setup> syntax
- Use TypeScript for .vue and .ts files
- Components are in src/components/
- Composables are in src/composables/
- DO NOT create React components (no useState, useEffect, jsx)
- DO NOT create new files unless absolutely necessary
- ONLY modify existing files that are provided below
` : ''}
${projectContext.framework === 'React' ? `
**React Specific**:
- Use functional components with hooks
- DO NOT create Vue components
` : ''}
${structureSummary}

## Issue Context
- **Issue #${issue.number}**: ${issue.title}
- **Details**: ${issue.body || 'No additional details provided'}
- **Classification**: ${triage.classification}
- **Risk Level**: ${triage.risk}
- **Affected Files**: ${(triage.affectedFiles || []).join(', ') || 'See files below'}

## Current File Contents (MODIFY THESE FILES ONLY)
${fileContexts || 'ERROR: No files provided - cannot proceed'}

## Coding Standards
- Indentation: ${conventions.indent_style === 'space' ? `${conventions.indent_size} spaces` : 'tabs'}
- Line endings: ${conventions.end_of_line.toUpperCase()}
- Final newline: ${conventions.insert_final_newline ? 'required' : 'optional'}

## Requirements
1. **ONLY modify files shown above** - Do not create new files unless the fix absolutely requires it
2. **Match existing patterns** - Follow the same code style as existing files
3. **Framework consistency** - Use ${projectContext.framework} patterns (NOT other frameworks)
4. **Minimal changes** - Only fix what's needed to resolve the issue
5. **Preserve formatting** - Keep existing code style, comments, whitespace
6. **No refactoring** - Don't improve unrelated code

## Output Format (JSON only, no markdown)
{
  "file_changes": [
    {
      "path": "path/to/existing/file.ext",
      "content": "full updated file content here",
      "change_summary": "Brief description of change"
    }
  ],
  "commit_message": "type(scope): description\\n\\nFixes #${issue.number}"
}

**IMPORTANT**: 
- The path MUST be one of the files shown above (existing files)
- Include ALL lines of each file (complete content)
- Use proper escape sequences for special characters in JSON strings
- For ${projectContext.framework} project - use ${projectContext.framework} patterns only!

Generate the fix now:`;
}

/**
 * Get file extension for syntax highlighting
 */
function getFileExtension(path) {
  const ext = path.split('.').pop();
  const extMap = {
    'vue': 'vue',
    'ts': 'typescript',
    'js': 'javascript',
    'tsx': 'tsx',
    'jsx': 'jsx',
    'json': 'json',
    'md': 'markdown',
    'css': 'css',
    'scss': 'scss',
    'html': 'html'
  };
  return extMap[ext] || ext;
}

/**
 * Fetch project context (framework, language, structure)
 */
async function fetchProjectContext(github, owner, repo, ref) {
  const context = {
    framework: 'Unknown',
    language: 'Unknown',
    projectType: 'Unknown',
    structure: '',
    dependencies: {}
  };

  try {
    // Fetch package.json
    const { data: pkgFile } = await github.rest.repos.getContent({
      owner,
      repo,
      path: 'package.json',
      ref
    });

    const pkg = JSON.parse(Buffer.from(pkgFile.content, 'base64').toString('utf8'));
    context.dependencies = { ...pkg.dependencies, ...pkg.devDependencies };

    // Detect framework
    if (context.dependencies['vue'] || context.dependencies['@vue/cli-service']) {
      context.framework = 'Vue.js';
      context.projectType = context.dependencies['vite'] ? 'Vite + Vue 3' : 'Vue CLI';
    } else if (context.dependencies['react'] || context.dependencies['react-dom']) {
      context.framework = 'React';
      context.projectType = context.dependencies['next'] ? 'Next.js' : 'React';
    } else if (context.dependencies['@angular/core']) {
      context.framework = 'Angular';
      context.projectType = 'Angular';
    } else if (context.dependencies['svelte']) {
      context.framework = 'Svelte';
      context.projectType = 'Svelte';
    } else {
      context.framework = 'Node.js';
      context.projectType = 'Node.js';
    }

    // Detect language
    if (context.dependencies['typescript'] || pkg.devDependencies?.['typescript']) {
      context.language = 'TypeScript';
    } else {
      context.language = 'JavaScript';
    }

  } catch (error) {
    console.warn('[Auto-Fix] Could not fetch package.json:', error.message);
  }

  // Fetch project structure (top-level directories)
  try {
    const { data: rootContents } = await github.rest.repos.getContent({
      owner,
      repo,
      path: '',
      ref
    });

    if (Array.isArray(rootContents)) {
      const structure = rootContents
        .filter(item => item.type === 'dir' || item.name.endsWith('.json') || item.name.endsWith('.ts') || item.name.endsWith('.js'))
        .map(item => item.type === 'dir' ? `${item.name}/` : item.name)
        .slice(0, 20)
        .join('\n');
      context.structure = structure;
    }
  } catch (error) {
    console.warn('[Auto-Fix] Could not fetch project structure:', error.message);
  }

  return context;
}

/**
 * Infer affected files from issue content and project context
 */
async function inferAffectedFiles(issue, projectContext, github, owner, repo) {
  const issueText = `${issue.title} ${issue.body || ''}`.toLowerCase();
  const filesToFetch = [];

  // Keywords to file mappings for Vue.js projects
  const vueFileMappings = {
    // Form-related
    'form': ['src/components/form/FormRenderer.vue', 'src/components/form/FieldWrapper.vue', 'src/composables/useFormValidation.ts'],
    'validation': ['src/composables/useFormValidation.ts', 'src/components/form/ValidationError.vue', 'src/components/form/FieldWrapper.vue'],
    'error': ['src/components/form/ValidationError.vue', 'src/composables/useFormValidation.ts', 'src/components/form/FieldWrapper.vue'],
    'input': ['src/components/base/BaseInput.vue', 'src/components/form/FieldWrapper.vue'],
    'field': ['src/components/form/FieldWrapper.vue', 'src/components/form/FormRenderer.vue'],
    'submit': ['src/composables/useFormSubmission.ts', 'src/components/form/FormRenderer.vue'],
    
    // Component-related
    'button': ['src/components/base/BaseButton.vue'],
    'select': ['src/components/base/BaseSelect.vue'],
    'checkbox': ['src/components/base/BaseCheckbox.vue'],
    'radio': ['src/components/base/BaseRadio.vue'],
    'textarea': ['src/components/base/BaseTextarea.vue'],
    
    // Step/wizard-related
    'step': ['src/components/form/FormStep.vue', 'src/components/form/StepIndicator.vue', 'src/composables/useMultiStep.ts'],
    'multi-step': ['src/composables/useMultiStep.ts', 'src/components/form/FormStep.vue'],
    
    // Conditional-related
    'conditional': ['src/composables/useConditionalFields.ts'],
    'dependency': ['src/composables/useFieldDependency.ts'],
    
    // Demo/view-related
    'demo': ['src/views/DemoView.vue'],
    'config': ['src/components/demo/ConfigEditor.vue', 'src/components/demo/ConfigValidator.vue'],
    
    // Payload-related
    'payload': ['src/components/payload/PayloadPreview.vue', 'src/components/payload/JsonDisplay.vue'],
    'json': ['src/components/payload/JsonDisplay.vue'],
    
    // Toast/notification
    'toast': ['src/components/common/ToastNotification.vue'],
    'notification': ['src/components/common/ToastNotification.vue'],
  };

  // React file mappings (if needed)
  const reactFileMappings = {
    'form': ['src/components/Form.tsx', 'src/hooks/useForm.ts'],
    'validation': ['src/hooks/useValidation.ts'],
  };

  const fileMappings = projectContext.framework === 'Vue.js' ? vueFileMappings : 
                        projectContext.framework === 'React' ? reactFileMappings : {};

  // Check which keywords match
  for (const [keyword, files] of Object.entries(fileMappings)) {
    if (issueText.includes(keyword)) {
      for (const file of files) {
        if (!filesToFetch.includes(file)) {
          filesToFetch.push(file);
        }
      }
    }
  }

  // Validate files exist (and fetch only existing ones)
  const validFiles = [];
  for (const file of filesToFetch.slice(0, 5)) { // Limit to 5 files
    try {
      await github.rest.repos.getContent({
        owner,
        repo,
        path: file,
        ref: DEFAULT_BRANCH
      });
      validFiles.push(file);
    } catch (error) {
      // File doesn't exist, skip
    }
  }

  return validFiles;
}

/**
 * Fetch affected file contents from repository
 */
async function fetchAffectedFiles(github, owner, repo, filePaths, ref) {
  const results = [];

  for (const path of filePaths) {
    try {
      const { data: file } = await github.rest.repos.getContent({
        owner,
        repo,
        path,
        ref
      });

      if (file.type === 'file') {
        const content = Buffer.from(file.content, 'base64').toString('utf8');
        results.push({ path, content });
      }
    } catch (error) {
      if (error.status === 404) {
        // File doesn't exist (might be CREATE operation)
        results.push({ path, content: '' });
      } else {
        console.warn(`[Auto-Fix] Failed to fetch ${path}: ${error.message}`);
      }
    }
  }

  return results;
}

/**
 * Apply file change to working directory
 */
async function applyFileChange(fileChange) {
  try {
    writeFileSync(fileChange.path, fileChange.content, 'utf8');
    console.log(`[Auto-Fix] ✓ Updated ${fileChange.path}`);
  } catch (error) {
    throw new AutoFixError('FILE_WRITE_FAILED', `Failed to write ${fileChange.path}: ${error.message}`);
  }
}

/**
 * Security pre-check to block sensitive file modifications
 */
function securityPreCheck(affectedFiles, issueTitle = '', issueBody = '') {
  console.log('[Auto-Fix] Running security pre-check...');
  
  const violations = [];
  
  // Check each file against security patterns
  for (const filePath of affectedFiles) {
    const fileMatches = checkSecurityFilePath(filePath);
    if (fileMatches.length > 0) {
      violations.push({
        path: filePath,
        reason: 'Security-sensitive file path detected',
        patterns: fileMatches.map(m => m.pattern.source),
      });
    }
    
    // Additional critical patterns
    const CRITICAL_PATTERNS = [
      { pattern: /^\.env/, reason: 'Environment configuration file' },
      { pattern: /\.env$/, reason: 'Environment configuration file' },
      { pattern: /\.env\./, reason: 'Environment configuration file' },
      { pattern: /config\/secrets\//, reason: 'Secrets configuration directory' },
      { pattern: /\.pem$/, reason: 'Private key file' },
      { pattern: /\.key$/, reason: 'Private key file' },
      { pattern: /id_rsa/, reason: 'SSH private key' },
      { pattern: /^\.github\/workflows\//, reason: 'CI/CD workflow file' },
      { pattern: /deployment\//, reason: 'Deployment configuration' },
      { pattern: /docker-compose\.prod/, reason: 'Production infrastructure' },
      { pattern: /kubernetes\//, reason: 'Kubernetes configuration' },
    ];
    
    for (const { pattern, reason } of CRITICAL_PATTERNS) {
      if (pattern.test(filePath)) {
        violations.push({ path: filePath, reason, pattern: pattern.source });
      }
    }
  }
  
  // Check for risky change types
  const riskyChanges = checkRiskyChangeTypes(`${issueTitle} ${issueBody}`, affectedFiles);
  
  for (const riskyChange of riskyChanges) {
    const BLOCKED_CHANGE_TYPES = ['DATABASE_MIGRATION', 'CI_CD_PIPELINE', 'INFRASTRUCTURE_CONFIG'];
    if (BLOCKED_CHANGE_TYPES.includes(riskyChange.type)) {
      violations.push({
        path: 'multiple',
        reason: `${riskyChange.type}: ${riskyChange.reason}`,
        type: riskyChange.type,
      });
    }
  }
  
  // Block if violations found
  if (violations.length > 0) {
    console.error('[Auto-Fix] ⛔ Security violations detected:');
    violations.forEach(v => console.error(`  - ${v.path}: ${v.reason}`));
    
    throw new AutoFixError(
      'SECURITY_VIOLATION',
      `Auto-fix blocked: ${violations.length} security violation(s) detected`,
      { violations }
    );
  }
  
  console.log('[Auto-Fix] ✓ Security pre-check passed');
}

/**
 * Generate branch name
 */
function generateBranchName(issueNumber, classification, title) {
  const prefixMap = {
    'BUG': 'fix',
    'FEATURE': 'feature',
    'DOCS': 'docs',
    'CHORE': 'chore',
    'OTHER': 'fix'
  };

  const prefix = prefixMap[classification] || 'fix';
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('-')
    .substring(0, 50);

  return `${prefix}/${issueNumber}-${slug}`;
}

/**
 * Create or checkout branch (idempotent)
 */
async function createBranch(branchName) {
  try {
    try {
      gitOps.checkoutBranch(process.cwd(), branchName);
      console.log(`[Auto-Fix] Branch ${branchName} exists, checked out`);
    } catch (checkoutError) {
      console.log(`[Auto-Fix] Creating branch ${branchName}`);
      gitOps.createBranch(process.cwd(), branchName, DEFAULT_BRANCH);
    }
  } catch (error) {
    throw new AutoFixError('GIT_BRANCH_FAILED', `Failed to create/checkout branch: ${error.message}`);
  }
}

/**
 * Load project conventions
 */
async function loadConventions(github, owner, repo) {
  const defaults = {
    indent_style: 'space',
    indent_size: 2,
    end_of_line: 'lf',
    insert_final_newline: true,
    lint_command: null,
    type_check_command: null,
    build_command: null
  };

  try {
    // Try to fetch package.json for scripts
    const { data: packageJson } = await github.rest.repos.getContent({
      owner,
      repo,
      path: 'package.json'
    });

    const pkg = JSON.parse(Buffer.from(packageJson.content, 'base64').toString('utf8'));

    if (pkg.scripts) {
      if (pkg.scripts.lint) defaults.lint_command = 'npm run lint';
      if (pkg.scripts['type-check']) defaults.type_check_command = 'npm run type-check';
      if (pkg.scripts.build) defaults.build_command = 'npm run build';
    }
  } catch (error) {
    console.log('[Auto-Fix] Using default conventions');
  }

  try {
    // Try to fetch .editorconfig
    const { data: editorconfig } = await github.rest.repos.getContent({
      owner,
      repo,
      path: '.editorconfig'
    });

    const content = Buffer.from(editorconfig.content, 'base64').toString('utf8');
    if (content.includes('indent_style = tab')) defaults.indent_style = 'tab';
    const sizeMatch = content.match(/indent_size = (\d+)/);
    if (sizeMatch) defaults.indent_size = parseInt(sizeMatch[1], 10);
  } catch (error) {
    // Use defaults
  }

  return defaults;
}

/**
 * Select validation commands
 */
function selectValidationCommands(risk, affectedFiles, conventions) {
  const commands = [];

  if (conventions.lint_command) {
    commands.push(conventions.lint_command);
  }

  const needsTypeCheck = affectedFiles.some(f =>
    f.endsWith('.ts') || f.endsWith('.vue') || f.endsWith('.tsx')
  );
  if (needsTypeCheck && conventions.type_check_command) {
    commands.push(conventions.type_check_command);
  }

  if ((risk === 'MEDIUM' || risk === 'HIGH') && conventions.build_command) {
    commands.push(conventions.build_command);
  }

  // Filter out test commands (Constitution Principle V: NO TESTING)
  return commands.filter(c => !c.toLowerCase().includes('test'));
}

/**
 * Run validation commands
 */
async function runValidation(commands) {
  const results = [];

  for (const command of commands) {
    console.log(`[Auto-Fix] Running: ${command}`);
    const startTime = Date.now();

    try {
      const output = execSync(command, {
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 90000
      });

      const duration = Date.now() - startTime;
      results.push({
        command,
        exit_code: 0,
        stdout: output.slice(0, 1000),
        stderr: '',
        duration_ms: duration
      });

      console.log(`[Auto-Fix] ✓ ${command} passed (${duration}ms)`);

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

      throw new AutoFixError('VALIDATION_FAILED', `Validation command failed: ${command}`, {
        validation_results: results,
        output: error.stderr?.toString() || error.message
      });
    }
  }

  return results;
}

/**
 * Commit changes
 */
async function commitChanges(filePaths, message) {
  try {
    gitOps.stageFiles(process.cwd(), filePaths);
    const sha = gitOps.createCommit(process.cwd(), message);
    return sha;
  } catch (error) {
    throw new AutoFixError('GIT_COMMIT_FAILED', `Failed to commit: ${error.message}`);
  }
}

/**
 * Push branch
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
 * Rollback on failure
 */
async function rollback() {
  console.log('[Auto-Fix] Rolling back changes...');

  try {
    execSync('git reset --hard HEAD', { stdio: 'pipe' });
    execSync(`git checkout ${DEFAULT_BRANCH}`, { stdio: 'pipe' });
    console.log('[Auto-Fix] ✓ Rollback complete');
  } catch (error) {
    console.error('[Auto-Fix] Rollback failed:', error.message);
  }
}

/**
 * Post error comment to issue
 */
async function postErrorComment(error) {
  const github = getGitHubClient();
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  
  let errorComment = `## ❌ Auto-Fix Failed\n\n`;
  errorComment += `**Error**: ${error.message}\n\n`;
  
  if (error.code === 'VALIDATION_FAILED') {
    errorComment += `### Validation Failure\n\n`;
    errorComment += `The automated fix was generated but failed validation checks:\n\n`;
    if (error.details?.output) {
      errorComment += `\`\`\`\n${error.details.output.slice(0, 1000)}\n\`\`\`\n\n`;
    }
    errorComment += `**Next Steps**:\n`;
    errorComment += `- Review the validation error above\n`;
    errorComment += `- The changes have been rolled back\n`;
    errorComment += `- Manual fix may be required\n`;
  } else if (error.code === 'SECURITY_VIOLATION') {
    errorComment += `### Security Block\n\n`;
    errorComment += `This issue affects security-sensitive files or configurations.\n\n`;
    errorComment += `**Violations**:\n`;
    if (error.details?.violations) {
      error.details.violations.forEach(v => {
        errorComment += `- \`${v.path}\`: ${v.reason}\n`;
      });
    }
    errorComment += `\n**Action Required**: Manual review and implementation by maintainer.\n`;
  } else {
    errorComment += `**Error Code**: \`${error.code || 'UNKNOWN'}\`\n\n`;
    errorComment += `The automation system encountered an error and has rolled back any changes.\n\n`;
    errorComment += `A maintainer will need to investigate this issue manually.\n`;
  }
  
  await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: parseInt(ISSUE_NUMBER, 10),
    body: errorComment,
  });
  
  // Add automation-failed label
  await github.rest.issues.addLabels({
    owner,
    repo,
    issue_number: parseInt(ISSUE_NUMBER, 10),
    labels: ['automation-failed'],
  });
  
  console.log('[Auto-Fix] Posted error comment and added automation-failed label');
}

// Run main function
main().catch(error => {
  console.error('[Auto-Fix] Unhandled error:', error);
  process.exit(1);
});
