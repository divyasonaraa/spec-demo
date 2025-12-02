# Research: Automated GitHub Issue Triage and Auto-Fix System

**Feature**: [spec.md](./spec.md)  
**Created**: 2025-12-02  
**Phase**: 0 - Research & Technical Discovery

## Overview

This document consolidates research findings to resolve all technical unknowns (NEEDS CLARIFICATION markers) from the implementation plan's Technical Context section and evaluate technology choices for implementing the automated GitHub issue processing system.

## Research Tasks

### 1. GitHub Integration Architecture

**Decision**: GitHub Actions workflow triggered by `issues.opened` webhook event

**Rationale**:
- Native GitHub integration with zero external hosting required
- Event-driven architecture ensures real-time processing (< 30 seconds per FR-001)
- Built-in authentication via `GITHUB_TOKEN` with automatic permission management
- Free tier sufficient for most repositories (2,000 minutes/month for private repos)
- Eliminates need for external webhook receivers, reducing attack surface

**Alternatives Considered**:
- **External webhook server (Node.js/Python)**: Requires hosting, SSL certificates, and manual secret management; adds operational complexity
- **GitHub App**: More complex setup requiring OAuth flow and installation process; overkill for single-repository automation
- **Polling approach**: Violates real-time requirement (FR-001: 30-second trigger), wastes API quota

**Implementation Pattern**:
```yaml
# .github/workflows/auto-fix.yml
on:
  issues:
    types: [opened]
jobs:
  auto-fix:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      pull-requests: write
      contents: write
```

### 2. AI Agent Selection for Code Analysis and Generation

**Decision**: Use GitHub Copilot API (via GitHub Models) or Anthropic Claude API with structured prompts

**Rationale**:
- GitHub Models (Copilot) provides free tier for public repos with code-aware models
- Anthropic Claude 3.5 Sonnet excels at structured reasoning with tool use (function calling)
- Both support function calling for structured JSON outputs (TriageResult, FixPlan)
- OpenAI GPT-4 considered but GitHub Models more cost-effective for this use case
- LangChain/LlamaIndex abstractions rejected (violates Principle IV: Minimal Dependencies)

**Alternatives Considered**:
- **Rule-based classification**: Insufficient for nuanced triage decisions; requires constant maintenance for new patterns
- **Local LLM (Ollama)**: GitHub Actions runners have limited resources; inference too slow (> 30-second requirement)
- **OpenAI GPT-4**: More expensive; GitHub Models offers same capabilities with better GitHub integration

**Agent Workflow**:
1. **Triage Agent**: Classify issue type, extract affected files, assess risk
2. **Planner Agent**: Generate implementation plan with file changes
3. **Code Agent**: Apply changes using git operations
4. **PR Generator**: Format comprehensive PR description

### 3. Security Constraint Enforcement

**Decision**: Multi-layered security gate with pattern matching + file path analysis + LLM reasoning

**Rationale**:
- Pattern matching catches obvious keywords: "password", "API key", "secret", "token", "credentials"
- File path blocklist prevents changes to: `.env*`, `config/secrets/`, `*.pem`, `*.key`, `deployment/`
- LLM reasoning layer evaluates context (e.g., "test API key" vs "production API key")
- Default-deny approach: if uncertain, flag for human review (FR-005)
- Aligns with Constitution Principle IV (minimal dependencies): no third-party security scanning libraries

**Alternatives Considered**:
- **TruffleHog/GitLeaks integration**: Adds dependency; designed for secret detection not prevention
- **CODEOWNERS enforcement only**: Insufficient; doesn't block automation, just requires approval after PR creation
- **Allow-list approach**: Too permissive; risk of missing new attack vectors

**Security Patterns to Block**:
```typescript
const SECURITY_KEYWORDS = [
  'password', 'secret', 'api.?key', 'token', 'credential',
  'auth', 'oauth', 'private.?key', 'certificate'
];

const BLOCKED_FILE_PATTERNS = [
  '**/.env*', '**/config/secrets/**', '**/*.pem', '**/*.key',
  '**/deployment/**', '**/Dockerfile', '**/*secrets*'
];
```

