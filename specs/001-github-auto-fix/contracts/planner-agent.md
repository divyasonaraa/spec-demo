# Planner Agent Contract

**Agent**: Planner Agent  
**Purpose**: Generate implementation plan for approved auto-fix issues  
**Phase**: 2 - Planning

## Input

```typescript
interface PlannerAgentInput {
  issue: Issue;
  triage_result: TriageResult;
  repository_context: RepositoryContext;
  conventions: ProjectConventions;
}

interface ProjectConventions {
  branch_prefix: Record<IssueType, string>; // e.g., { BUG: "fix", FEATURE: "feature" }
  test_commands: string[];       // e.g., ["npm run lint", "npm run type-check"]
  lint_command: string;
  build_command: string;
  style_guide: string;           // Path to style guide or "standard"
}
```

**Example Input**:
```json
{
  "issue": {
    "number": 42,
    "title": "Fix typo in README installation section",
    "body": "Line 15 has 'teh' instead of 'the'",
    "author": { "login": "johndoe" },
    "created_at": "2025-12-02T10:00:00Z"
  },
  "triage_result": {
    "issue_number": 42,
    "classification": "DOCS",
    "risk": "LOW",
    "affected_files": ["README.md"],
    "auto_fix_decision": "YES"
  },
  "repository_context": {
    "languages": ["TypeScript"],
    "file_tree": ["README.md", "src/main.ts"],
    "codeowners": { "*.md": ["@docs-team"] }
  },
  "conventions": {
    "branch_prefix": { "BUG": "fix", "DOCS": "docs", "FEATURE": "feature" },
    "test_commands": ["npm run lint"],
    "lint_command": "npm run lint",
    "build_command": "npm run build",
    "style_guide": "standard"
  }
}
```

## Output

```typescript
interface PlannerAgentOutput extends AgentResponse<FixPlan> {}
```

**Example Success Output**:
```json
{
  "success": true,
  "data": {
    "issue_number": 42,
    "branch_name": "docs/42-fix-typo-readme-installation",
    "plan_steps": [
      {
        "order": 1,
        "description": "Read README.md and locate line 15",
        "command": null,
        "files_involved": ["README.md"]
      },
      {
        "order": 2,
        "description": "Replace 'teh' with 'the' on line 15",
        "command": null,
        "files_involved": ["README.md"]
      },
      {
        "order": 3,
        "description": "Verify markdown formatting is valid",
        "command": "npm run lint",
        "files_involved": ["README.md"]
      }
    ],
    "file_changes": [
      {
        "path": "README.md",
        "operation": "MODIFY",
        "change_summary": "Correct typo: 'teh' → 'the' in installation instructions",
        "line_range": [15, 15]
      }
    ],
    "validation_commands": ["npm run lint"],
    "human_check_reason": null,
    "estimated_duration": 2,
    "timestamp": "2025-12-02T10:00:45Z"
  }
}
```

**Example MEDIUM Risk Output** (requires human review):
```json
{
  "success": true,
  "data": {
    "issue_number": 43,
    "branch_name": "fix/43-update-api-endpoint-routes",
    "plan_steps": [ /* ... */ ],
    "file_changes": [
      { "path": "src/api/routes.ts", "operation": "MODIFY" },
      { "path": "src/api/handlers.ts", "operation": "MODIFY" },
      { "path": "src/types/api.ts", "operation": "MODIFY" }
    ],
    "validation_commands": ["npm run lint", "npm run type-check", "npm run build"],
    "human_check_reason": "Multi-file change (3 files) affecting API routes. Draft PR will require maintainer review.",
    "estimated_duration": 15,
    "timestamp": "2025-12-02T10:02:00Z"
  }
}
```

## Processing Logic

### 1. Branch Name Generation (FR-007)

```typescript
function generateBranchName(
  issue_number: number,
  classification: IssueType,
  title: string,
  branch_prefix: Record<IssueType, string>
): string {
  const prefix = branch_prefix[classification] || 'fix';
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .trim()
    .split(/\s+/)
    .slice(0, 5) // First 5 words
    .join('-')
    .substring(0, 50); // Max 50 chars
  
  return `${prefix}/${issue_number}-${slug}`;
}
```

**Examples**:
- Issue #42: "Fix typo in README" → `fix/42-fix-typo-readme`
- Issue #100: "Add dark mode support for dashboard component" → `feature/100-add-dark-mode-support-dashboard`

### 2. Plan Step Generation

```typescript
function generatePlanSteps(
  issue: Issue,
  triage_result: TriageResult
): PlanStep[] {
  // Use LLM to generate implementation steps
  const llmPrompt = `
Given this GitHub issue, generate 3-7 ordered implementation steps.

Issue: ${issue.title}
Details: ${issue.body}
Affected Files: ${triage_result.affected_files.join(', ')}

For each step, provide:
1. Step number (order)
2. Description (what to do)
3. Shell command (if applicable, or null)
4. Files involved

Respond with JSON array of PlanStep objects.
`;
  
  const steps = callLLM(llmPrompt);
  return steps.map((s, idx) => ({ ...s, order: idx + 1 }));
}
```

### 3. File Change Analysis

