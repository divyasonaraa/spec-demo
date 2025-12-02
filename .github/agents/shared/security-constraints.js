/**
 * Security Constraints for Auto-Fix System
 * 
 * Defines patterns that identify security-sensitive changes.
 * These constraints are used by the triage agent to assess risk
 * and block auto-fix for dangerous operations.
 */

/**
 * Keyword patterns that indicate security-sensitive content
 * These are checked in issue title, body, and file content
 */
export const SECURITY_KEYWORDS = [
  // Authentication & Authorization
  /\b(password|passwd|pwd)\b/i,
  /\b(secret|api[_\s-]?key|access[_\s-]?key)\b/i,
  /\b(token|bearer|jwt|oauth)\b/i,
  /\b(credential|auth|authentication|authorization)\b/i,
  /\b(private[_\s-]?key|public[_\s-]?key)\b/i,
  /\b(certificate|cert|ssl|tls)\b/i,
  
  // Sensitive Data
  /\b(ssn|social[_\s-]?security)\b/i,
  /\b(credit[_\s-]?card|ccn|cvv)\b/i,
  /\b(encryption|decrypt|cipher)\b/i,
  
  // Security Operations
  /\b(security|vulnerability|exploit)\b/i,
  /\b(permission|role|privilege)\b/i,
  /\b(session|cookie)\b/i,
  
  // Infrastructure
  /\b(database[_\s-]?url|db[_\s-]?connection)\b/i,
  /\b(connection[_\s-]?string)\b/i,
  /\b(admin|root|sudo)\b/i,
];

/**
 * File path patterns that indicate security-sensitive files
 * These are glob patterns matched against file paths
 */
export const SECURITY_FILE_PATTERNS = [
  // Environment & Configuration
  /\.env/i,
  /\.env\./i,
  /config\/secrets/i,
  /config\/credentials/i,
  
  // Keys & Certificates
  /\.pem$/i,
  /\.key$/i,
  /\.crt$/i,
  /\.cer$/i,
  /\.p12$/i,
  /\.pfx$/i,
  
  // Authentication Files
  /auth/i,
  /login/i,
  /session/i,
  /oauth/i,
  /jwt/i,
  
  // Deployment & Infrastructure
  /deploy/i,
  /terraform/i,
  /cloudformation/i,
  /kubernetes/i,
  /k8s/i,
  /docker-compose\.prod/i,
  
  // Database
  /migration/i,
  /schema/i,
  /seed/i,
  
  // Security-specific
  /security/i,
  /permissions/i,
  /roles/i,
  /\.htaccess/i,
  /\.htpasswd/i,
];

/**
 * Change type patterns that indicate risky operations
 * These describe the nature of the change itself
 */
export const RISKY_CHANGE_TYPES = [
  {
    name: 'DATABASE_MIGRATION',
    patterns: [
      /database\s+migration/i,
      /alter\s+table/i,
      /drop\s+(table|column|database)/i,
      /create\s+table/i,
      /add\s+column/i,
    ],
    reason: 'Database schema changes can cause data loss or system downtime',
  },
  {
    name: 'DEPENDENCY_CHANGE',
    patterns: [
      /package\.json/i,
      /requirements\.txt/i,
      /Gemfile/i,
      /go\.mod/i,
      /Cargo\.toml/i,
    ],
    reason: 'Dependency changes can introduce vulnerabilities or breaking changes',
  },
  {
    name: 'BUILD_CONFIGURATION',
    patterns: [
      /webpack\.config/i,
      /vite\.config/i,
      /rollup\.config/i,
      /tsconfig\.json/i,
      /babel\.config/i,
    ],
    reason: 'Build configuration changes can break production builds',
  },
  {
    name: 'CI_CD_PIPELINE',
    patterns: [
      /\.github\/workflows/i,
      /\.gitlab-ci\.yml/i,
      /\.circleci/i,
      /jenkinsfile/i,
    ],
    reason: 'CI/CD changes can break deployment pipelines',
  },
  {
    name: 'BINARY_COMPILATION',
    patterns: [
      /Makefile/i,
      /CMakeLists\.txt/i,
      /\.c$/i,
      /\.cpp$/i,
      /\.h$/i,
    ],
    reason: 'Binary compilation changes require careful testing',
  },
];

/**
 * File sensitivity scoring (used in risk assessment)
 * Higher scores = more sensitive
 */
