/**
 * Error Handling Utilities
 * 
 * Provides custom error types and error handling utilities
 * for the auto-fix system.
 */

/**
 * Error codes for categorizing failures
 */
export const ErrorCodes = {
  // Configuration errors
  CONFIG_ERROR: 'CONFIG_ERROR',
  MISSING_ENV_VAR: 'MISSING_ENV_VAR',

  // GitHub API errors
  GITHUB_API_ERROR: 'GITHUB_API_ERROR',
  GITHUB_RATE_LIMIT: 'GITHUB_RATE_LIMIT',
  GITHUB_AUTH_ERROR: 'GITHUB_AUTH_ERROR',

  // AI provider errors
  AI_ERROR: 'AI_ERROR',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',

  // Git operation errors
  GIT_ERROR: 'GIT_ERROR',
  GIT_CONFLICT: 'GIT_CONFLICT',
  GIT_PERMISSION_ERROR: 'GIT_PERMISSION_ERROR',

  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',

  // Security errors
  SECURITY_VIOLATION: 'SECURITY_VIOLATION',

  // Generic errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  TIMEOUT: 'TIMEOUT',
};

/**
 * Custom error class for auto-fix operations
 */
export class AutoFixError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code from ErrorCodes
   * @param {Object} context - Additional context
   */
  constructor(message, code = ErrorCodes.UNKNOWN_ERROR, context = {}) {
    super(message);
    this.name = 'AutoFixError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AutoFixError);
    }
  }

  /**
   * Convert error to JSON for logging
   * @returns {Object} - JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * Check if error is retryable
   * @returns {boolean} - True if operation should be retried
   */
  isRetryable() {
    const retryableCodes = [
      ErrorCodes.GITHUB_RATE_LIMIT,
      ErrorCodes.AI_TIMEOUT,
      ErrorCodes.AI_RATE_LIMIT,
      ErrorCodes.TIMEOUT,
    ];

    return retryableCodes.includes(this.code);
  }
}

/**
 * Wrap an async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} operationName - Name for logging
 * @returns {Function} - Wrapped function
 */
export function withErrorHandling(fn, operationName = 'operation') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      // Convert to AutoFixError if not already
      if (!(error instanceof AutoFixError)) {
        const autoFixError = new AutoFixError(
          `${operationName} failed: ${error.message}`,
          determineErrorCode(error),
          { originalError: error.message, operationName }
        );

        throw autoFixError;
      }

      throw error;
    }
  };
}

/**
 * Determine error code from generic error
 * @param {Error} error - Original error
 * @returns {string} - Error code
 */
function determineErrorCode(error) {
  const message = error.message?.toLowerCase() || '';

  // GitHub API errors
  if (error.status === 403 && message.includes('rate limit')) {
    return ErrorCodes.GITHUB_RATE_LIMIT;
  }
  if (error.status === 401 || error.status === 403) {
    return ErrorCodes.GITHUB_AUTH_ERROR;
  }
  if (error.status >= 400 && error.status < 500) {
    return ErrorCodes.GITHUB_API_ERROR;
  }

  // Git errors
  if (message.includes('git') || message.includes('conflict')) {
    return ErrorCodes.GIT_ERROR;
  }

  // AI errors
  if (message.includes('anthropic') || message.includes('model')) {
    return ErrorCodes.AI_ERROR;
  }

  // Timeout errors
  if (message.includes('timeout') || message.includes('timed out')) {
    return ErrorCodes.TIMEOUT;
  }

  return ErrorCodes.UNKNOWN_ERROR;
}

/**
 * Format error for GitHub issue comment
 * @param {Error} error - Error to format
 * @param {string} agent - Agent that encountered the error
 * @returns {string} - Formatted Markdown
 */
