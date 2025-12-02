# Triage Agent Contract

**Agent**: Triage Agent  
**Purpose**: Classify GitHub issues and assess risk for auto-fix eligibility  
**Phase**: 1 - Initial Classification

## Input

```typescript
interface TriageAgentInput {
  issue: Issue;                    // GitHub issue from webhook payload
  repository_context: RepositoryContext; // Repo metadata for context
  security_constraints: SecurityConstraint[]; // Rules to check
}

interface RepositoryContext {
  languages: string[];             // Primary languages (e.g., ["TypeScript", "Vue"])
  file_tree: string[];             // All file paths (for pattern matching)
  codeowners: Record<string, string[]>; // File patterns → owners
  recent_issues: IssueSummary[];   // Last 10 issues for pattern learning
}

interface IssueSummary {
  number: number;
  title: string;
  labels: string[];
  classification: IssueType | null; // If previously triaged
}
```

**Example Input**:
```json
{
  "issue": {
    "number": 42,
    "title": "Fix typo in README",
    "body": "There's a typo in the installation section: 'teh' should be 'the'",
    "labels": [],
    "author": { "login": "johndoe", "type": "User" },
    "created_at": "2025-12-02T10:00:00Z",
    "url": "https://github.com/owner/repo/issues/42",
    "repository": {
      "owner": "owner",
      "name": "repo",
      "default_branch": "main"
    }
  },
  "repository_context": {
    "languages": ["TypeScript", "Vue", "CSS"],
    "file_tree": ["README.md", "src/main.ts", "package.json"],
    "codeowners": { "*.md": ["@docs-team"] },
    "recent_issues": []
  },
  "security_constraints": [
    {
      "id": "secret-keyword",
      "type": "KEYWORD",
      "pattern": "(password|secret|api.?key)",
      "severity": "CRITICAL",
      "action": "BLOCK"
    }
  ]
}
```

## Output

```typescript
interface TriageAgentOutput extends AgentResponse<TriageResult> {}
```

**Example Success Output**:
```json
{
  "success": true,
  "data": {
    "issue_number": 42,
    "classification": "DOCS",
    "risk": "LOW",
    "affected_files": ["README.md"],
    "skillset": ["documentation"],
    "auto_fix_decision": "YES",
    "reasoning": "Simple documentation typo correction in README. No code changes, minimal risk.",
    "security_flags": [],
    "estimated_complexity": "TRIVIAL",
    "suggested_labels": ["docs", "auto-triage", "good-first-issue"],
    "timestamp": "2025-12-02T10:00:15Z"
  }
}
```

**Example Blocked Output** (security violation):
```json
{
  "success": true,
  "data": {
    "issue_number": 43,
    "classification": "CHORE",
    "risk": "HIGH",
    "affected_files": [".env.production"],
    "skillset": ["devops", "security"],
    "auto_fix_decision": "HUMAN_REVIEW_REQUIRED",
    "reasoning": "Issue requests changes to environment file containing secrets. Auto-fix blocked per security policy.",
    "security_flags": [
      {
        "type": "FILE_PATH",
        "pattern": "**/.env*",
        "severity": "CRITICAL"
      }
    ],
    "estimated_complexity": "SIMPLE",
    "suggested_labels": ["security", "human-review-required"],
    "timestamp": "2025-12-02T10:01:30Z"
  }
}
```

## Processing Logic

### 1. Bot Detection (FR-012)

```typescript
function shouldSkipIssue(issue: Issue): boolean {
  const isBotAuthor = issue.author.login.endsWith('[bot]');
  const hasAutoLabel = issue.labels.some(l => l.name === 'created-by-autofix');
  return isBotAuthor || hasAutoLabel;
}
```

If returns `true`, skip triage and return early with comment: "Skipping bot-generated issue to prevent automation loops."

### 2. Classification (FR-002)

**Fast Path** - Keyword matching (90% of issues):
```typescript
const KEYWORDS = {
  BUG: ['bug', 'crash', 'error', 'broken', 'not working', 'fails', 'issue'],
  FEATURE: ['feature', 'add', 'support', 'implement', 'enhancement', 'new'],
  DOCS: ['typo', 'documentation', 'readme', 'docs', 'spelling', 'grammar'],
  CHORE: ['refactor', 'cleanup', 'dependency', 'update', 'upgrade', 'bump']
};

function classifyByKeywords(title: string, body: string): IssueType | null {
  const text = `${title} ${body}`.toLowerCase();
  for (const [type, keywords] of Object.entries(KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return type as IssueType;
    }
  }
  return null; // Ambiguous, requires LLM
}
```

**Slow Path** - LLM classification (10% of issues):
```typescript
const llmPrompt = `
Classify this GitHub issue into one of: BUG, FEATURE, DOCS, CHORE, OTHER.

Issue Title: ${issue.title}
Issue Body: ${issue.body}

Respond with JSON: { "classification": "...", "confidence": 0.0-1.0 }
`;
```

### 3. Security Check (FR-005)