export const FILE_SENSITIVITY_SCORES = {
  // Critical files
  '.env': 10,
  '.env.production': 10,
  'config/secrets.js': 10,
  'auth.js': 9,
  'login.js': 9,
  
  // High sensitivity
  'package.json': 8,
  'docker-compose.yml': 7,
  'Dockerfile': 7,
  
  // Medium sensitivity
  'tsconfig.json': 5,
  'vite.config.js': 5,
  'webpack.config.js': 5,
  
  // Low sensitivity
  '.md': 1,
  '.txt': 1,
  'README.md': 1,
  'CHANGELOG.md': 1,
};

/**
 * Check if text contains security-sensitive keywords
 * @param {string} text - Text to check (issue title, body, etc.)
 * @returns {Array<{keyword: string, pattern: RegExp}>} - Matched security keywords
 */
export function checkSecurityKeywords(text) {
  const matches = [];
  
  for (const pattern of SECURITY_KEYWORDS) {
    if (pattern.test(text)) {
      matches.push({
        keyword: pattern.source,
        pattern: pattern,
      });
    }
  }
  
  return matches;
}

/**
 * Check if file path matches security-sensitive patterns
 * @param {string} filePath - File path to check
 * @returns {Array<{pattern: RegExp}>} - Matched file patterns
 */
export function checkSecurityFilePath(filePath) {
  const matches = [];
  
  for (const pattern of SECURITY_FILE_PATTERNS) {
    if (pattern.test(filePath)) {
      matches.push({
        pattern: pattern,
      });
    }
  }
  
  return matches;
}

/**
 * Check if change description matches risky change types
 * @param {string} description - Change description (issue title/body)
 * @param {Array<string>} filePaths - Affected file paths
 * @returns {Array<{type: string, reason: string}>} - Matched risky change types
 */
export function checkRiskyChangeTypes(description, filePaths = []) {
  const matches = [];
  
  for (const changeType of RISKY_CHANGE_TYPES) {
    // Check description against patterns
    const descriptionMatch = changeType.patterns.some(pattern => pattern.test(description));
    
    // Check file paths against patterns
    const fileMatch = filePaths.some(filePath =>
      changeType.patterns.some(pattern => pattern.test(filePath))
    );
    
    if (descriptionMatch || fileMatch) {
      matches.push({
        type: changeType.name,
        reason: changeType.reason,
      });
    }
  }
  
  return matches;
}

/**
 * Get sensitivity score for a file
 * @param {string} filePath - File path to score
 * @returns {number} - Sensitivity score (0-10)
 */
export function getFileSensitivityScore(filePath) {
  // Check exact matches first
  for (const [pattern, score] of Object.entries(FILE_SENSITIVITY_SCORES)) {
    if (filePath.endsWith(pattern)) {
      return score;
    }
  }
  
  // Check security file patterns
  const securityMatches = checkSecurityFilePath(filePath);
  if (securityMatches.length > 0) {
    return 8; // High sensitivity for security-related files
  }
  
  // Default sensitivity based on file type
  if (filePath.endsWith('.md') || filePath.endsWith('.txt')) {
    return 1; // Documentation is low risk
  }
  
  if (filePath.includes('test/') || filePath.includes('spec/')) {
    return 2; // Test files are low-medium risk
  }
  
  if (filePath.includes('config/') || filePath.includes('.config.')) {
    return 6; // Config files are medium-high risk
  }
  
  return 4; // Default medium risk
}

/**
 * Comprehensive security check
 * @param {string} title - Issue title
 * @param {string} body - Issue body
 * @param {Array<string>} filePaths - Affected file paths
 * @returns {Object} - Security check result
 */
export function performSecurityCheck(title, body, filePaths = []) {
  const combinedText = `${title} ${body}`;
  
  const keywordMatches = checkSecurityKeywords(combinedText);
  const fileMatches = filePaths.flatMap(fp => checkSecurityFilePath(fp));
  const riskyChangeMatches = checkRiskyChangeTypes(combinedText, filePaths);
  
  const hasSecurityFlags = 
    keywordMatches.length > 0 || 
    fileMatches.length > 0 || 
    riskyChangeMatches.length > 0;
  
  return {
    hasSecurityFlags,
    keywordMatches,
    fileMatches,
    riskyChangeMatches,
    summary: hasSecurityFlags
      ? `Security concerns detected: ${keywordMatches.length} keywords, ${fileMatches.length} sensitive files, ${riskyChangeMatches.length} risky change types`
      : 'No security concerns detected',
  };
}