### 4. Code Change Application Strategy

**Decision**: Git patch application using `git apply` with validation via `git diff --check`

**Rationale**:
- LLM generates unified diff format (standard, parsable, reviewable)
- `git apply` handles whitespace, line endings, and merge conflicts automatically
- `--check` flag validates patch before applying (dry-run)
- Preserves git history and blame information (FR-018)
- No dependencies on external patching libraries

**Alternatives Considered**:
- **Direct file writes**: Loses context; difficult to rollback; no conflict detection
- **AST manipulation (Babel/TypeScript Compiler API)**: Heavy dependencies; only works for JS/TS; violates Principle IV
- **Template-based generation**: Inflexible; can't handle existing code variations

**Validation Pipeline**:
```bash
# 1. Generate patch from LLM
# 2. Validate patch format
git apply --check changes.patch
# 3. Apply if valid
git apply changes.patch
# 4. Run linters
npm run lint
# 5. Check for obvious errors
git diff --check
```

### 5. Issue Classification Approach

**Decision**: Hybrid approach with keyword heuristics + LLM classification

**Rationale**:
- Fast path: keyword matching for obvious cases (90% of issues)
  - "bug", "crash", "error" → BUG
  - "add feature", "support for", "implement" → FEATURE
  - "typo", "fix docs", "update README" → DOCS
- LLM fallback: ambiguous cases requiring semantic understanding
- Reduces LLM API costs by 90% while maintaining accuracy (SC-005: 90% accuracy)
- Single LLM call per ambiguous issue (< 2-second response time)

**Alternatives Considered**:
- **Pure LLM classification**: Expensive at scale; unnecessary for obvious keywords
- **Pure rule-based**: Insufficient for nuanced cases ("doesn't work" could be bug or user error)
- **ML classification model**: Requires training data, maintenance, and hosting; violates minimal dependencies principle

**Classification Rules**:
```typescript
const CLASSIFICATION_KEYWORDS = {
  BUG: ['bug', 'crash', 'error', 'broken', 'not working', 'fails'],
  FEATURE: ['feature', 'add', 'support', 'implement', 'enhancement'],
  DOCS: ['typo', 'documentation', 'readme', 'docs', 'spelling'],
  CHORE: ['refactor', 'cleanup', 'dependency', 'update']
};
```

### 6. Risk Assessment Methodology

**Decision**: Tiered risk scoring with file sensitivity + change scope + security patterns

**Rationale**:
- File sensitivity scoring (0-10 scale):
  - Source code: 3-5 (depends on module)
  - Tests: 2 (low impact)
  - Docs: 1 (lowest risk)
  - Config: 8-10 (high impact)
  - Security files: 10 (auto-blocked)
- Change scope multiplier:
  - Single file: 1x
  - 2-5 files: 1.5x
  - 6+ files: 2x (auto-escalate to MEDIUM)
- Security pattern detection: automatic HIGH risk
- Final score: LOW (< 5), MEDIUM (5-7), HIGH (> 7)

**Alternatives Considered**:
- **Static analysis complexity metrics**: Requires AST parsing; heavy dependencies
- **Git blame history**: Interesting but unreliable (new files have no history)
- **CODEOWNERS mapping only**: Doesn't capture risk, only ownership

**Risk Scoring Example**:
```typescript
function calculateRisk(files: string[], hasSecurityKeywords: boolean): Risk {
  if (hasSecurityKeywords) return 'HIGH';
  
  const baseScore = files.reduce((sum, f) => sum + getFileSensitivity(f), 0);
  const scopeMultiplier = files.length <= 1 ? 1 : files.length <= 5 ? 1.5 : 2;
  const finalScore = baseScore * scopeMultiplier;
  
  if (finalScore < 5) return 'LOW';
  if (finalScore <= 7) return 'MEDIUM';
  return 'HIGH';
}
```

### 7. Validation and Rollback Strategy

**Decision**: Pre-PR validation with automatic rollback on failure

