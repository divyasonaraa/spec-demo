/**
 * Risk Assessment Logic
 * 
 * Evaluates the risk level of proposed changes based on:
 * - File sensitivity
 * - Scope of changes
 * - Security flags
 * - Change complexity
 */

import { getFileSensitivityScore, performSecurityCheck } from './security-constraints.js';

/**
 * Risk levels
 */
export const RiskLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
};

/**
 * Scope multipliers for risk calculation
 */
const SCOPE_MULTIPLIERS = {
  SINGLE_FILE: 1.0,
  FEW_FILES: 1.5,    // 2-3 files
  MANY_FILES: 2.0,   // 4-5 files
  EXTENSIVE: 3.0,    // 6+ files
};

/**
 * Calculate scope multiplier based on number of files
 * @param {number} fileCount - Number of affected files
 * @returns {number} - Multiplier
 */
function getScopeMultiplier(fileCount) {
  if (fileCount === 1) return SCOPE_MULTIPLIERS.SINGLE_FILE;
  if (fileCount <= 3) return SCOPE_MULTIPLIERS.FEW_FILES;
  if (fileCount <= 5) return SCOPE_MULTIPLIERS.MANY_FILES;
  return SCOPE_MULTIPLIERS.EXTENSIVE;
}

/**
 * Calculate risk score for a set of files
 * @param {Array<string>} filePaths - Files to be changed
 * @returns {number} - Risk score (0-100)
 */
export function calculateRiskScore(filePaths) {
  if (!filePaths || filePaths.length === 0) {
    return 10; // Default low-medium risk for unspecified changes
  }
  
  // Get sensitivity scores for all files
  const sensitivityScores = filePaths.map(fp => getFileSensitivityScore(fp));
  
  // Calculate average sensitivity
  const avgSensitivity = sensitivityScores.reduce((sum, score) => sum + score, 0) / sensitivityScores.length;
  
  // Apply scope multiplier
  const scopeMultiplier = getScopeMultiplier(filePaths.length);
  
  // Calculate final risk score (0-100 scale)
  const riskScore = Math.min(100, avgSensitivity * 10 * scopeMultiplier);
  
  return Math.round(riskScore);
}

/**
 * Determine risk level from risk score
 * @param {number} riskScore - Risk score (0-100)
 * @returns {string} - Risk level (LOW/MEDIUM/HIGH)
 */
export function getRiskLevel(riskScore) {
  if (riskScore < 30) return RiskLevel.LOW;
  if (riskScore < 60) return RiskLevel.MEDIUM;
  return RiskLevel.HIGH;
}

/**
 * Assess overall risk for an issue
 * @param {string} title - Issue title
 * @param {string} body - Issue body
 * @param {Array<string>} filePaths - Affected file paths
 * @param {string} classification - Issue classification (BUG/FEATURE/etc)
 * @returns {Object} - Risk assessment result
 */
export function assessRisk(title, body, filePaths = [], classification = 'OTHER') {
  // Perform security check
  const securityCheck = performSecurityCheck(title, body, filePaths);
  
  // Calculate risk score
  const riskScore = calculateRiskScore(filePaths);
  
  // Determine base risk level
  let riskLevel = getRiskLevel(riskScore);
  
  // Security flags always elevate to HIGH risk
  if (securityCheck.hasSecurityFlags) {
    riskLevel = RiskLevel.HIGH;
  }
  
  // Determine if auto-fix is allowed
  const autoFixDecision = determineAutoFixDecision(
    riskLevel,
    securityCheck.hasSecurityFlags,
    filePaths.length,
    classification
  );
  
  return {
    risk: riskLevel,
    riskScore,
    securityFlags: securityCheck.hasSecurityFlags,
    securityDetails: securityCheck,
    fileCount: filePaths.length,
    scopeMultiplier: getScopeMultiplier(filePaths.length),
    autoFixDecision,
    reasoning: generateRiskReasoning(riskLevel, securityCheck, filePaths.length, classification),
  };
}

/**
 * Determine if auto-fix should proceed
 * @param {string} riskLevel - Risk level
 * @param {boolean} hasSecurityFlags - Whether security concerns exist
 * @param {number} fileCount - Number of files affected
 * @param {string} classification - Issue classification
 * @returns {string} - Decision: AUTO_FIX, DRAFT_PR, or HUMAN_REVIEW_REQUIRED
 */
