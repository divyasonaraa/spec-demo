/**
 * Exponential Backoff Retry Logic
 * 
 * Implements retry mechanism with exponential backoff and jitter
 * for handling transient failures in API calls.
 */

import { AutoFixError, isRateLimitError, getRetryAfter, logError } from './error-handler.js';

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 32000, // 32 seconds
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Calculate delay for next retry
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {Object} config - Retry configuration
 * @returns {number} - Delay in milliseconds
 */
function calculateDelay(attempt, config) {
  // Exponential backoff: baseDelay * (multiplier ^ attempt)
  let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
  
  // Cap at maxDelay
  delay = Math.min(delay, config.maxDelay);
  
  // Add jitter (randomness to prevent thundering herd)
  if (config.jitter) {
    const jitterAmount = delay * 0.3; // ±30% jitter
    delay = delay + (Math.random() * jitterAmount * 2 - jitterAmount);
  }
  
  return Math.floor(delay);
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean} - True if should retry
 */
function shouldRetry(error) {
  // Always retry rate limit errors
  if (isRateLimitError(error)) {
    return true;
  }
  
  // Retry AutoFixError if marked as retryable
  if (error instanceof AutoFixError && error.isRetryable()) {
    return true;
  }
  
  // Retry on network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return true;
  }
  
  // Retry on 5xx server errors
  if (error.status >= 500 && error.status < 600) {
    return true;
  }
  
  // Don't retry 4xx client errors (except 429 rate limit)
  if (error.status >= 400 && error.status < 500) {
    return false;
  }
  
  // Default: retry
  return true;
}

/**
 * Execute function with exponential backoff retry
 * @param {Function} fn - Async function to execute
 * @param {Object} config - Retry configuration (optional)
 * @returns {Promise} - Result of function or final error
 */
export async function retryWithBackoff(fn, config = {}) {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError;
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // Attempt the operation
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt === retryConfig.maxRetries || !shouldRetry(error)) {
        // Max retries reached or non-retryable error
        throw error;
      }
      
      // Calculate delay
      let delay = calculateDelay(attempt, retryConfig);
      
      // Check for rate limit specific delay
      if (isRateLimitError(error)) {
        const retryAfter = getRetryAfter(error);
        if (retryAfter !== null) {
          delay = retryAfter * 1000; // Convert seconds to ms
        }
      }
      
      // Log retry attempt
      console.error(JSON.stringify({
        level: 'WARN',
        message: `Retry attempt ${attempt + 1}/${retryConfig.maxRetries}`,
        error: error.message,
        delay,
        timestamp: new Date().toISOString(),
      }));
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  // This should never be reached, but just in case
  throw lastError;
}

/**
 * Execute multiple functions in parallel with retries
 * @param {Array<Function>} fns - Array of async functions
 * @param {Object} config - Retry configuration (optional)
 * @returns {Promise<Array>} - Array of results
 */
export async function retryAllWithBackoff(fns, config = {}) {
  const promises = fns.map(fn => retryWithBackoff(fn, config));
  return Promise.all(promises);
}

/**
 * Execute function with retry only on specific error codes
 * @param {Function} fn - Async function to execute
 * @param {Array<string>} retryCodes - Error codes to retry on
 * @param {Object} config - Retry configuration (optional)
 * @returns {Promise} - Result of function or final error
 */
export async function retryOnCodes(fn, retryCodes, config = {}) {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError;
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if error code matches retry codes
      const errorCode = error instanceof AutoFixError ? error.code : error.code;
      const shouldRetryThisError = retryCodes.includes(errorCode);
      
      if (attempt === retryConfig.maxRetries || !shouldRetryThisError) {
        throw error;
      }
      
      const delay = calculateDelay(attempt, retryConfig);
      
      console.error(JSON.stringify({
        level: 'WARN',
        message: `Retrying on error code ${errorCode}`,
        attempt: attempt + 1,
        maxRetries: retryConfig.maxRetries,
        delay,
        timestamp: new Date().toISOString(),
      }));
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Create a retry-wrapped version of a function
 * @param {Function} fn - Function to wrap
 * @param {Object} config - Retry configuration (optional)
 * @returns {Function} - Wrapped function with retry logic
 */
export function withRetry(fn, config = {}) {
  return async (...args) => {
    return retryWithBackoff(() => fn(...args), config);
  };
}

/**
 * Execute function with limited concurrent retries
 * @param {Array<Function>} fns - Array of async functions
 * @param {number} concurrency - Max concurrent executions
 * @param {Object} config - Retry configuration (optional)
 * @returns {Promise<Array>} - Array of results
 */
export async function retryWithConcurrency(fns, concurrency = 3, config = {}) {
  const results = [];
  const executing = [];
  
  for (const [index, fn] of fns.entries()) {
    const promise = retryWithBackoff(fn, config).then(result => {
      results[index] = result;
      executing.splice(executing.indexOf(promise), 1);
    });
    
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
  return results;
}

/**
 * Get retry statistics for monitoring
 * @param {Function} fn - Function to track
 * @param {Object} config - Retry configuration (optional)
 * @returns {Promise<Object>} - Result with retry stats
 */
export async function retryWithStats(fn, config = {}) {
  const stats = {
    attempts: 0,
    totalDelay: 0,
    errors: [],
    success: false,
    startTime: Date.now(),
  };
  
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    stats.attempts = attempt + 1;
    
    try {
      const result = await fn();
      stats.success = true;
      stats.endTime = Date.now();
      stats.duration = stats.endTime - stats.startTime;
      return { result, stats };
    } catch (error) {
      stats.errors.push({
        attempt: attempt + 1,
        message: error.message,
        code: error.code || 'UNKNOWN',
      });
      
      if (attempt === retryConfig.maxRetries || !shouldRetry(error)) {
        stats.endTime = Date.now();
        stats.duration = stats.endTime - stats.startTime;
        throw error;
      }
      
      const delay = calculateDelay(attempt, retryConfig);
      stats.totalDelay += delay;
      
      await sleep(delay);
    }
  }
}
