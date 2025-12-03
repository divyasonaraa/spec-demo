#!/usr/bin/env node

/**
 * PR Generator Agent - Create GitHub pull requests with comprehensive descriptions
 * 
 * Input: Issue + TriageResult + FixPlan + Commits
 * Output: PullRequest with formatted body, labels, reviewers
 * 
 * Contract: specs/001-github-auto-fix/contracts/pr-generator.md
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { getGitHubClient } from './shared/github-client.js';
import { AutoFixError, ErrorCodes } from './shared/error-handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Environment variables
const ISSUE_NUMBER = process.env.ISSUE_NUMBER;
const TRIAGE_RESULT_PATH = process.env.TRIAGE_RESULT_PATH || './triage-result.json';
const COMMIT_RESULT_PATH = process.env.COMMIT_RESULT_PATH || './commit-result.json';
const OUTPUT_PATH = process.env.OUTPUT_PATH || './pr-result.json';
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '30000', 10);
const DEFAULT_BRANCH = process.env.DEFAULT_BRANCH || 'main';

/**
 * Main entry point
 */
async function main() {
  const startTime = Date.now();
  console.log(`[PR Generator] Starting for issue #${ISSUE_NUMBER}`);

  try {
    // Set timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new AutoFixError('TIMEOUT', 'PR generator timeout exceeded 30s')), TIMEOUT_MS);
    });

    // Run PR generation with timeout
    const resultPromise = runPRGeneration();
    const result = await Promise.race([resultPromise, timeoutPromise]);

    // Write output
    writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[PR Generator] ✓ Completed in ${duration}s`);
    process.exit(0);

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[PR Generator] ✗ Failed after ${duration}s:`, error.message);

    // Write error output
    const errorResult = {
      success: false,
      error: {
        code: error.code || 'PR_GENERATION_FAILED',
        message: error.message,
        details: error.details || {},
        recoverable: false
      }
    };
    writeFileSync(OUTPUT_PATH, JSON.stringify(errorResult, null, 2));
    process.exit(1);
  }
}

/**
 * Run PR generation logic
 */
async function runPRGeneration() {
  // Load all inputs
  const triageResult = JSON.parse(readFileSync(TRIAGE_RESULT_PATH, 'utf8'));
  const commitResult = JSON.parse(readFileSync(COMMIT_RESULT_PATH, 'utf8'));

  if (!triageResult.success || !commitResult.success) {
    throw new AutoFixError('INVALID_INPUT', 'One or more input artifacts indicate failure');
  }

  const triage = triageResult.data;
  const commits = commitResult.data;

  // Get GitHub client
  const github = getGitHubClient();
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

  // Fetch issue details
  const { data: issue } = await github.rest.issues.get({
    owner,
    repo,
    issue_number: parseInt(ISSUE_NUMBER, 10)
  });

  console.log(`[PR Generator] Creating PR for: ${issue.title}`);

  // Extract branch name from commit result
  const branchName = commits[0]?.branch_name;
  if (!branchName) {
    throw new AutoFixError('INVALID_INPUT', 'Branch name not found in commit result');
  }

  // Check if PR already exists
  const existingPR = await findExistingPR(github, owner, repo, branchName);
  if (existingPR) {
    console.log(`[PR Generator] PR already exists: #${existingPR}`);
    return {
      success: true,
      data: {
        number: existingPR,
        issue_number: issue.number,
        existing: true,
        message: 'PR already exists for this branch'
      }
    };
  }

  // Generate PR components
  const title = generatePRTitle(issue, triage.classification);
  const body = generatePRBody(issue, triage, commits);
  const labels = selectPRLabels(triage);
  const draft = shouldBeDraft(triage);

  console.log(`[PR Generator] Title: ${title}`);
  console.log(`[PR Generator] Draft: ${draft}`);
  console.log(`[PR Generator] Labels: ${labels.join(', ')}`);

  // Fetch CODEOWNERS for reviewer suggestions
  const codeowners = await fetchCodeowners(github, owner, repo);
  const filesChanged = commits[0]?.files_changed || [];
  const suggestedReviewers = determineSuggestedReviewers(filesChanged, codeowners);

  // Create PR via GitHub API
  const prNumber = await createPullRequest(
    github,
    owner,
    repo,
    title,
    body,
    branchName,
    DEFAULT_BRANCH,
    draft
  );

  console.log(`[PR Generator] Created PR #${prNumber}`);

  // Apply labels
  await applyLabels(github, owner, repo, prNumber, labels);

  // Request reviewers (skip if draft or no suggestions)
  if (!draft && suggestedReviewers.length > 0) {
    await requestReviewers(github, owner, repo, prNumber, suggestedReviewers);
  }

  // Get PR URL
  const { data: pr } = await github.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber
  });

  // Post success comment on issue
  await postSuccessComment(github, owner, repo, issue.number, prNumber, pr.html_url, draft);

  const result = {
    number: prNumber,
    issue_number: issue.number,
    title,
    branch_name: branchName,
    base_branch: DEFAULT_BRANCH,
    status: 'OPEN',
    commits: commits.map(c => c.sha),
    labels,
    suggested_reviewers: suggestedReviewers,
    draft,
    created_at: pr.created_at,
    url: pr.html_url
  };

  return {
    success: true,
    data: result
  };
}