export function formatErrorForComment(error, agent = 'auto-fix') {
  const isAutoFixError = error instanceof AutoFixError;
  const errorCode = isAutoFixError ? error.code : 'UNKNOWN';

  let markdown = `## 🤖 Auto-Fix Agent - Failed\n\n`;
  markdown += `The automated fix attempt encountered an error and has been rolled back.\n\n`;
  markdown += `### Error Details\n\n`;
  markdown += `**Error Code**: \`${errorCode}\`\n`;
  markdown += `**Message**: ${error.message}\n\n`;

  // Provide detailed guidance based on error type
  if (errorCode === 'VALIDATION_FAILED') {
    markdown += `### 🔍 What Happened\n\n`;
    markdown += `The AI generated a fix, but it failed validation checks (lint, type-check, or build).\n\n`;

    if (error.context?.validation_results) {
      const lastResult = error.context.validation_results[error.context.validation_results.length - 1];
      if (lastResult) {
        markdown += `**Failed Command**: \`${lastResult.command}\`\n\n`;
      }
    }

    if (error.context?.output) {
      markdown += `**Validation Output**:\n`;
      markdown += `\`\`\`\n${error.context.output.slice(0, 1500)}\n\`\`\`\n\n`;
    }

    markdown += `### 🛠️ How to Fix\n\n`;
    markdown += `1. **Review the validation error** above to understand what went wrong\n`;
    markdown += `2. **Check the affected files** mentioned in the issue\n`;
    markdown += `3. **Run the failed command locally**:\n`;
    if (error.context?.validation_results) {
      const lastResult = error.context.validation_results[error.context.validation_results.length - 1];
      if (lastResult) {
        markdown += `   \`\`\`bash\n   ${lastResult.command}\n   \`\`\`\n`;
      }
    }
    markdown += `4. **Fix the issue manually** and create a PR\n\n`;
    markdown += `💡 **Tip**: The AI-generated code may be close to correct. Consider checking the workflow logs for what was attempted.\n`;

  } else if (errorCode === 'SECURITY_VIOLATION') {
    markdown += `### 🔒 Security Block\n\n`;
    markdown += `This issue was **blocked for security reasons**. It affects sensitive files or configurations that require manual review.\n\n`;
    markdown += `**Blocked Items**:\n`;
    if (error.context?.violations) {
      error.context.violations.forEach(v => {
        markdown += `- \`${v.path}\`\n`;
        markdown += `  - **Reason**: ${v.reason}\n`;
        if (v.pattern) {
          markdown += `  - **Pattern**: \`${v.pattern}\`\n`;
        }
      });
    }
    markdown += `\n### 🛠️ How to Fix\n\n`;
    markdown += `1. **Understand the security concern** - Review why these files are sensitive\n`;
    markdown += `2. **Manual implementation required** - A maintainer with appropriate access must implement this fix\n`;
    markdown += `3. **Follow security review process** - Ensure changes go through proper security review\n`;
    markdown += `4. **Test in isolated environment** - Test changes thoroughly before deploying\n\n`;
    markdown += `⚠️ **Important**: Never commit sensitive data like API keys, passwords, or private keys.\n`;

  } else if (errorCode === 'INVALID_AI_OUTPUT' || errorCode === 'AI_ERROR') {
    markdown += `### 🤔 What Happened\n\n`;
    markdown += `The AI couldn't generate a valid, structured output (missing \`file_changes\` or \`commit_message\`). Common causes:\n`;
    markdown += `- The issue lacks clear file references or expected behavior\n`;
    markdown += `- The fix spans multiple modules without context\n`;
    markdown += `- The described file(s) don't exist or differ from repo structure\n\n`;

    if (error.context?.response) {
      markdown += `**AI Response Preview** (truncated):\n`;
      markdown += `\`\`\`\n${error.context.response.slice(0, 500)}...\n\`\`\`\n\n`;
    }

    // Provide a crisp remediation checklist and a ready-to-copy template
    markdown += `### 🛠️ How to Fix (High-Impact)\n\n`;
    markdown += `1. **Name the exact files to change** (paths as in repo)\n`;
    markdown += `2. **Describe the expected behavior** (before → after)\n`;
    markdown += `3. **Paste a minimal snippet** that shows the failure or desired change\n`;
    markdown += `4. **Add environment context** (e.g., Node version, commands run)\n`;
    markdown += `5. **Re-run** by re-applying the \`auto-fix\` label\n\n`;

    markdown += `#### Quick Issue Template (copy/paste)\n`;
    markdown += `\`\`\`markdown\n`;
    markdown += `Title: Fix X in Y component\n\n`;
    markdown += `Affected files:\n`;
    markdown += `- src/components/form/FormRenderer.vue\n`;
    markdown += `- src/composables/useFormValidation.ts\n\n`;
    markdown += `Current behavior:\n`;
    markdown += `- When clicking ";Previous", navigation is blocked\n\n`;
    markdown += `Expected behavior:\n`;
    markdown += `- Enable ";Previous" to go to prior step\n\n`;
    markdown += `Minimal snippet / error:\n`;
    markdown += `- \`<BaseButton :disabled=\"true\" />\` in FormRenderer.vue\n\n`;
    markdown += `Notes:\n`;
    markdown += `- Repo uses Vue 3 + Vite\n`;
    markdown += `- Run: \`npm run dev\` to reproduce\n`;
    markdown += `\`\`\`\n\n`;

    markdown += `#### Fast Checks\n`;
    markdown += `- Confirm the file path exists in the repo\n`;
    markdown += `- If it's a docs-only change, specify \`README.md\` directly\n`;
    markdown += `- Avoid vague terms like "fix UI"; be file- and behavior-specific\n`;

  } else if (errorCode === 'NOT_AUTO_FIX' || errorCode === 'INVALID_INPUT') {
    markdown += `### ℹ️ What Happened\n\n`;
    markdown += `The triage agent determined this issue is **not suitable for automatic fixing**.\n\n`;
    markdown += `**Reason**: ${error.message}\n\n`;
    markdown += `### 🛠️ How to Fix\n\n`;
    markdown += `This issue requires manual implementation by a developer. The auto-fix system cannot handle:\n`;
    markdown += `- Complex architectural changes\n`;
    markdown += `- Changes requiring business logic decisions\n`;
    markdown += `- Updates to infrastructure or deployment configurations\n`;
    markdown += `- Changes requiring human judgment or stakeholder input\n`;

  } else if (errorCode === 'TIMEOUT') {
    markdown += `### ⏱️ What Happened\n\n`;
    markdown += `The auto-fix agent exceeded the timeout limit.\n\n`;
    markdown += `### 🛠️ How to Fix\n\n`;
    markdown += `1. **Simplify the issue** - Break it into smaller, focused issues\n`;
    markdown += `2. **Reduce file count** - Specify fewer files to modify\n`;
    markdown += `3. **Manual implementation** - Complex changes may require manual work\n`;

  } else if (errorCode === 'GITHUB_RATE_LIMIT' || errorCode === 'AI_RATE_LIMIT') {
    markdown += `### ⏳ What Happened\n\n`;
    markdown += `Rate limit reached for ${errorCode === 'GITHUB_RATE_LIMIT' ? 'GitHub API' : 'AI provider'}.\n\n`;
    markdown += `### 🛠️ How to Fix\n\n`;
    markdown += `1. **Wait for rate limit reset** - This is temporary\n`;
    if (isAutoFixError && error.isRetryable()) {
      markdown += `2. **Automatic retry** - The workflow may retry automatically\n`;
    }
    markdown += `3. **Check workflow logs** for rate limit details\n`;

  } else if (errorCode === 'GIT_ERROR' || errorCode === 'GIT_CONFLICT') {
    markdown += `### 🔀 What Happened\n\n`;
    markdown += `Git operation failed. This may be due to:\n`;
    markdown += `- Merge conflicts\n`;
    markdown += `- Branch protection rules\n`;
    markdown += `- Permission issues\n\n`;
    markdown += `### 🛠️ How to Fix\n\n`;
    markdown += `1. **Check branch protection rules** - Ensure automation has proper permissions\n`;
    markdown += `2. **Resolve conflicts manually** - If merge conflicts exist\n`;
    markdown += `3. **Review git logs** in workflow run for details\n`;

  } else {
    markdown += `### 🛠️ How to Fix\n\n`;
    markdown += `1. **Check the GitHub Actions logs** for detailed error information\n`;
    markdown += `2. **Review the issue description** - Ensure it's clear and specific\n`;
    markdown += `3. **Try manual implementation** - Some fixes may be too complex for automation\n`;
    markdown += `4. **Report to maintainers** if this seems like a bug in the automation system\n`;
  }

  if (isAutoFixError && Object.keys(error.context).length > 0) {
    markdown += `\n<details>\n<summary>📋 Technical Details</summary>\n\n`;
    markdown += `\`\`\`json\n${JSON.stringify(error.context, null, 2)}\n\`\`\`\n\n`;
    markdown += `</details>\n`;
  }

  markdown += `\n---\n\n`;
  markdown += `### 📚 Additional Resources\n\n`;
  markdown += `- **Workflow Run**: [View detailed logs](../../actions)\n`;
  markdown += `- **Auto-Fix Documentation**: Check the repository README for auto-fix requirements\n`;
  markdown += `- **Manual Fix Guide**: Follow the standard PR process for manual fixes\n\n`;
  markdown += `> 💬 **Need Help?** Comment on this issue with questions or tag a maintainer.\n`;

  return markdown;
}

