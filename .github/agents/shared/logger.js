/**
 * Structured Logging Utility
 * 
 * Provides consistent JSON logging to stderr for observability
 * in GitHub Actions and local development.
 */

/**
 * Log levels
 */
export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  FATAL: 'FATAL',
};

/**
 * Log a structured message to stderr
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
function log(level, message, metadata = {}) {
  const logEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  console.error(JSON.stringify(logEntry));
}

/**
 * Debug level logging
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
export function debug(message, metadata = {}) {
  log(LogLevel.DEBUG, message, metadata);
}

/**
 * Info level logging
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
export function info(message, metadata = {}) {
  log(LogLevel.INFO, message, metadata);
}

/**
 * Warning level logging
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
export function warn(message, metadata = {}) {
  log(LogLevel.WARN, message, metadata);
}

/**
 * Error level logging
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
export function error(message, metadata = {}) {
  log(LogLevel.ERROR, message, metadata);
}

/**
 * Fatal level logging
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
export function fatal(message, metadata = {}) {
  log(LogLevel.FATAL, message, metadata);
}

/**
 * Log operation start
 * @param {string} operation - Operation name
 * @param {Object} metadata - Additional metadata
 */
export function startOperation(operation, metadata = {}) {
  info(`Starting: ${operation}`, {
    operation,
    status: 'started',
    ...metadata,
  });
}

/**
 * Log operation success
 * @param {string} operation - Operation name
 * @param {number} startTime - Operation start timestamp
 * @param {Object} metadata - Additional metadata
 */
export function completeOperation(operation, startTime, metadata = {}) {
  const duration = Date.now() - startTime;
  info(`Completed: ${operation}`, {
    operation,
    status: 'completed',
    duration,
    durationSeconds: (duration / 1000).toFixed(2),
    ...metadata,
  });
}

/**
 * Log operation failure
 * @param {string} operation - Operation name
 * @param {Error} err - Error object
 * @param {number} startTime - Operation start timestamp
 * @param {Object} metadata - Additional metadata
 */
export function failOperation(operation, err, startTime, metadata = {}) {
  const duration = Date.now() - startTime;
  error(`Failed: ${operation}`, {
    operation,
    status: 'failed',
    error: err.message,
    errorCode: err.code || 'UNKNOWN',
    errorStack: err.stack,
    duration,
    ...metadata,
  });
}

/**
 * Log API call (GitHub, AI, etc.)
 * @param {string} apiName - API name
 * @param {string} endpoint - Endpoint or operation
 * @param {Object} metadata - Additional metadata
 */
export function logAPICall(apiName, endpoint, metadata = {}) {
  debug(`API Call: ${apiName}`, {
    api: apiName,
    endpoint,
    ...metadata,
  });
}

/**
 * Log API response
 * @param {string} apiName - API name
 * @param {string} endpoint - Endpoint or operation
 * @param {number} statusCode - HTTP status code
 * @param {number} duration - Duration in ms
 * @param {Object} metadata - Additional metadata
 */
export function logAPIResponse(apiName, endpoint, statusCode, duration, metadata = {}) {
  info(`API Response: ${apiName}`, {
    api: apiName,
    endpoint,
    statusCode,
    duration,
    durationSeconds: (duration / 1000).toFixed(2),
    ...metadata,
  });
}

/**
 * Log cost estimation
 * @param {string} service - Service name (e.g., 'Claude API')
 * @param {Object} usage - Usage details
 */
export function logCost(service, usage) {
  info(`Cost Tracking: ${service}`, {
    service,
    costTracking: true,
    ...usage,
  });
}

/**
 * Log retry attempt
 * @param {number} attempt - Attempt number
 * @param {number} maxRetries - Max retries
 * @param {string} reason - Reason for retry
 * @param {number} delay - Delay before retry in ms
 */