/**
 * Generate PR title
 */
function generatePRTitle(issue, classification) {
  const prefixMap = {
    'BUG': 'Fix',
    'FEATURE': 'Add',
    'DOCS': 'Fix',
    'CHORE': 'Update',
    'OTHER': 'Update'
  };

  const prefix = prefixMap[classification] || 'Update';

  // Capitalize first letter
  const titleCase = issue.title.charAt(0).toUpperCase() + issue.title.slice(1);

  // Limit to 100 chars total
  const maxTitleLength = 80; // Leave room for prefix
  const truncatedTitle = titleCase.length > maxTitleLength
    ? titleCase.substring(0, maxTitleLength) + '...'
    : titleCase;

  return `${prefix} #${issue.number}: ${truncatedTitle}`;
}

/**
 * Generate PR body with all required sections
 */
function generatePRBody(issue, triage, commits) {
  let body = `## Summary\n\n`;
  body += `Fixes #${issue.number}\n\n`;
  body += `${issue.title}\n\n`;

  // What Changed
  body += `## What Changed\n\n`;
  const filesChanged = commits[0]?.files_changed || [];
  if (filesChanged.length > 0) {
    filesChanged.forEach(file => {
      body += `- \`${file}\`\n`;
    });
  } else {
    body += `No file changes recorded.\n`;
  }
  body += `\n`;

  // Why
  body += `## Why\n\n`;
  body += `**Root Cause**: ${triage.reasoning}\n\n`;
  if (issue.body) {
    body += `**Issue Description**: ${issue.body.substring(0, 500)}${issue.body.length > 500 ? '...' : ''}\n\n`;
  }

  // Manual Verification
  body += `## Manual Verification\n\n`;
  body += `To verify this fix:\n\n`;
  const branchName = commits[0]?.branch_name || 'fix-branch';
  body += `1. Check out this PR branch: \`git checkout ${branchName}\`\n`;
  body += `2. Review the changes in: ${filesChanged.map(f => `\`${f}\``).join(', ')}\n`;
  body += `3. ${generateVerificationSteps(triage.classification, filesChanged)}\n\n`;

  // Risk Assessment
  body += `## Risk Assessment\n\n`;
  body += `**Risk Level**: ${triage.risk}\n`;
  body += `**Affected Areas**: ${triage.affectedFiles?.length > 0 ? triage.affectedFiles.join(', ') : 'None specified'}\n`;
  body += `**Complexity**: Simple\n\n`;

  // Security flags warning
  if (triage.securityFlags) {
    body += `⚠️ **Security Note**: This change was flagged for security review.\n\n`;
  }

  // MEDIUM risk warning
  if (triage.risk === 'MEDIUM') {
    body += `⚠️ **MEDIUM RISK**: This PR requires maintainer review before merging.\n\n`;
  }

  // Rollback Instructions
  if (commits.length > 0 && commits[0].sha) {
    body += `### Rollback Instructions\n\n`;
    body += `If this PR causes issues after merging:\n\n`;
    body += `\`\`\`bash\n`;
    body += `git revert ${commits[0].sha}\n`;
    body += `\`\`\`\n\n`;
  }

  // Validation Results (collapsible)
  body += `<details>\n<summary>Validation Results</summary>\n\n`;
  commits.forEach(commit => {
    if (commit.validation_results && commit.validation_results.length > 0) {
      commit.validation_results.forEach(result => {
        body += `**Command**: \`${result.command}\`\n`;
        body += `**Exit Code**: ${result.exit_code}\n`;
        body += `**Duration**: ${result.duration_ms}ms\n\n`;
        if (result.stdout) {
          body += `\`\`\`\n${result.stdout.substring(0, 1000)}\n\`\`\`\n\n`;
        }
        if (result.stderr) {
          body += `**Errors**:\n\`\`\`\n${result.stderr.substring(0, 1000)}\n\`\`\`\n\n`;
        }
        body += `---\n\n`;
      });
    }
  });
  body += `</details>\n\n`;

  // Commits (collapsible)
  body += `<details>\n<summary>Commits</summary>\n\n`;
  commits.forEach(commit => {
    const shortSha = commit.sha ? commit.sha.substring(0, 7) : 'unknown';
    const firstLine = commit.message ? commit.message.split('\n')[0] : 'No message';
    body += `- ${shortSha}: ${firstLine}\n`;
  });
  body += `\n</details>\n\n`;

  // Footer
  body += `---\n\n`;
  body += `*This PR was automatically generated by the GitHub Auto-Fix system.*\n`;

  return body;
}

