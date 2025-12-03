#!/usr/bin/env node

/**
 * Triage Agent
 * 
 * Automatically classifies GitHub issues, assesses risk, and applies labels.
 * 
 * Performance target: < 30 seconds
 * 
 * Input: GitHub issue (from webhook payload)
 * Output: TriageResult with classification, risk level, and auto-fix decision
 */

import { writeFileSync } from 'fs';
import { createGitHubClient, getIssue, postComment, addLabels } from './shared/github-client.js';
import { createAIClient, classifyIssue } from './shared/ai-client.js';
import { assessRisk, extractFilePaths } from './shared/risk-assessment.js';
import { performSecurityCheck } from './shared/security-constraints.js';
import { AutoFixError, ErrorCodes, formatErrorForComment, logError, withTimeout } from './shared/error-handler.js';
import { createAgentLogger, logAgentSummary } from './shared/logger.js';
import { trackAgentExecution } from './shared/timeout.js';

const logger = createAgentLogger('triage-agent');

/**
 * Check if issue has already been triaged
 * @param {Object} issue - GitHub issue object
 * @returns {Object|null} - Previous triage result if found, null otherwise
 */
function checkIdempotency(issue) {
  // Check for auto-triage label
  const hasTriageLabel = issue.labels.some(label => label.name === 'auto-triage');

  // Check for existing classification labels
  const classificationLabels = ['bug', 'feature', 'docs', 'chore'];
  const hasClassification = issue.labels.some(label =>
    classificationLabels.includes(label.name)
  );

  // Check for risk labels
  const riskLabels = ['low-risk', 'medium-risk', 'high-risk'];
  const hasRisk = issue.labels.some(label => riskLabels.includes(label.name));

  if (hasTriageLabel && hasClassification && hasRisk) {
    logger.info('Issue already triaged, skipping', {
      issueNumber: issue.number,
      labels: issue.labels.map(l => l.name),
    });

    return {
      alreadyProcessed: true,
      labels: issue.labels.map(l => l.name),
    };
  }

  return null;
}

/**
 * Check if issue author is a bot
 * @param {Object} issue - GitHub issue object
 * @returns {boolean} - True if bot-created
 */
function isBotCreated(issue) {
  // Check username for [bot] suffix
  if (issue.user.login.endsWith('[bot]')) {
    return true;
  }

  // Check for created-by-autofix label
  const hasAutofixLabel = issue.labels.some(label => label.name === 'created-by-autofix');
  if (hasAutofixLabel) {
    return true;
  }

  // Check user type
  if (issue.user.type === 'Bot') {
    return true;
  }

  return false;
}

/**
 * Perform keyword-based classification (fast path)
 * @param {string} title - Issue title
 * @param {string} body - Issue body
 * @returns {Object|null} - Classification result or null if ambiguous
 */