export function logRetry(attempt, maxRetries, reason, delay) {
  warn(`Retry attempt ${attempt}/${maxRetries}`, {
    retry: true,
    attempt,
    maxRetries,
    reason,
    delay,
    delaySeconds: (delay / 1000).toFixed(2),
  });
}

/**
 * Log rate limit hit
 * @param {string} api - API name
 * @param {number} resetTime - Reset timestamp
 * @param {number} retryAfter - Retry after seconds
 */
export function logRateLimit(api, resetTime, retryAfter) {
  warn(`Rate limit hit: ${api}`, {
    rateLimit: true,
    api,
    resetTime: new Date(resetTime * 1000).toISOString(),
    retryAfter,
    retryAfterSeconds: retryAfter,
  });
}

/**
 * Log validation result
 * @param {boolean} passed - Whether validation passed
 * @param {Array} errors - Validation errors
 * @param {number} duration - Duration in ms
 */
export function logValidation(passed, errors = [], duration = 0) {
  const level = passed ? LogLevel.INFO : LogLevel.ERROR;
  log(level, `Validation ${passed ? 'passed' : 'failed'}`, {
    validation: true,
    passed,
    errorCount: errors.length,
    errors: errors.slice(0, 10), // Limit to first 10
    duration,
  });
}

/**
 * Log security check result
 * @param {boolean} blocked - Whether auto-fix was blocked
 * @param {Object} flags - Security flags
 */
export function logSecurityCheck(blocked, flags = {}) {
  const level = blocked ? LogLevel.WARN : LogLevel.INFO;
  log(level, `Security check ${blocked ? 'blocked auto-fix' : 'passed'}`, {
    securityCheck: true,
    blocked,
    ...flags,
  });
}

/**
 * Log GitHub issue event
 * @param {string} action - Action taken
 * @param {number} issueNumber - Issue number
 * @param {Object} metadata - Additional metadata
 */
export function logIssueEvent(action, issueNumber, metadata = {}) {
  info(`Issue ${action}: #${issueNumber}`, {
    issue: issueNumber,
    action,
    ...metadata,
  });
}

/**
 * Log PR event
 * @param {string} action - Action taken
 * @param {number} prNumber - PR number
 * @param {Object} metadata - Additional metadata
 */
export function logPREvent(action, prNumber, metadata = {}) {
  info(`PR ${action}: #${prNumber}`, {
    pr: prNumber,
    action,
    ...metadata,
  });
}

/**
 * Log git operation
 * @param {string} operation - Git operation
 * @param {Object} metadata - Additional metadata
 */
export function logGitOperation(operation, metadata = {}) {
  debug(`Git: ${operation}`, {
    git: true,
    operation,
    ...metadata,
  });
}

/**
 * Create a logger context for an agent
 * @param {string} agentName - Agent name
 * @returns {Object} - Logger with agent context
 */
export function createAgentLogger(agentName) {
  return {
    debug: (message, metadata = {}) => debug(message, { agent: agentName, ...metadata }),
    info: (message, metadata = {}) => info(message, { agent: agentName, ...metadata }),
    warn: (message, metadata = {}) => warn(message, { agent: agentName, ...metadata }),
    error: (message, metadata = {}) => error(message, { agent: agentName, ...metadata }),
    fatal: (message, metadata = {}) => fatal(message, { agent: agentName, ...metadata }),

    startOperation: (operation, metadata = {}) =>
      startOperation(operation, { agent: agentName, ...metadata }),
    completeOperation: (operation, startTime, metadata = {}) =>
      completeOperation(operation, startTime, { agent: agentName, ...metadata }),
    failOperation: (operation, err, startTime, metadata = {}) =>
      failOperation(operation, err, startTime, { agent: agentName, ...metadata }),
  };
}

/**
 * Log agent summary
 * @param {string} agentName - Agent name
 * @param {Object} summary - Summary data
 */
export function logAgentSummary(agentName, summary) {
  info(`Agent Summary: ${agentName}`, {
    agent: agentName,
    summary: true,
    ...summary,
  });
}