/**
 * Generate verification steps based on classification
 */
function generateVerificationSteps(classification, fileChanges) {
  switch (classification) {
    case 'DOCS':
      const firstFile = fileChanges[0]?.path || 'the file';
      return `Open \`${firstFile}\` and verify the content reads correctly`;
    case 'BUG':
      return `Test the scenario described in the issue to confirm the bug is fixed`;
    case 'FEATURE':
      return `Test the new functionality according to the issue requirements`;
    case 'CHORE':
      return `Verify the maintenance changes don't break existing functionality`;
    default:
      return `Verify the changes achieve the intended outcome`;
  }
}

/**
 * Select labels for PR
 */
function selectPRLabels(triage) {
  const labels = ['auto-fix'];

  // Classification label
  labels.push(triage.classification.toLowerCase());

  // Risk labels
  switch (triage.risk) {
    case 'LOW':
      labels.push('low-risk');
      break;
    case 'MEDIUM':
      labels.push('medium-risk', 'needs-review');
      break;
    case 'HIGH':
      labels.push('high-risk', 'human-review-required');
      break;
  }

  // Security label
  if (triage.securityFlags) {
    labels.push('security');
  }

  return labels;
}

/**
 * Determine if PR should be draft
 */
function shouldBeDraft(triage) {
  // MEDIUM risk requires draft + human approval
  if (triage.risk === 'MEDIUM') return true;

  // HIGH risk should never reach PR (blocked by triage), but safety check
  if (triage.risk === 'HIGH') return true;

  return false;
}

/**
 * Fetch CODEOWNERS file
 */
async function fetchCodeowners(github, owner, repo) {
  const codeownersPaths = [
    'CODEOWNERS',
    '.github/CODEOWNERS',
    'docs/CODEOWNERS'
  ];

  for (const path of codeownersPaths) {
    try {
      const { data } = await github.rest.repos.getContent({
        owner,
        repo,
        path
      });

      const content = Buffer.from(data.content, 'base64').toString('utf8');
      return parseCodeowners(content);
    } catch (error) {
      // File not found, try next path
      continue;
    }
  }

  return {};
}