/**
 * Log error with structured format
 * @param {Error} error - Error to log
 * @param {Object} context - Additional context
 */
export function logError(error, context = {}) {
  const logEntry = {
    level: 'ERROR',
    timestamp: new Date().toISOString(),
    message: error.message,
    ...context,
  };

  if (error instanceof AutoFixError) {
    logEntry.code = error.code;
    logEntry.errorContext = error.context;
    logEntry.retryable = error.isRetryable();
  }

  if (error.stack) {
    logEntry.stack = error.stack.split('\n');
  }

  // Output as JSON to stderr for structured logging
  console.error(JSON.stringify(logEntry));
}

/**
 * Create a timeout promise
 * @param {number} ms - Timeout in milliseconds
 * @param {string} operationName - Operation name for error message
 * @returns {Promise} - Promise that rejects after timeout
 */
export function createTimeout(ms, operationName = 'operation') {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new AutoFixError(
        `${operationName} timed out after ${ms}ms`,
        ErrorCodes.TIMEOUT,
        { timeout: ms, operationName }
      ));
    }, ms);
  });
}

/**
 * Execute function with timeout
 * @param {Function} fn - Async function to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Operation name for error message
 * @returns {Promise} - Result or timeout error
 */
export async function withTimeout(fn, timeoutMs, operationName = 'operation') {
  return Promise.race([
    fn(),
    createTimeout(timeoutMs, operationName),
  ]);
}

/**
 * Check if error indicates rate limiting
 * @param {Error} error - Error to check
 * @returns {boolean} - True if rate limit error
 */
export function isRateLimitError(error) {
  if (error instanceof AutoFixError) {
    return error.code === ErrorCodes.GITHUB_RATE_LIMIT ||
      error.code === ErrorCodes.AI_RATE_LIMIT;
  }

  const message = error.message?.toLowerCase() || '';
  return message.includes('rate limit') || error.status === 429;
}

/**
 * Extract retry-after value from error
 * @param {Error} error - Error that may contain retry-after info
 * @returns {number|null} - Seconds to wait, or null
 */
export function getRetryAfter(error) {
  // Check for Retry-After header (common in HTTP 429 responses)
  if (error.response?.headers?.['retry-after']) {
    return parseInt(error.response.headers['retry-after'], 10);
  }

  // Check for rate limit reset timestamp (GitHub API)
  if (error.response?.headers?.['x-ratelimit-reset']) {
    const resetTime = parseInt(error.response.headers['x-ratelimit-reset'], 10);
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, resetTime - now);
  }

  return null;
}