**Rationale**:
- Run validation before creating PR (FR-008, FR-016)
- Validation steps: lint, type-check, build (no tests per Constitution Principle V)
- Failure triggers: revert commit, post error comment, add "automation-failed" label
- Clean git state maintained: use separate branch, delete on failure
- Aligns with atomic commit principle (FR-019)

**Alternatives Considered**:
- **Create PR then validate**: Clutters PR list with broken PRs
- **Skip validation**: Violates FR-008, creates maintenance burden
- **Manual rollback**: Error-prone; requires human intervention

**Validation Workflow**:
```bash
# Create temporary branch
git checkout -b fix/${ISSUE_NUMBER}-temp

# Apply changes
git apply patch.diff
git commit -m "Fix issue #${ISSUE_NUMBER}"

# Validate
npm run lint || rollback
npm run type-check || rollback
npm run build || rollback

# Success: rename to final branch
git branch -m fix/${ISSUE_NUMBER}-short-desc
git push origin fix/${ISSUE_NUMBER}-short-desc

# Failure: cleanup
rollback() {
  git checkout main
  git branch -D fix/${ISSUE_NUMBER}-temp
  post_error_comment
}
```

### 8. GitHub API Rate Limit Handling

**Decision**: Exponential backoff with jitter + secondary rate limit awareness

**Rationale**:
- Primary limit: 5,000 requests/hour (authenticated)
- Secondary limit: 100 concurrent requests (less documented)
- Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 32s
- Jitter: randomize ±20% to prevent thundering herd
- Check `X-RateLimit-Remaining` header before expensive operations
- Use GraphQL API where possible (single query vs multiple REST calls)

**Alternatives Considered**:
- **No rate limit handling**: Guaranteed failures during high activity
- **Fixed retry delay**: Doesn't adapt to congestion
- **Queue with persistence**: Overcomplicated for expected load (< 50 simultaneous issues per SC-007)

**Implementation**:
```typescript
async function githubApiCall(fn: () => Promise<Response>, attempt = 0) {
  try {
    const response = await fn();
    if (response.status === 429 || response.status === 403) {
      const retryAfter = response.headers['retry-after'] || (2 ** attempt);
      const jitter = retryAfter * (0.8 + Math.random() * 0.4);
      await sleep(jitter * 1000);
      return githubApiCall(fn, attempt + 1);
    }
    return response;
  } catch (error) {
    if (attempt < 5) return githubApiCall(fn, attempt + 1);
    throw error;
  }
}
```

### 9. Bot Detection and Infinite Loop Prevention

**Decision**: Check issue author's `[bot]` suffix + custom label detection

**Rationale**:
- GitHub marks bot users with `[bot]` in username (e.g., `dependabot[bot]`)
- Add custom `created-by-autofix` label to all auto-generated issues/PRs
- Skip processing if: author ends with `[bot]` OR has `created-by-autofix` label
- Whitelist trusted bots if needed (configurable)
- Prevents infinite loops (FR-012, SC-010: zero instances)

**Alternatives Considered**:
- **Issue title prefix detection**: Unreliable; users could manually add prefix
- **Issue body signature**: Can be edited after creation
- **Graph traversal**: Overengineered for simple use case

**Bot Detection**:
```typescript
function shouldSkipIssue(issue: Issue): boolean {
  const isBotAuthor = issue.user.login.endsWith('[bot]');
  const hasAutoLabel = issue.labels.some(l => l.name === 'created-by-autofix');
  return isBotAuthor || hasAutoLabel;
}
```

### 10. PR Description Template Structure

**Decision**: Structured markdown with collapsible sections for detailed information

**Rationale**:
- Human-readable format with clear sections (FR-009)
- Collapsible details for verbose information (diff, logs)
- Markdown tables for file changes summary
- Code blocks with syntax highlighting for test outputs
- Aligns with GitHub PR best practices

