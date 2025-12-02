/**
 * TypeScript Type Definitions
 * 
 * Core interfaces for the auto-fix system.
 * These types align with the data model from specs/001-github-auto-fix/data-model.md
 */

/**
 * GitHub Issue representation
 */
export interface Issue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: Array<{
    name: string;
    color: string;
    description: string;
  }>;
  user: {
    login: string;
    type: string;
  };
  created_at: string;
  updated_at: string;
  html_url: string;
}

/**
 * Issue classification types
 */
export type Classification = 'BUG' | 'FEATURE' | 'DOCS' | 'CHORE' | 'OTHER';

/**
 * Risk levels
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Auto-fix decision types
 */
export type AutoFixDecision = 'AUTO_FIX' | 'DRAFT_PR' | 'HUMAN_REVIEW_REQUIRED';

/**
 * Triage result from triage agent
 */
export interface TriageResult {
  classification: Classification;
  confidence: number; // 0-1
  risk: RiskLevel;
  riskScore: number; // 0-100
  securityFlags: boolean;
  securityDetails?: {
    hasSecurityFlags: boolean;
    keywordMatches: Array<{ keyword: string; pattern: RegExp }>;
    fileMatches: Array<{ pattern: RegExp }>;
    riskyChangeMatches: Array<{ type: string; reason: string }>;
    summary: string;
  };
  affectedFiles: string[];
  autoFixDecision: AutoFixDecision;
  reasoning: string;
  timestamp: string;
}

/**
 * File change operation types
 */
export type FileOperation = 'CREATE' | 'MODIFY' | 'DELETE';

/**
 * File change description
 */
export interface FileChange {
  path: string;
  operation: FileOperation;
  summary: string;
}

/**
 * Fix plan from planner agent
 */
export interface FixPlan {
  branchName: string;
  planSteps: string[];
  fileChanges: FileChange[];
  validationCommands: string[];
  estimatedComplexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  humanCheckReason?: string;
  timestamp: string;
}

/**
 * Validation result from code execution
 */
export interface ValidationResult {
  command: string;
  passed: boolean;
  output: string;
  exitCode: number;
  duration: number; // milliseconds
}

/**
 * Commit from code agent
 */
export interface Commit {
  sha: string;
  message: string;
  diff: string; // unified diff format
  validationResults: ValidationResult[];
  timestamp: string;
  author: {
    name: string;
    email: string;
  };
}

/**
 * Pull request representation
 */
export interface PullRequest {
  number: number;
  title: string;
  body: string;
  head: string; // branch name
  base: string; // base branch
  draft: boolean;
  html_url: string;
  state: 'open' | 'closed';
  labels: string[];
  requestedReviewers: string[];
  created_at: string;
}

/**
 * Security constraint type
 */
export type SecurityConstraintType = 'KEYWORD' | 'FILE_PATTERN' | 'CHANGE_TYPE';

/**
 * Security constraint definition
 */
export interface SecurityConstraint {
  id: string;
  type: SecurityConstraintType;
  pattern: RegExp | string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  blockAutoFix: boolean;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  repository: {
    owner: string;
    name: string;
    fullName: string; // owner/name
    defaultBranch: string;
  };
  issue: Issue;
  workflowRunId?: string;
  triggeredBy: string;
  timestamp: string;
}

/**
 * Agent execution result (generic)
 */
export interface AgentResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  duration: number; // milliseconds
  timestamp: string;
}

/**
 * Complete workflow state
 */
export interface WorkflowState {
  issue: Issue;
  triageResult?: TriageResult;
  fixPlan?: FixPlan;
  commits?: Commit[];
  pullRequest?: PullRequest;
  error?: {
    stage: 'triage' | 'planning' | 'code' | 'pr';
    message: string;
    details?: any;
  };
  startTime: string;
  endTime?: string;
  totalDuration?: number; // milliseconds
}

/**
 * AI prompt configuration
 */
export interface AIPromptConfig {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
}

/**
 * Error context for structured logging
 */
export interface ErrorContext {
  agent?: string;
  operation?: string;
  repository?: string;
  issueNumber?: number;
  [key: string]: any;
}

/**
 * Structured log entry
 */
export interface LogEntry {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  timestamp: string;
  agent?: string;
  context?: Record<string, any>;
}