function keywordClassification(title, body) {
  const text = `${title} ${body}`.toLowerCase();

  // BUG patterns
  const bugPatterns = [
    /\b(bug|error|issue|broken|crash|fail|exception|incorrect|wrong)\b/i,
    /\b(not working|doesn't work|does not work)\b/i,
    /\b(fix|resolve|repair)\b/i,
  ];

  // FEATURE patterns
  const featurePatterns = [
    /\b(feature|enhancement|improve|add|implement|support)\b/i,
    /\b(request|proposal|suggestion)\b/i,
    /\b(would like|could we|can we)\b/i,
  ];

  // DOCS patterns
  const docsPatterns = [
    /\b(doc|documentation|readme|guide|tutorial)\b/i,
    /\b(typo|spelling|grammar)\b/i,
    /\b(clarify|explain|example)\b/i,
  ];

  // CHORE patterns
  const chorePatterns = [
    /\b(chore|refactor|cleanup|maintenance|update|upgrade)\b/i,
    /\b(dependency|dependencies|package)\b/i,
    /\b(lint|format|style)\b/i,
  ];

  // Count matches for each category
  const scores = {
    BUG: bugPatterns.filter(p => p.test(text)).length,
    FEATURE: featurePatterns.filter(p => p.test(text)).length,
    DOCS: docsPatterns.filter(p => p.test(text)).length,
    CHORE: chorePatterns.filter(p => p.test(text)).length,
  };

  // Find highest score
  const maxScore = Math.max(...Object.values(scores));

  // If no clear winner or score too low, return null (ambiguous)
  if (maxScore === 0 || Object.values(scores).filter(s => s === maxScore).length > 1) {
    return null;
  }

  const classification = Object.keys(scores).find(k => scores[k] === maxScore);

  return {
    classification,
    confidence: Math.min(0.9, 0.5 + (maxScore * 0.15)), // Cap at 0.9 for keyword-based
    reasoning: `Keyword-based classification: found ${maxScore} ${classification.toLowerCase()} indicators`,
  };
}

/**
 * Classify issue using keyword matching with LLM fallback
 * @param {Object} aiClient - AI client
 * @param {string} title - Issue title
 * @param {string} body - Issue body
 * @returns {Promise<Object>} - Classification result
 */
async function classifyIssueWithFallback(aiClient, title, body) {
  // Try keyword-based classification first (fast)
  const keywordResult = keywordClassification(title, body);

  if (keywordResult && keywordResult.confidence >= 0.7) {
    console.error(JSON.stringify({
      level: 'INFO',
      message: 'Using keyword-based classification',
      classification: keywordResult.classification,
      confidence: keywordResult.confidence,
      timestamp: new Date().toISOString(),
    }));

    return keywordResult;
  }

  // Fallback to LLM for ambiguous cases
  console.error(JSON.stringify({
    level: 'INFO',
    message: 'Using LLM fallback classification',
    reason: keywordResult ? 'Low confidence' : 'Ambiguous keywords',
    timestamp: new Date().toISOString(),
  }));

  const llmResult = await classifyIssue(aiClient, title, body);

  return {
    classification: llmResult.classification,
    confidence: llmResult.confidence,
    reasoning: `LLM classification: ${llmResult.reasoning}`,
  };
}

/**
 * Generate labels to apply based on triage result
 * @param {Object} triageResult - Triage result
 * @returns {Array<string>} - Label names
 */
function generateLabels(triageResult) {
  const labels = ['auto-triage'];

  // Add classification label
  labels.push(triageResult.classification.toLowerCase());

  // Add risk level label
  labels.push(`${triageResult.risk.toLowerCase()}-risk`);

  // Add security label if flagged
  if (triageResult.securityFlags) {
    labels.push('security');
  }

  // Add review requirement label
  if (triageResult.autoFixDecision === 'HUMAN_REVIEW_REQUIRED') {
    labels.push('human-review-required');
  }

  return labels;
}

/**
 * Format triage result as markdown comment
 * @param {Object} triageResult - Triage result
 * @returns {string} - Markdown formatted comment
 */
function formatTriageComment(triageResult) {
  let markdown = `## 🤖 Auto-Triage Complete\n\n`;

  // Classification
  markdown += `**Classification**: ${triageResult.classification} (${Math.round(triageResult.confidence * 100)}% confidence)\n\n`;

  // Risk assessment
  const riskEmoji = {
    LOW: '🟢',
    MEDIUM: '🟡',
    HIGH: '🔴',
  };

  markdown += `**Risk Level**: ${riskEmoji[triageResult.risk]} ${triageResult.risk} (score: ${triageResult.riskScore}/100)\n\n`;

  // Security flags
  if (triageResult.securityFlags) {
    markdown += `**⚠️ Security Concerns Detected**\n\n`;
    markdown += `${triageResult.securityDetails.summary}\n\n`;

    // Show detailed security findings
    if (triageResult.securityDetails.keywordMatches.length > 0) {
      markdown += `- **Keywords**: ${triageResult.securityDetails.keywordMatches.length} security-sensitive keyword(s) detected\n`;
    }
    if (triageResult.securityDetails.fileMatches.length > 0) {
      markdown += `- **Files**: ${triageResult.securityDetails.fileMatches.length} sensitive file(s) identified\n`;
    }
    if (triageResult.securityDetails.riskyChangeMatches.length > 0) {
      markdown += `- **Change Types**: ${triageResult.securityDetails.riskyChangeMatches.map(m => m.type).join(', ')}\n`;
    }
    markdown += `\n`;
  }

  // Auto-fix decision
  markdown += `**Auto-Fix Decision**: `;
  switch (triageResult.autoFixDecision) {
    case 'AUTO_FIX':
      markdown += `✅ Approved for automatic fix\n\n`;
      markdown += `This issue will be automatically fixed and a PR will be created.\n\n`;
      break;
    case 'DRAFT_PR':
      markdown += `📝 Draft PR will be created\n\n`;
      markdown += `This issue requires human review before merging. A draft PR will be created for your review.\n\n`;
      break;
    case 'HUMAN_REVIEW_REQUIRED':
      markdown += `👤 Human review required\n\n`;
      markdown += `This issue cannot be automatically fixed. A maintainer should review and implement manually.\n\n`;
      break;
  }

  // Reasoning
  markdown += `**Reasoning**: ${triageResult.reasoning}\n\n`;

  // Affected files
  if (triageResult.affectedFiles.length > 0) {
    markdown += `**Affected Files** (${triageResult.affectedFiles.length}):\n`;
    triageResult.affectedFiles.forEach(file => {
      markdown += `- \`${file}\`\n`;
    });
    markdown += `\n`;
  }

  // Details section (collapsible)
  markdown += `<details>\n<summary>Triage Details (JSON)</summary>\n\n`;
  markdown += `\`\`\`json\n${JSON.stringify(triageResult, null, 2)}\n\`\`\`\n\n`;
  markdown += `</details>\n\n`;

  markdown += `---\n`;
  markdown += `*Triaged at ${triageResult.timestamp}*`;

  return markdown;
}

/**
 * Main triage function
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 * @returns {Promise<Object>} - Triage result
 */
async function triageIssue(owner, repo, issueNumber) {
  const startTime = Date.now();

  logger.startOperation('triageIssue', {
    repository: `${owner}/${repo}`,
    issueNumber,
  });

  // Initialize clients
  const githubClient = createGitHubClient();
  const aiClient = createAIClient();

  // Fetch issue details
  const issue = await getIssue(githubClient, owner, repo, issueNumber);

  // Check if already triaged (idempotency)
  const previousTriage = checkIdempotency(issue);
  if (previousTriage) {
    return {
      success: true,
      alreadyProcessed: true,
      message: 'Issue already triaged',
      labels: previousTriage.labels,
    };
  }

  // Check if bot-created (skip processing)
  if (isBotCreated(issue)) {
    logger.info('Skipping bot-created issue', {
      issueNumber,
      author: issue.user.login,
    });

    return {
      success: false,
      skipped: true,
      reason: 'Bot-created issue',
    };
  }

  // Extract text for analysis
  const title = issue.title;
  const body = issue.body || '';
  const combinedText = `${title}\n\n${body}`;

  // Step 1: Classify issue
  const classificationResult = await classifyIssueWithFallback(aiClient, title, body);

  // Step 2: Extract affected files from issue body
  const affectedFiles = extractFilePaths(combinedText);

  // Step 3: Perform security check
  const securityCheck = performSecurityCheck(title, body, affectedFiles);

  // Step 4: Assess risk
  const riskAssessment = assessRisk(title, body, affectedFiles, classificationResult.classification);

  // Build triage result
  const triageResult = {
    classification: classificationResult.classification,
    confidence: classificationResult.confidence,
    risk: riskAssessment.risk,
    riskScore: riskAssessment.riskScore,
    securityFlags: securityCheck.hasSecurityFlags,
    securityDetails: securityCheck,
    affectedFiles: affectedFiles,
    autoFixDecision: riskAssessment.autoFixDecision,
    reasoning: `${classificationResult.reasoning}; ${riskAssessment.reasoning}`,
    timestamp: new Date().toISOString(),
  };

  // Step 5: Post comment with triage results
  const comment = formatTriageComment(triageResult);
  await postComment(githubClient, owner, repo, issueNumber, comment);

  // Step 6: Apply labels
  const labels = generateLabels(triageResult);
  await addLabels(githubClient, owner, repo, issueNumber, labels);

  const duration = Date.now() - startTime;

  console.error(JSON.stringify({
    level: 'INFO',
    message: 'Triage complete',
    issueNumber,
    classification: triageResult.classification,
    risk: triageResult.risk,
    autoFixDecision: triageResult.autoFixDecision,
    duration,
    timestamp: new Date().toISOString(),
  }));

  // Wrap result for consistent API response format
  return {
    success: true,
    data: triageResult
  };
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Parse command line arguments or environment variables
    const owner = process.env.GITHUB_REPOSITORY_OWNER || process.argv[2];
    const repo = process.env.GITHUB_REPOSITORY_NAME || process.argv[3];
    const issueNumber = parseInt(process.env.ISSUE_NUMBER || process.argv[4], 10);

    if (!owner || !repo || !issueNumber) {
      throw new AutoFixError(
        'Missing required parameters: owner, repo, issueNumber',
        ErrorCodes.INVALID_INPUT
      );
    }

    // Execute with timeout and tracking
    const result = await trackAgentExecution(
      () => triageIssue(owner, repo, issueNumber),
      'triage-agent'
    );

    // Log summary
    logAgentSummary('triage-agent', {
      success: result.success,
      classification: result.data?.classification,
      riskLevel: result.data?.risk?.level,
      autoFixDecision: result.data?.autoFixDecision,
    });

    // Output result as JSON to stdout
    console.log(JSON.stringify(result, null, 2));

    // Write result to file for workflow artifact
    const outputPath = process.env.OUTPUT_PATH || './triage-result.json';
    writeFileSync(outputPath, JSON.stringify(result, null, 2));
    logger.info(`Result written to ${outputPath}`);

    process.exit(0);
  } catch (error) {
    logError(error, {
      agent: 'triage',
      operation: 'main',
    });

    // Try to post error comment if we have issue info
    try {
      const owner = process.env.GITHUB_REPOSITORY_OWNER || process.argv[2];
      const repo = process.env.GITHUB_REPOSITORY_NAME || process.argv[3];
      const issueNumber = parseInt(process.env.ISSUE_NUMBER || process.argv[4], 10);

      if (owner && repo && issueNumber) {
        const githubClient = createGitHubClient();
        const errorComment = formatErrorForComment(error, 'triage');
        await postComment(githubClient, owner, repo, issueNumber, errorComment);

        // Add automation-failed label
        await addLabels(githubClient, owner, repo, issueNumber, ['automation-failed']);

        logger.info('Posted error comment and added automation-failed label', {
          issueNumber,
        });
      }
    } catch (commentError) {
      // Ignore errors posting error comment
      logger.error('Failed to post error comment', {
        error: commentError.message,
      });
    }

    process.exit(1);
  }
}

// Run main function
main();
