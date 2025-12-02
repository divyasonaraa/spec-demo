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
  
  let markdown = `## ⚠️ Auto-Fix Failed\n\n`;
  markdown += `The ${agent} agent encountered an error:\n\n`;
  markdown += `**Error**: ${error.message}\n\n`;
  
  if (isAutoFixError) {
    markdown += `**Error Code**: \`${error.code}\`\n\n`;
    
    if (error.isRetryable()) {
      markdown += `This error is retryable. The workflow may retry automatically.\n\n`;
    }
    
    if (Object.keys(error.context).length > 0) {
      markdown += `<details>\n<summary>Error Details</summary>\n\n`;
      markdown += `\`\`\`json\n${JSON.stringify(error.context, null, 2)}\n\`\`\`\n\n`;
      markdown += `</details>\n\n`;
    }
  }
  
  markdown += `### What to do next\n\n`;
  
  // Provide guidance based on error type
  if (isAutoFixError) {
    switch (error.code) {
      case ErrorCodes.SECURITY_VIOLATION:
        markdown += `- This issue involves security-sensitive changes that require human review\n`;
        markdown += `- A maintainer should manually review and implement the fix\n`;
        break;
        
      case ErrorCodes.VALIDATION_FAILED:
        markdown += `- The generated fix did not pass validation checks\n`;
        markdown += `- Review the validation errors and fix manually\n`;
        break;
        
      case ErrorCodes.GITHUB_RATE_LIMIT:
        markdown += `- GitHub API rate limit reached\n`;
        markdown += `- Wait for rate limit reset and try again\n`;
        break;
        
      case ErrorCodes.GIT_CONFLICT:
        markdown += `- Merge conflict detected\n`;
        markdown += `- Manual resolution required\n`;
        break;
        
      default:
        markdown += `- Review the error details above\n`;
        markdown += `- A maintainer should investigate and fix manually\n`;
    }
  } else {
    markdown += `- Review the error message above\n`;
    markdown += `- A maintainer should investigate and fix manually\n`;
  }
  
  markdown += `\n---\n`;
  markdown += `*Auto-fix workflow failed at ${new Date().toISOString()}*`;
  
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