**Template**:
```markdown
## Summary
[One-sentence description]

## What Changed
- File 1: [change summary]
- File 2: [change summary]

## Why
[Root cause explanation from issue]

## Manual Verification
[Steps to verify the fix]

## Risk Assessment
**Risk Level**: LOW  
**Affected Areas**: [list modules]  
**Rollback**: `git revert [commit-hash]`

<details>
<summary>Validation Results</summary>

\`\`\`
$ npm run lint
✓ No issues

$ npm run type-check  
✓ Types valid
\`\`\`
</details>

## Suggested Reviewers
@user1, @user2 (based on CODEOWNERS)
```

## Technology Stack Summary

Based on research findings:

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Workflow Engine** | GitHub Actions | Native integration, free tier, event-driven |
| **AI Provider** | GitHub Models (Copilot) or Anthropic Claude | Cost-effective, code-aware, function calling |
| **Code Application** | Git patch (`git apply`) | Standard format, built-in validation, no dependencies |
| **Classification** | Hybrid (keywords + LLM) | 90% cost reduction, maintains accuracy |
| **Risk Assessment** | File sensitivity + scope scoring | Transparent, explainable, no ML training |
| **Validation** | Lint + type-check + build | Pre-PR validation, automatic rollback |
| **Rate Limiting** | Exponential backoff + jitter | Prevents throttling, adapts to congestion |
| **Bot Detection** | Username suffix + label check | Simple, reliable, prevents infinite loops |

## Open Questions Resolved

All NEEDS CLARIFICATION markers from Technical Context have been addressed:

1. ✅ **GitHub Integration**: GitHub Actions with `issues.opened` webhook
2. ✅ **AI Agent Selection**: GitHub Models or Anthropic Claude with structured prompts
3. ✅ **Security Enforcement**: Multi-layer pattern + path + LLM reasoning
4. ✅ **Code Application**: Git patch with validation pipeline
5. ✅ **Classification Approach**: Hybrid keywords + LLM fallback
6. ✅ **Risk Methodology**: Tiered scoring with file sensitivity and scope
7. ✅ **Validation Strategy**: Pre-PR validation with automatic rollback
8. ✅ **Rate Limit Handling**: Exponential backoff with secondary limit awareness
9. ✅ **Bot Detection**: Username suffix and custom label checking
10. ✅ **PR Template**: Structured markdown with collapsible sections

## Dependencies Audit

**Required** (aligned with Constitution Principle IV):
- GitHub Actions (native, no installation)
- Git (built-in to Actions runners)
- Node.js (pre-installed on Actions runners)
- GitHub Octokit SDK (official GitHub API client)
- AI SDK (GitHub Models API or Anthropic SDK)

**Explicitly Rejected**:
- LangChain/LlamaIndex (unnecessary abstraction layer)
- AST parsers (Babel, TypeScript Compiler API) (heavy, language-specific)
- Secret scanning tools (TruffleHog, GitLeaks) (redundant with custom patterns)
- Test frameworks (per Constitution Principle V: NO TESTING)

## Performance Considerations

Based on research and success criteria:

- **Triage latency**: < 30 seconds (SC-001: 95% cases)
  - Webhook trigger: ~1-2 seconds
  - LLM classification: ~2-5 seconds
  - GitHub API calls: ~1-2 seconds each
  - Total: ~10-15 seconds average

- **Auto-fix latency**: < 2 minutes (SC-002: 100% success)
  - Triage: ~15 seconds
  - LLM fix generation: ~10-30 seconds
  - Git operations: ~5-10 seconds
  - Validation: ~20-60 seconds (lint, build)
  - PR creation: ~5-10 seconds
  - Total: ~55-125 seconds average

- **Concurrent processing**: 50 simultaneous issues (SC-007)
  - GitHub Actions: 20 concurrent runners (free tier)
  - Strategy: Queue overflow, process serially

## Next Steps

Research phase complete. Proceed to:
1. **Phase 1**: Data model definition (`data-model.md`)
2. **Phase 1**: API contracts (`contracts/`)
3. **Phase 1**: Quick start guide (`quickstart.md`)
4. **Phase 2**: Detailed task breakdown (`/speckit.tasks` command)
