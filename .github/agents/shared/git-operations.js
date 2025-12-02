/**
 * Git Operations Wrapper
 * 
 * Provides utilities for git operations needed by the auto-fix system:
 * - Branch creation
 * - Patch application
 * - Commit creation
 * - Push operations
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { AutoFixError, ErrorCodes } from './error-handler.js';

/**
 * Execute git command
 * @param {string} command - Git command to execute
 * @param {string} cwd - Working directory
 * @returns {string} - Command output
 */
function execGit(command, cwd = process.cwd()) {
  try {
    return execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    throw new AutoFixError(
      `Git command failed: ${command}\n${error.stderr || error.message}`,
      ErrorCodes.GIT_ERROR,
      { command, stderr: error.stderr }
    );
  }
}

/**
 * Configure git user for commits
 * @param {string} repoPath - Repository path
 * @param {string} name - User name
 * @param {string} email - User email
 */
export function configureGitUser(repoPath, name = 'GitHub Auto-Fix Bot', email = 'autofix@github.com') {
  execGit(`git config user.name "${name}"`, repoPath);
  execGit(`git config user.email "${email}"`, repoPath);
}

/**
 * Get current branch name
 * @param {string} repoPath - Repository path
 * @returns {string} - Branch name
 */
export function getCurrentBranch(repoPath) {
  return execGit('git rev-parse --abbrev-ref HEAD', repoPath);
}

/**
 * Get current commit SHA
 * @param {string} repoPath - Repository path
 * @returns {string} - Commit SHA
 */
export function getCurrentCommitSha(repoPath) {
  return execGit('git rev-parse HEAD', repoPath);
}

/**
 * Create a new branch
 * @param {string} repoPath - Repository path
 * @param {string} branchName - New branch name
 * @param {string} fromBranch - Branch to create from (default: current)
 * @returns {string} - Created branch name
 */
export function createBranch(repoPath, branchName, fromBranch = null) {
  // Check if branch already exists
  try {
    execGit(`git rev-parse --verify ${branchName}`, repoPath);
    throw new AutoFixError(
      `Branch already exists: ${branchName}`,
      ErrorCodes.GIT_ERROR,
      { branchName }
    );
  } catch (error) {
    // Branch doesn't exist, continue
    if (!error.message.includes('Branch already exists')) {
      // This is expected - branch doesn't exist yet
    } else {
      throw error;
    }
  }
  
  // Create and checkout new branch
  if (fromBranch) {
    execGit(`git checkout -b ${branchName} ${fromBranch}`, repoPath);
  } else {
    execGit(`git checkout -b ${branchName}`, repoPath);
  }
  
  return branchName;
}

/**
 * Checkout an existing branch
 * @param {string} repoPath - Repository path
 * @param {string} branchName - Branch to checkout
 */
export function checkoutBranch(repoPath, branchName) {
  execGit(`git checkout ${branchName}`, repoPath);
}

/**
 * Apply a patch (unified diff)
 * @param {string} repoPath - Repository path
 * @param {string} patchContent - Unified diff content
 * @param {boolean} checkOnly - If true, only validate without applying
 * @returns {boolean} - True if successful
 */
export function applyPatch(repoPath, patchContent, checkOnly = false) {
  // Write patch to temporary file
  const patchFile = `${repoPath}/.git/auto-fix-patch.diff`;
  writeFileSync(patchFile, patchContent, 'utf-8');
  
  try {
    // First, check if patch applies cleanly
    execGit(`git apply --check ${patchFile}`, repoPath);
    
    if (checkOnly) {
      return true;
    }
    
    // Apply the patch
    execGit(`git apply ${patchFile}`, repoPath);
    
    return true;
  } catch (error) {
    throw new AutoFixError(
      `Failed to apply patch: ${error.message}`,
      ErrorCodes.GIT_ERROR,
      { patchFile }
    );
  }
}

/**
 * Stage files for commit
 * @param {string} repoPath - Repository path
 * @param {Array<string>} filePaths - Files to stage (empty array = stage all)
 */
export function stageFiles(repoPath, filePaths = []) {
  if (filePaths.length === 0) {
    execGit('git add -A', repoPath);
  } else {
    for (const file of filePaths) {
      execGit(`git add "${file}"`, repoPath);
    }
  }
}

/**
 * Create a commit
 * @param {string} repoPath - Repository path
 * @param {string} message - Commit message
 * @returns {string} - Commit SHA
 */
export function createCommit(repoPath, message) {
  // Ensure git user is configured
  configureGitUser(repoPath);
  
  execGit(`git commit -m "${message.replace(/"/g, '\\"')}"`, repoPath);
  
  return getCurrentCommitSha(repoPath);
}