function determineAutoFixDecision(riskLevel, hasSecurityFlags, fileCount, classification) {
  // Block auto-fix for security-sensitive changes
  if (hasSecurityFlags) {
    return 'HUMAN_REVIEW_REQUIRED';
  }
  
  // Block auto-fix for HIGH risk
  if (riskLevel === RiskLevel.HIGH) {
    return 'HUMAN_REVIEW_REQUIRED';
  }
  
  // MEDIUM risk gets draft PR for human approval
  if (riskLevel === RiskLevel.MEDIUM) {
    return 'DRAFT_PR';
  }
  
  // LOW risk with reasonable scope gets auto-fix
  if (riskLevel === RiskLevel.LOW && fileCount <= 3) {
    return 'AUTO_FIX';
  }
  
  // Default: require human review
  return 'HUMAN_REVIEW_REQUIRED';
}

/**
 * Generate human-readable reasoning for risk assessment
 * @param {string} riskLevel - Risk level
 * @param {Object} securityCheck - Security check results
 * @param {number} fileCount - Number of files
 * @param {string} classification - Issue classification
 * @returns {string} - Reasoning text
 */
function generateRiskReasoning(riskLevel, securityCheck, fileCount, classification) {
  const reasons = [];
  
  // Risk level explanation
  if (riskLevel === RiskLevel.HIGH) {
    reasons.push('High risk due to sensitive files or extensive scope');
  } else if (riskLevel === RiskLevel.MEDIUM) {
    reasons.push('Medium risk - affects multiple files or moderately sensitive code');
  } else {
    reasons.push('Low risk - simple, isolated change');
  }
  
  // Security concerns
  if (securityCheck.hasSecurityFlags) {
    reasons.push(`Security concerns: ${securityCheck.summary}`);
  }
  
  // Scope
  if (fileCount === 1) {
    reasons.push('Single file modification');
  } else if (fileCount <= 3) {
    reasons.push(`Affects ${fileCount} files`);
  } else {
    reasons.push(`Extensive change affecting ${fileCount} files`);
  }
  
  // Classification context
  if (classification === 'DOCS') {
    reasons.push('Documentation change (typically safe)');
  } else if (classification === 'BUG') {
    reasons.push('Bug fix (requires validation)');
  } else if (classification === 'FEATURE') {
    reasons.push('New feature (requires thorough review)');
  }
  
  return reasons.join('; ');
}

/**
 * Extract file paths mentioned in issue text
 * @param {string} text - Issue title and body combined
 * @returns {Array<string>} - Extracted file paths
 */
export function extractFilePaths(text) {
  const filePaths = [];
  
  // Match common file path patterns
  const patterns = [
    // Code blocks with file names
    /`([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)`/g,
    // Quoted paths
    /"([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)"/g,
    // Markdown file links
    /\[.*?\]\(([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)\)/g,
    // Raw paths (more conservative)
    /(?:^|\s)((?:[a-zA-Z0-9_\-]+\/)+[a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+)(?:\s|$)/gm,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const path = match[1];
      // Filter out URLs and other false positives
      if (path && !path.startsWith('http') && !filePaths.includes(path)) {
        filePaths.push(path);
      }
    }
  }
  
  return [...new Set(filePaths)]; // Remove duplicates
}

/**
 * Validate that risk assessment is complete and correct
 * @param {Object} assessment - Risk assessment result
 * @returns {boolean} - True if valid
 */
export function validateRiskAssessment(assessment) {
  if (!assessment) return false;
  
  const requiredFields = ['risk', 'riskScore', 'securityFlags', 'autoFixDecision', 'reasoning'];
  const hasAllFields = requiredFields.every(field => field in assessment);
  
  if (!hasAllFields) return false;
  
  // Validate risk level
  if (!Object.values(RiskLevel).includes(assessment.risk)) return false;
  
  // Validate risk score range
  if (assessment.riskScore < 0 || assessment.riskScore > 100) return false;
  
  // Validate auto-fix decision
  const validDecisions = ['AUTO_FIX', 'DRAFT_PR', 'HUMAN_REVIEW_REQUIRED'];
  if (!validDecisions.includes(assessment.autoFixDecision)) return false;
  
  return true;
}