/**
 * Parse CODEOWNERS file content
 */
function parseCodeowners(content) {
  const codeowners = {};

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Format: pattern @owner1 @owner2
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;

    const pattern = parts[0];
    const owners = parts.slice(1).map(o => o.replace('@', ''));

    codeowners[pattern] = owners;
  }

  return codeowners;
}

/**
 * Determine suggested reviewers
 */
function determineSuggestedReviewers(fileChanges, codeowners) {
  const reviewers = new Set();

  // Match files against CODEOWNERS patterns
  for (const filePath of fileChanges) {
    for (const [pattern, owners] of Object.entries(codeowners)) {
      if (matchesPattern(filePath, pattern)) {
        owners.forEach(o => reviewers.add(o));
      }
    }
  }

  // Limit to 3 reviewers
  return Array.from(reviewers).slice(0, 3);
}

/**
 * Match file path against CODEOWNERS glob pattern
 */
function matchesPattern(path, pattern) {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Find existing PR for branch
 */
async function findExistingPR(github, owner, repo, branchName) {
  try {
    const { data: pulls } = await github.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${branchName}`,
      state: 'open'
    });

    return pulls.length > 0 ? pulls[0].number : null;
  } catch (error) {
    console.error('[PR Generator] Error checking for existing PR:', error.message);
    return null;
  }
}

/**
 * Create pull request
 */
async function createPullRequest(github, owner, repo, title, body, headBranch, baseBranch, draft) {
  try {
    const { data: pr } = await github.rest.pulls.create({
      owner,
      repo,
      title,
      body,
      head: headBranch,
      base: baseBranch,
      draft,
      maintainer_can_modify: true
    });

    return pr.number;
  } catch (error) {
    throw new AutoFixError(
      'PR_CREATION_FAILED',
      `Failed to create pull request: ${error.message}`,
      { head: headBranch, base: baseBranch }
    );
  }
}

/**
 * Apply labels to PR
 */
async function applyLabels(github, owner, repo, prNumber, labels) {
  try {
    await github.rest.issues.addLabels({
      owner,
      repo,
      issue_number: prNumber,
      labels
    });
    console.log(`[PR Generator] Applied labels: ${labels.join(', ')}`);
  } catch (error) {
    console.error('[PR Generator] Failed to apply labels:', error.message);
    // Non-fatal - continue
  }
}

/**
 * Request reviewers
 */
async function requestReviewers(github, owner, repo, prNumber, reviewers) {
  try {
    await github.rest.pulls.requestReviewers({
      owner,
      repo,
      pull_number: prNumber,
      reviewers
    });
    console.log(`[PR Generator] Requested reviewers: ${reviewers.join(', ')}`);
  } catch (error) {
    console.error('[PR Generator] Failed to request reviewers:', error.message);
    // Non-fatal - continue
  }
}

/**
 * Post success comment on issue
 */
async function postSuccessComment(github, owner, repo, issueNumber, prNumber, prUrl, isDraft) {
  const comment = `## ✅ Automated fix complete!\n\n` +
    `A pull request has been created: #${prNumber}\n\n` +
    `🔗 [View PR](${prUrl})\n\n` +
    (isDraft
      ? `⚠️ This PR is in **draft mode** and requires human review before merging.\n\n`
      : `The fix has been validated and is ready for review.\n\n`) +
    `If you approve the changes, a maintainer can merge the PR.`;

  try {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: comment
    });
    console.log(`[PR Generator] Posted success comment on issue #${issueNumber}`);
  } catch (error) {
    console.error('[PR Generator] Failed to post comment:', error.message);
    // Non-fatal - PR was created successfully
  }
}

// Run main function
main().catch(error => {
  console.error('[PR Generator] Unhandled error:', error);
  process.exit(1);
});