/**
 * Push branch to remote
 * @param {string} repoPath - Repository path
 * @param {string} branchName - Branch to push
 * @param {boolean} force - Force push
 */
export function pushBranch(repoPath, branchName, force = false) {
  const forceFlag = force ? '--force' : '';
  execGit(`git push origin ${branchName} ${forceFlag}`.trim(), repoPath);
}

/**
 * Get diff of staged changes
 * @param {string} repoPath - Repository path
 * @returns {string} - Unified diff
 */
export function getStagedDiff(repoPath) {
  return execGit('git diff --cached', repoPath);
}

/**
 * Get diff of unstaged changes
 * @param {string} repoPath - Repository path
 * @returns {string} - Unified diff
 */
export function getUnstagedDiff(repoPath) {
  return execGit('git diff', repoPath);
}

/**
 * Check if working directory is clean
 * @param {string} repoPath - Repository path
 * @returns {boolean} - True if no uncommitted changes
 */
export function isWorkingDirectoryClean(repoPath) {
  const status = execGit('git status --porcelain', repoPath);
  return status.length === 0;
}

/**
 * Reset working directory to last commit (discard changes)
 * @param {string} repoPath - Repository path
 * @param {boolean} hard - If true, discard all changes including staged
 */
export function resetWorkingDirectory(repoPath, hard = true) {
  if (hard) {
    execGit('git reset --hard HEAD', repoPath);
  } else {
    execGit('git reset HEAD', repoPath);
  }
  
  // Clean untracked files
  execGit('git clean -fd', repoPath);
}

/**
 * Delete a branch
 * @param {string} repoPath - Repository path
 * @param {string} branchName - Branch to delete
 * @param {boolean} force - Force delete
 */
export function deleteBranch(repoPath, branchName, force = false) {
  const flag = force ? '-D' : '-d';
  execGit(`git branch ${flag} ${branchName}`, repoPath);
}

/**
 * Get list of changed files in current working directory
 * @param {string} repoPath - Repository path
 * @returns {Array<string>} - Changed file paths
 */
export function getChangedFiles(repoPath) {
  const output = execGit('git status --porcelain', repoPath);
  
  return output
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      // Parse git status output (e.g., "M  file.js" or "A  file.js")
      const match = line.match(/^.{3}(.+)$/);
      return match ? match[1].trim() : null;
    })
    .filter(Boolean);
}

/**
 * Fetch latest changes from remote
 * @param {string} repoPath - Repository path
 * @param {string} remote - Remote name (default: origin)
 */
export function fetchRemote(repoPath, remote = 'origin') {
  execGit(`git fetch ${remote}`, repoPath);
}

/**
 * Merge branch into current branch
 * @param {string} repoPath - Repository path
 * @param {string} branchName - Branch to merge
 * @param {boolean} noFf - No fast-forward
 */
export function mergeBranch(repoPath, branchName, noFf = false) {
  const noFfFlag = noFf ? '--no-ff' : '';
  execGit(`git merge ${branchName} ${noFfFlag}`.trim(), repoPath);
}

/**
 * Check if there are merge conflicts
 * @param {string} repoPath - Repository path
 * @returns {boolean} - True if conflicts exist
 */
export function hasConflicts(repoPath) {
  try {
    const conflictFiles = execGit('git diff --name-only --diff-filter=U', repoPath);
    return conflictFiles.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get git log for specific branch
 * @param {string} repoPath - Repository path
 * @param {string} branchName - Branch name
 * @param {number} limit - Number of commits to retrieve
 * @returns {Array<Object>} - Commit objects
 */
export function getCommitLog(repoPath, branchName, limit = 10) {
  const output = execGit(
    `git log ${branchName} --pretty=format:"%H|%an|%ae|%at|%s" -n ${limit}`,
    repoPath
  );
  
  return output
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const [sha, author, email, timestamp, subject] = line.split('|');
      return {
        sha,
        author,
        email,
        timestamp: parseInt(timestamp, 10),
        subject,
      };
    });
}

/**
 * Generate conventional commit message
 * @param {string} type - Commit type (fix, feat, docs, chore, etc.)
 * @param {string} scope - Commit scope (optional)
 * @param {string} subject - Commit subject
 * @param {string} body - Commit body (optional)
 * @param {number} issueNumber - GitHub issue number (optional)
 * @returns {string} - Formatted commit message
 */
export function generateConventionalCommit(type, scope, subject, body = null, issueNumber = null) {
  let message = scope ? `${type}(${scope}): ${subject}` : `${type}: ${subject}`;
  
  if (body) {
    message += `\n\n${body}`;
  }
  
  if (issueNumber) {
    message += `\n\nFixes #${issueNumber}`;
  }
  
  return message;
}