```typescript
function checkSecurityConstraints(
  issue: Issue,
  constraints: SecurityConstraint[]
): SecurityFlag[] {
  const flags: SecurityFlag[] = [];
  const text = `${issue.title} ${issue.body}`.toLowerCase();
  
  for (const constraint of constraints) {
    if (constraint.type === 'KEYWORD') {
      const regex = new RegExp(constraint.pattern, 'i');
      if (regex.test(text)) {
        flags.push({
          type: 'KEYWORD',
          pattern: constraint.pattern,
          severity: constraint.severity
        });
      }
    }
    // FILE_PATTERN and CHANGE_TYPE checked after affected_files identified
  }
  
  return flags;
}
```

If any flags have `severity === 'CRITICAL'`:
- Set `risk = 'HIGH'`
- Set `auto_fix_decision = 'HUMAN_REVIEW_REQUIRED'`

### 4. Affected Files Identification (FR-003)

```typescript
function identifyAffectedFiles(
  issue: Issue,
  file_tree: string[]
): string[] {
  // Extract file paths mentioned in issue
  const mentioned = extractFilePaths(issue.body); // Regex: paths with slashes or extensions
  
  // Match against repository file tree (fuzzy matching)
  const matched = mentioned.map(m => findBestMatch(m, file_tree));
  
  // Infer from classification (heuristics)
  if (classification === 'DOCS' && matched.length === 0) {
    return file_tree.filter(f => f.endsWith('.md'));
  }
  
  return matched.filter(Boolean); // Remove nulls
}
```

### 5. Risk Assessment (FR-004)

```typescript
function assessRisk(
  classification: IssueType,
  affected_files: string[],
  security_flags: SecurityFlag[]
): RiskLevel {
  // Critical security flags → HIGH
  if (security_flags.some(f => f.severity === 'CRITICAL')) {
    return 'HIGH';
  }
  
  // File sensitivity scoring
  const sensitivity_scores = affected_files.map(f => {
    if (f.endsWith('.md')) return 1;
    if (f.startsWith('tests/')) return 2;
    if (f.endsWith('.ts') || f.endsWith('.vue')) return 4;
    if (f.startsWith('config/')) return 8;
    return 5; // Default
  });
  
  const base_score = sensitivity_scores.reduce((a, b) => a + b, 0);
  const scope_multiplier = affected_files.length <= 1 ? 1 : affected_files.length <= 5 ? 1.5 : 2;
  const final_score = base_score * scope_multiplier;
  
  if (final_score < 5) return 'LOW';
  if (final_score <= 7) return 'MEDIUM';
  return 'HIGH';
}
```

### 6. Auto-Fix Decision (FR-005)

```typescript
function decideAutoFix(risk: RiskLevel, security_flags: SecurityFlag[]): AutoFixDecision {
  if (risk === 'HIGH') return 'HUMAN_REVIEW_REQUIRED';
  if (security_flags.length > 0) return 'HUMAN_REVIEW_REQUIRED';
  return 'YES'; // LOW or MEDIUM without security concerns
}
```

## Performance Requirements

- **Latency**: < 30 seconds (SC-001: 95% of cases)
- **LLM calls**: Maximum 1 per issue (use keyword fast path first)
- **GitHub API calls**: Maximum 3 (get file tree, CODEOWNERS, recent issues)

## Side Effects

1. **Post triage comment** to issue (FR-011):
```markdown
<!-- TRIAGE_RESULT -->
**Automated Triage Result**

- **Classification**: DOCS
- **Risk Level**: LOW
- **Auto-Fix**: ✅ Eligible for automatic fix
- **Affected Files**: README.md

This issue will be processed automatically. Track progress in linked PR.

<details>
<summary>Triage Details</summary>

```json
{ ...TriageResult JSON... }
```
</details>
```

2. **Apply labels** to issue (FR-006):
   - Classification label: `docs`
   - Triage label: `auto-triage`
   - Risk-specific labels: `good-first-issue` (LOW), `needs-review` (MEDIUM), `human-review-required` (HIGH)

## Error Scenarios

| Scenario | Error Code | Action |
|----------|-----------|--------|
| Issue body is empty and title is ambiguous | `INSUFFICIENT_CONTEXT` | Classify as OTHER, request clarification comment |
| GitHub API rate limit exceeded | `RATE_LIMIT_EXCEEDED` | Return error with retry_after timestamp |
| LLM API timeout | `LLM_TIMEOUT` | Fallback to OTHER classification, log warning |
| Repository file tree unavailable | `REPO_ACCESS_ERROR` | Use empty affected_files, set risk to MEDIUM |

## Testing Approach

**Manual Verification Steps**:

1. **LOW Risk Test**: Create issue "Fix typo in README: 'teh' → 'the'"
   - Verify: classification=DOCS, risk=LOW, auto_fix=YES
   - Verify: Comment posted within 30 seconds
   - Verify: Labels applied: `docs`, `auto-triage`

2. **HIGH Risk Test**: Create issue "Update API key in .env file"
   - Verify: classification=CHORE, risk=HIGH, auto_fix=HUMAN_REVIEW_REQUIRED
   - Verify: security_flags contains FILE_PATH constraint
   - Verify: Labels applied: `human-review-required`, `security`

3. **Bot Detection Test**: Create issue with Dependabot account
   - Verify: Issue skipped with comment about preventing loops

## Integration Points

- **Input Source**: GitHub Actions workflow (on issues.opened webhook)
- **Output Destination**: Workflow artifact + issue comment
- **Next Agent**: Planner Agent (if auto_fix_decision === 'YES')
