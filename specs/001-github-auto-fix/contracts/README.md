# API Contracts: Automated GitHub Issue Triage and Auto-Fix System

**Feature**: [spec.md](../spec.md)  
**Created**: 2025-12-02  
**Phase**: 1 - Design

## Overview

This directory contains the API contracts for all agents in the auto-fix pipeline. Each agent receives structured input and produces structured output in JSON format, enabling stateless, composable processing.

## Agent Pipeline

```
Issue (GitHub Webhook)
  ↓
[Triage Agent] → TriageResult
  ↓
[Planner Agent] → FixPlan
  ↓
[Code Agent] → Commit[]
  ↓
[PR Generator] → PullRequest
```

## Contract Files

- **[triage-agent.md](./triage-agent.md)**: Issue classification and risk assessment
- **[planner-agent.md](./planner-agent.md)**: Implementation plan generation
- **[code-agent.md](./code-agent.md)**: Code change generation and validation
- **[pr-generator.md](./pr-generator.md)**: Pull request creation and formatting

## Communication Protocol

### Transport

All agents communicate via:
1. **Input**: JSON file or GitHub Actions workflow environment variable
2. **Output**: JSON printed to stdout (captured by workflow)
3. **Logging**: Stderr for debug/info messages (not parsed)

### Error Handling

All agents must handle errors gracefully:

```typescript
interface AgentResponse<T> {
  success: boolean;
  data?: T;                    // Present if success === true
  error?: AgentError;          // Present if success === false
}

interface AgentError {
  code: string;                // Machine-readable error code
  message: string;             // Human-readable description
  details?: Record<string, any>; // Optional context
  recoverable: boolean;        // Can retry?
}
```

**Example Success Response**:
```json
{
  "success": true,
  "data": {
    "issue_number": 42,
    "classification": "BUG",
    "risk": "LOW"
  }
}
```

**Example Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "GitHub API rate limit exceeded, retry after 60 seconds",
    "details": { "retry_after": 60 },
    "recoverable": true
  }
}
```

### Standard Error Codes

| Code | Meaning | Recoverable |
|------|---------|-------------|
| `INVALID_INPUT` | Input JSON malformed or missing required fields | No |
| `RATE_LIMIT_EXCEEDED` | GitHub API rate limit hit | Yes (with backoff) |
| `LLM_API_ERROR` | AI provider API failure | Yes (retry) |
| `SECURITY_VIOLATION` | Attempted change to blocked file/pattern | No |
| `VALIDATION_FAILED` | Lint/type-check/build failed | No |
| `GIT_ERROR` | Git operation failed (merge conflict, etc.) | Maybe (depends on context) |
| `PERMISSION_DENIED` | GitHub token lacks required permission | No |
| `TIMEOUT` | Agent execution exceeded time limit | Yes (retry with higher timeout) |

## Agent Responsibilities

### Triage Agent
- **Input**: Issue (from GitHub webhook)
- **Output**: TriageResult
- **Responsibilities**:
  - Classify issue type (BUG/FEATURE/DOCS/CHORE/OTHER)
  - Assess risk level (LOW/MEDIUM/HIGH)
  - Identify affected files
  - Check security constraints
  - Decide if auto-fix is safe
- **Time Limit**: 30 seconds

### Planner Agent
- **Input**: Issue + TriageResult
- **Output**: FixPlan
- **Responsibilities**:
  - Generate branch name
  - Create ordered implementation steps
  - Identify file changes needed
  - Specify validation commands
  - Estimate complexity
- **Time Limit**: 60 seconds
- **Prerequisites**: TriageResult.auto_fix_decision === 'YES'

### Code Agent
- **Input**: Issue + TriageResult + FixPlan + Repository Context
- **Output**: Commit[]
- **Responsibilities**:
  - Generate code changes as unified diffs
  - Apply diffs using `git apply`
  - Run validation commands
  - Create atomic commits
  - Rollback on validation failure
- **Time Limit**: 120 seconds
- **Prerequisites**: FixPlan exists and validated

### PR Generator
- **Input**: Issue + TriageResult + FixPlan + Commit[]
- **Output**: PullRequest
- **Responsibilities**:
  - Format comprehensive PR description
  - Create PR via GitHub API
  - Apply labels
  - Request reviewers
  - Set draft mode if MEDIUM risk
- **Time Limit**: 30 seconds
- **Prerequisites**: All commits validated successfully

## Idempotency

All agents must be idempotent:
- Same input always produces same output
- No side effects in read-only operations (triage, planner)
- Mutating operations (code, PR) detect existing state and skip if already applied

**Example**: Code agent checks if branch already exists before creating it.

## Observability

All agents must log structured data to stderr:

```json
{
  "timestamp": "2025-12-02T10:30:00Z",
  "agent": "triage",
  "issue_number": 42,
  "action": "classify_issue",
  "duration_ms": 1234,
  "result": "BUG"
}
```

This enables:
- Performance monitoring (track agent latency)
- Debugging (trace execution flow)
- Audit trail (who did what when)

## Security Constraints

All agents must respect security boundaries:

1. **Never** modify files matching blocked patterns (see SecurityConstraint in data-model.md)
2. **Never** execute user-provided code directly
3. **Never** expose secrets in logs or API responses
4. **Always** validate input against schema before processing
5. **Always** use least-privilege GitHub token scopes

## Testing Strategy

Per Constitution Principle V: **NO TESTING** - Manual verification only.

Verification approach:
1. Create test issue in GitHub with known characteristics
2. Run agent workflow manually via workflow_dispatch
3. Inspect agent outputs in workflow logs
4. Verify expected labels, comments, PR created

## Next Steps

See individual contract files for detailed API specifications:
- [triage-agent.md](./triage-agent.md)
- [planner-agent.md](./planner-agent.md)
- [code-agent.md](./code-agent.md)
- [pr-generator.md](./pr-generator.md)
