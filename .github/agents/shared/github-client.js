/**
 * GitHub API Client Wrapper
 * 
 * Provides a simplified interface to GitHub API operations
 * with error handling and rate limiting awareness.
 */

import { Octokit } from '@octokit/rest';
import { retryWithBackoff } from './retry.js';
import { AutoFixError, ErrorCodes } from './error-handler.js';

/**
 * Initialize GitHub API client
 * @returns {Octokit} - Configured Octokit instance
 */
export function createGitHubClient() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new AutoFixError(
      'GITHUB_TOKEN environment variable is required',
      ErrorCodes.CONFIG_ERROR
    );
  }

  return new Octokit({
    auth: token,
    userAgent: 'github-auto-fix-agent/1.0.0',
  });
}

/**
 * Get GitHub client (alias for createGitHubClient for compatibility)
 * @returns {Octokit} - Configured Octokit instance
 */
export function getGitHubClient() {
  return createGitHubClient();
}

/**
 * Get issue details
 * @param {Octokit} octokit - GitHub client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @returns {Promise<Object>} - Issue data
 */
export async function getIssue(octokit, owner, repo, issueNumber) {
  return retryWithBackoff(async () => {
    const { data } = await octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });
    return data;
  });
}

/**
 * Post a comment on an issue
 * @param {Octokit} octokit - GitHub client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {string} body - Comment body (Markdown)
 * @returns {Promise<Object>} - Comment data
 */
export async function postComment(octokit, owner, repo, issueNumber, body) {
  return retryWithBackoff(async () => {
    const { data } = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
    return data;
  });
}

/**
 * Add labels to an issue
 * @param {Octokit} octokit - GitHub client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {Array<string>} labels - Labels to add
 * @returns {Promise<void>}
 */
export async function addLabels(octokit, owner, repo, issueNumber, labels) {
  if (!labels || labels.length === 0) return;

  return retryWithBackoff(async () => {
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });
  });
}

/**
 * Remove a label from an issue
 * @param {Octokit} octokit - GitHub client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @param {string} label - Label to remove
 * @returns {Promise<void>}
 */
export async function removeLabel(octokit, owner, repo, issueNumber, label) {
  return retryWithBackoff(async () => {
    try {
      await octokit.issues.removeLabel({
        owner,
        repo,
        issue_number: issueNumber,
        name: label,
      });
    } catch (error) {
      // Ignore 404 errors (label doesn't exist)
      if (error.status !== 404) {
        throw error;
      }
    }
  });
}

/**
 * Create a branch
 * @param {Octokit} octokit - GitHub client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branchName - New branch name
 * @param {string} fromSha - SHA to branch from (usually main/master HEAD)
 * @returns {Promise<Object>} - Branch reference data
 */
export async function createBranch(octokit, owner, repo, branchName, fromSha) {
  return retryWithBackoff(async () => {
    const { data } = await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: fromSha,
    });
    return data;
  });
}

/**
 * Get default branch HEAD SHA
 * @param {Octokit} octokit - GitHub client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<string>} - HEAD SHA of default branch
 */
export async function getDefaultBranchSha(octokit, owner, repo) {
  return retryWithBackoff(async () => {
    const { data } = await octokit.repos.get({ owner, repo });
    const defaultBranch = data.default_branch;

    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });

    return refData.object.sha;
  });
}

/**
 * Create a pull request
 * @param {Octokit} octokit - GitHub client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} title - PR title
 * @param {string} head - Branch name with changes
 * @param {string} base - Base branch (usually main/master)
 * @param {string} body - PR body (Markdown)
 * @param {boolean} draft - Whether PR is a draft
 * @returns {Promise<Object>} - Pull request data
 */
export async function createPullRequest(octokit, owner, repo, title, head, base, body, draft = false) {
  return retryWithBackoff(async () => {
    const { data } = await octokit.pulls.create({
      owner,
      repo,
      title,
      head,
      base,
      body,
      draft,
    });
    return data;
  });
}

/**
 * Request reviewers for a pull request
 * @param {Octokit} octokit - GitHub client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} pullNumber - PR number
 * @param {Array<string>} reviewers - Usernames to request review from
 * @returns {Promise<void>}
 */
export async function requestReviewers(octokit, owner, repo, pullNumber, reviewers) {
  if (!reviewers || reviewers.length === 0) return;

  return retryWithBackoff(async () => {
    await octokit.pulls.requestReviewers({
      owner,
      repo,
      pull_number: pullNumber,
      reviewers,
    });
  });
}

/**
 * Get file content from repository
 * @param {Octokit} octokit - GitHub client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @param {string} ref - Branch/commit reference (default: default branch)
 * @returns {Promise<string>} - File content
 */
export async function getFileContent(octokit, owner, repo, path, ref = null) {
  return retryWithBackoff(async () => {
    const params = { owner, repo, path };
    if (ref) params.ref = ref;

    const { data } = await octokit.repos.getContent(params);

    if (Array.isArray(data)) {
      throw new AutoFixError(
        `Path is a directory, not a file: ${path}`,
        ErrorCodes.INVALID_INPUT
      );
    }

    if (data.type !== 'file') {
      throw new AutoFixError(
        `Path is not a file: ${path}`,
        ErrorCodes.INVALID_INPUT
      );
    }

    // Decode base64 content
    return Buffer.from(data.content, 'base64').toString('utf-8');
  });
}

/**
 * Check if branch exists
 * @param {Octokit} octokit - GitHub client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branchName - Branch name to check
 * @returns {Promise<boolean>} - True if branch exists
 */
export async function branchExists(octokit, owner, repo, branchName) {
  try {
    await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
    });
    return true;
  } catch (error) {
    if (error.status === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Check if pull request exists for branch
 * @param {Octokit} octokit - GitHub client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} head - Branch name
 * @returns {Promise<Object|null>} - PR data if exists, null otherwise
 */
export async function findPullRequestByBranch(octokit, owner, repo, head) {
  return retryWithBackoff(async () => {
    const { data } = await octokit.pulls.list({
      owner,
      repo,
      head: `${owner}:${head}`,
      state: 'open',
    });

    return data.length > 0 ? data[0] : null;
  });
}

/**
 * Get repository CODEOWNERS file content
 * @param {Octokit} octokit - GitHub client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<string|null>} - CODEOWNERS content or null if not found
 */
export async function getCodeOwners(octokit, owner, repo) {
  const possiblePaths = [
    '.github/CODEOWNERS',
    'CODEOWNERS',
    'docs/CODEOWNERS',
  ];

  for (const path of possiblePaths) {
    try {
      return await getFileContent(octokit, owner, repo, path);
    } catch (error) {
      // Continue to next path
      continue;
    }
  }

  return null;
}

/**
 * Check GitHub API rate limit status
 * @param {Octokit} octokit - GitHub client
 * @returns {Promise<Object>} - Rate limit info
 */
export async function checkRateLimit(octokit) {
  const { data } = await octokit.rateLimit.get();
  return {
    limit: data.rate.limit,
    remaining: data.rate.remaining,
    reset: new Date(data.rate.reset * 1000),
    used: data.rate.used,
  };
}