```typescript
function analyzeFileChanges(
  affected_files: string[],
  plan_steps: PlanStep[]
): FileChange[] {
  return affected_files.map(path => {
    const operation = determineOperation(path, plan_steps);
    const change_summary = summarizeChange(path, plan_steps);
    const line_range = estimateLineRange(path, plan_steps); // null if CREATE/DELETE
    
    return { path, operation, change_summary, line_range };
  });
}

function determineOperation(path: string, steps: PlanStep[]): 'CREATE' | 'MODIFY' | 'DELETE' {
  const mentions = steps.filter(s => s.files_involved.includes(path));
  if (mentions.some(s => s.description.includes('create'))) return 'CREATE';
  if (mentions.some(s => s.description.includes('delete') || s.description.includes('remove'))) return 'DELETE';
  return 'MODIFY';
}
```

### 4. Validation Commands (FR-008)

```typescript
function selectValidationCommands(
  risk: RiskLevel,
  affected_files: string[],
  conventions: ProjectConventions
): string[] {
  const commands: string[] = [];
  
  // Always lint
  commands.push(conventions.lint_command);
  
  // Type-check if TypeScript files affected
  if (affected_files.some(f => f.endsWith('.ts') || f.endsWith('.vue'))) {
    commands.push('npm run type-check');
  }
  
  // Build for MEDIUM+ risk
  if (risk === 'MEDIUM' || risk === 'HIGH') {
    commands.push(conventions.build_command);
  }
  
  // NEVER add test commands (Constitution Principle V: NO TESTING)
  return commands.filter(c => !c.includes('test'));
}
```

### 5. Human Review Check (FR-010)

```typescript
function evaluateHumanReviewNeed(
  risk: RiskLevel,
  file_changes: FileChange[],
  estimated_complexity: Complexity
): string | null {
  if (risk === 'HIGH') {
    return "HIGH risk issue requires full human review before any code changes.";
  }
  
  if (risk === 'MEDIUM') {
    return `MEDIUM risk: ${file_changes.length} files affected. Draft PR will require maintainer approval.`;
  }
  
  if (file_changes.length > 5) {
    return `Large scope: ${file_changes.length} files affected (> 5 file limit). Requires review.`;
  }
  
  if (estimated_complexity === 'COMPLEX') {
    return "Complex implementation detected. Human verification recommended.";
  }
  
  return null; // Auto-fix can proceed
}
```

### 6. Complexity Estimation

```typescript
function estimateComplexity(plan_steps: PlanStep[], file_changes: FileChange[]): Complexity {
  const step_count = plan_steps.length;
  const file_count = file_changes.length;
  
  if (step_count <= 3 && file_count === 1) return 'TRIVIAL';
  if (step_count <= 5 && file_count <= 2) return 'SIMPLE';
  if (step_count <= 10 && file_count <= 5) return 'MODERATE';
  return 'COMPLEX';
}

function estimateDuration(complexity: Complexity): number {
  switch (complexity) {
    case 'TRIVIAL': return 2;  // 2 minutes
    case 'SIMPLE': return 5;   // 5 minutes
    case 'MODERATE': return 15; // 15 minutes
    case 'COMPLEX': return 30;  // 30 minutes (likely requires human)
  }
}
```

## Performance Requirements

- **Latency**: < 60 seconds total
- **LLM calls**: Maximum 1 (for plan step generation)
- **GitHub API calls**: 0 (uses data from triage agent)

## Side Effects

**None** - Planner agent is read-only. Output is consumed by Code Agent.

## Error Scenarios

| Scenario | Error Code | Action |
|----------|-----------|--------|
| Cannot generate valid plan steps | `PLANNING_FAILED` | Return error, request human planning |
| Affected files not found in repo | `FILE_NOT_FOUND` | Return error, update affected_files in triage |
| Branch name collision (already exists) | `BRANCH_EXISTS` | Append random suffix or increment number |
| LLM generates invalid JSON | `INVALID_LLM_OUTPUT` | Retry once, then return error |

## Validation Rules

- `branch_name` must match regex: `^(fix|feature|docs|chore)/\d+-[a-z0-9-]{1,50}$`
- `plan_steps` must be ordered sequentially (1, 2, 3, ...)
- `file_changes` paths must exist in `repository_context.file_tree` (unless operation=CREATE)
- `validation_commands` must NOT include "test" (per Constitution)
- If `risk === 'MEDIUM'`, then `human_check_reason` must be non-null
- If `file_changes.length > 5`, then `human_check_reason` must be non-null

## Testing Approach

**Manual Verification Steps**:

1. **Simple Docs Fix**: Triage result for README typo
   - Verify: branch_name = `docs/42-fix-typo-readme`
   - Verify: plan_steps has 3-4 steps
   - Verify: file_changes has 1 MODIFY operation
   - Verify: validation_commands = `["npm run lint"]`
   - Verify: human_check_reason = null

2. **Multi-File Change**: Triage result for API endpoint update
   - Verify: branch_name = `fix/43-update-api-endpoint`
   - Verify: plan_steps has 5-8 steps
   - Verify: file_changes has 3+ MODIFY operations
   - Verify: validation_commands includes lint, type-check, build
   - Verify: human_check_reason explains multi-file scope

3. **Complex Refactor**: Triage result for large restructure
   - Verify: estimated_complexity = COMPLEX
   - Verify: human_check_reason = "Complex implementation..."
   - Verify: estimated_duration ≥ 30 minutes

## Integration Points

- **Input Source**: Triage Agent output (via workflow artifact)
- **Output Destination**: Workflow artifact for Code Agent
- **Next Agent**: Code Agent (executes the plan)
