/**
 * Timeout Handling Utilities
 * 
 * Provides timeout protection for long-running operations,
 * particularly AI provider API calls.
 */

import { AutoFixError } from './error-handler.js';

/**
 * Default timeout values (in milliseconds)
 */
export const DEFAULT_TIMEOUTS = {
  AI_API_CALL: 60000,       // 60 seconds for AI API calls
  GITHUB_API_CALL: 30000,   // 30 seconds for GitHub API
  VALIDATION: 120000,       // 2 minutes for validation commands
  GIT_OPERATION: 30000,     // 30 seconds for git operations
  TOTAL_AGENT: 300000,      // 5 minutes total per agent
};

/**
 * Execute function with timeout
 * @param {Function} fn - Async function to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name for error messages
 * @returns {Promise} - Result or timeout error
 */
export async function withTimeout(fn, timeoutMs, operationName = 'Operation') {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new AutoFixError(
        `${operationName} timed out after ${timeoutMs}ms`,
        'TIMEOUT',
        { timeout: timeoutMs, operation: operationName },
        true // isRetryable
      ));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Execute AI API call with timeout and logging
 * @param {Function} fn - AI API function
 * @param {Object} options - Options
 * @returns {Promise} - AI API result
 */
export async function withAITimeout(fn, options = {}) {
  const {
    timeout = DEFAULT_TIMEOUTS.AI_API_CALL,
    operation = 'AI API call',
    logCost = true,
  } = options;

  const startTime = Date.now();

  try {
    console.error(JSON.stringify({
      level: 'INFO',
      message: `Starting ${operation}`,
      timeout,
      timestamp: new Date().toISOString(),
    }));

    const result = await withTimeout(fn, timeout, operation);
    const duration = Date.now() - startTime;

    // Log completion with cost estimation
    console.error(JSON.stringify({
      level: 'INFO',
      message: `${operation} completed`,
      duration,
      estimatedCost: logCost ? estimateAICost(result, duration) : null,
      timestamp: new Date().toISOString(),
    }));

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      level: 'ERROR',
      message: `${operation} failed`,
      error: error.message,
      duration,
      timeout,
      timestamp: new Date().toISOString(),
    }));

    throw error;
  }
}

/**
 * Estimate AI API cost based on usage
 * @param {Object} result - AI API result
 * @param {number} duration - Duration in ms
 * @returns {Object} - Cost estimate
 */
function estimateAICost(result, duration) {
  // Claude Sonnet pricing (approximate)
  const INPUT_COST_PER_1K = 0.003;  // $3 per million tokens
  const OUTPUT_COST_PER_1K = 0.015; // $15 per million tokens

  const inputTokens = result?.usage?.input_tokens || 0;
  const outputTokens = result?.usage?.output_tokens || 0;

  const inputCost = (inputTokens / 1000) * INPUT_COST_PER_1K;
  const outputCost = (outputTokens / 1000) * OUTPUT_COST_PER_1K;
  const totalCost = inputCost + outputCost;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostUSD: totalCost.toFixed(6),
    duration,
  };
}

/**
 * Execute GitHub API call with timeout
 * @param {Function} fn - GitHub API function
 * @param {string} operation - Operation name
 * @returns {Promise} - GitHub API result
 */
export async function withGitHubTimeout(fn, operation = 'GitHub API call') {
  return withTimeout(fn, DEFAULT_TIMEOUTS.GITHUB_API_CALL, operation);
}

/**
 * Execute validation with extended timeout
 * @param {Function} fn - Validation function
 * @param {string} operation - Operation name
 * @returns {Promise} - Validation result
 */
export async function withValidationTimeout(fn, operation = 'Validation') {
  return withTimeout(fn, DEFAULT_TIMEOUTS.VALIDATION, operation);
}

/**
 * Track total agent execution time
 * @param {Function} fn - Agent main function
 * @param {string} agentName - Agent name
 * @returns {Promise} - Agent result with timing
 */
export async function trackAgentExecution(fn, agentName) {
  const startTime = Date.now();

  console.error(JSON.stringify({
    level: 'INFO',
    message: `Agent started: ${agentName}`,
    timestamp: new Date().toISOString(),
  }));

  try {
    const result = await withTimeout(
      fn,
      DEFAULT_TIMEOUTS.TOTAL_AGENT,
      `${agentName} execution`
    );

    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      level: 'INFO',
      message: `Agent completed: ${agentName}`,
      duration,
      durationSeconds: (duration / 1000).toFixed(2),
      timestamp: new Date().toISOString(),
    }));

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      level: 'ERROR',
      message: `Agent failed: ${agentName}`,
      error: error.message,
      errorCode: error.code || 'UNKNOWN',
      duration,
      timestamp: new Date().toISOString(),
    }));

    throw error;
  }
}

/**
 * Execute multiple operations with individual timeouts
 * @param {Array<Object>} operations - Array of {fn, timeout, name}
 * @returns {Promise<Array>} - Results array
 */
export async function withTimeouts(operations) {
  return Promise.all(
    operations.map(({ fn, timeout, name }) =>
      withTimeout(fn, timeout, name)
    )
  );
}

/**
 * Check if error is a timeout error
 * @param {Error} error - Error to check
 * @returns {boolean} - True if timeout error
 */
export function isTimeoutError(error) {
  return error instanceof AutoFixError && error.code === 'TIMEOUT';
}
