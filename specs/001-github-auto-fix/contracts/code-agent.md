# Code Agent Contract

**Agent**: Code Agent  
**Purpose**: Generate and apply code changes based on implementation plan  
**Phase**: 3 - Code Generation & Validation

## Input

```typescript
interface CodeAgentInput {
  issue: Issue;
  triage_result: TriageResult;
  fix_plan: FixPlan;
  repository_snapshot: RepositorySnapshot;
}

interface RepositorySnapshot {
  branch: string;                 // Current branch (usually default_branch)
  files: Record<string, string>;  // File path → content (only affected files)
  git_ref: string;                // Commit SHA of snapshot
  style_config: StyleConfig;      // .editorconfig, .prettierrc, etc.
}

interface StyleConfig {
  indent_style: 'space' | 'tab';
  indent_size: number;
  end_of_line: 'lf' | 'crlf';
  insert_final_newline: boolean;
}
```

**Example Input**:
```json
{
  "issue": {
    "number": 42,
    "title": "Fix typo in README",
    "body": "Line 15: 'teh' should be 'the'"
  },
  "triage_result": {
    "risk": "LOW",
    "affected_files": ["README.md"]
  },
  "fix_plan": {
    "branch_name": "docs/42-fix-typo-readme",
    "plan_steps": [ /* ... */ ],
    "file_changes": [
      {
        "path": "README.md",
        "operation": "MODIFY",
        "line_range": [15, 15]
      }
    ],
    "validation_commands": ["npm run lint"]
  },
  "repository_snapshot": {
    "branch": "main",
    "files": {
      "README.md": "# Project\n\n## Installation\n\nRun teh following command..."
    },
    "git_ref": "abc123def456",
    "style_config": {
      "indent_style": "space",
      "indent_size": 2,
      "end_of_line": "lf",
      "insert_final_newline": true
    }
  }
}
```

## Output

```typescript
interface CodeAgentOutput extends AgentResponse<Commit[]> {}
```

**Example Success Output**:
```json
{
  "success": true,
  "data": [
    {
      "issue_number": 42,
      "message": "docs(readme): correct typo in installation section\n\nFixes #42",
      "diff": "--- a/README.md\n+++ b/README.md\n@@ -12,7 +12,7 @@\n \n ## Installation\n \n-Run teh following command:\n+Run the following command:\n \n ```bash\n npm install\n",
      "files_changed": ["README.md"],
      "timestamp": "2025-12-02T10:01:30Z",
      "validation_results": [
        {
          "command": "npm run lint",
          "exit_code": 0,
          "stdout": "✓ All files pass linting",
          "stderr": "",
          "duration_ms": 1234
        }
      ],
      "sha": ""
    }
  ]
}
```

**Example Validation Failure**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Linting failed after applying changes",
    "details": {
      "command": "npm run lint",
      "exit_code": 1,
      "stderr": "README.md:15: Markdown link broken"
    },
    "recoverable": false
  }
}
```

## Processing Logic

### 1. Create Feature Branch (FR-007)

```bash
# Check out from default branch
git checkout ${repository_snapshot.branch}
git pull origin ${repository_snapshot.branch}

# Create new branch
git checkout -b ${fix_plan.branch_name}
```

**Idempotency**: Check if branch exists first:
```bash
if git rev-parse --verify ${fix_plan.branch_name} 2>/dev/null; then
  echo "Branch already exists, using existing"
  git checkout ${fix_plan.branch_name}
else
  git checkout -b ${fix_plan.branch_name}
fi
```

### 2. Generate Code Changes (FR-018)

```typescript
async function generateDiff(
  file_change: FileChange,
  current_content: string,
  issue: Issue,
  style_config: StyleConfig
): Promise<string> {
  const llmPrompt = `
You are a code assistant. Generate a minimal unified diff to fix this issue.

Issue: ${issue.title}
Details: ${issue.body}

File: ${file_change.path}
Operation: ${file_change.operation}
Current Content:
\`\`\`
${current_content}
\`\`\`

Requirements:
- Preserve existing code style (${style_config.indent_style}, ${style_config.indent_size} spaces)
- Make ONLY the minimal change described in the issue
- Output unified diff format (--- a/path +++ b/path @@ range @@)
- Do NOT include code markers like "...existing code..." in diff

Respond with raw unified diff only, no explanation.
`;
  
  const diff = await callLLM(llmPrompt);
  return diff;
}
```

### 3. Apply Changes

```bash
# Write diff to temporary file
echo "${diff}" > /tmp/fix.patch

# Validate patch format
git apply --check /tmp/fix.patch
if [ $? -ne 0 ]; then
  echo "ERROR: Invalid patch format" >&2
  exit 1
fi

# Apply patch
git apply /tmp/fix.patch

# Stage changes
git add ${file_changes.path}
```

### 4. Run Validation (FR-008, FR-016)

```typescript
async function runValidation(commands: string[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  
  for (const command of commands) {
    const start = Date.now();
    const result = await execShell(command);
    const duration_ms = Date.now() - start;
    
    results.push({
      command,
      exit_code: result.code,
      stdout: result.stdout.slice(0, 1000), // Truncate
      stderr: result.stderr.slice(0, 1000),
      duration_ms
    });
    
    // Stop on first failure
    if (result.code !== 0) {
      await rollback();
      throw new ValidationError(command, result);
    }
  }
  
  return results;
}

async function rollback() {
  // Undo uncommitted changes
  await execShell('git reset --hard HEAD');
  // Delete branch
  await execShell(`git checkout ${default_branch}`);
  await execShell(`git branch -D ${branch_name}`);
}
```

### 5. Create Commit (FR-019)

```bash
# Generate conventional commit message
commit_message=$(generate_commit_message \
  "${issue.title}" \
  "${issue.number}" \
  "${triage_result.classification}")

# Commit with sign-off
git commit -m "${commit_message}" --signoff

# Get commit SHA
sha=$(git rev-parse HEAD)
echo "Committed: ${sha}"
```

**Commit Message Format** (Conventional Commits):
```
<type>(<scope>): <description>

Fixes #<issue_number>

[optional body]
```

**Examples**:
- `docs(readme): correct typo in installation section\n\nFixes #42`
- `fix(form): handle null values in validation\n\nFixes #108`
- `feat(dashboard): add dark mode toggle\n\nFixes #250`

### 6. Push Branch

```bash
# Push to remote
git push origin ${branch_name}

# Verify push succeeded
if [ $? -eq 0 ]; then
  echo "Branch pushed successfully"
else
  echo "ERROR: Failed to push branch" >&2
  rollback
  exit 1
fi
```

## Performance Requirements

- **Latency**: < 120 seconds total
  - Diff generation: < 30 seconds (LLM call)
  - Apply + validation: < 90 seconds (depends on lint/build duration)
- **LLM calls**: 1 per file_change (parallelize if multiple files)
- **Git operations**: 5-7 total (checkout, create branch, apply, commit, push)

## Side Effects

1. **Creates git branch** in repository
2. **Commits changes** with conventional commit message
3. **Pushes branch** to origin
4. **Rollback on failure**: Deletes branch, reverts changes

## Error Scenarios

| Scenario | Error Code | Action |
|----------|-----------|--------|
| Patch fails to apply (merge conflict) | `GIT_CONFLICT` | Rollback, comment on issue requesting manual fix |
| Validation command fails (lint error) | `VALIDATION_FAILED` | Rollback, post validation output in issue comment |
| Git push fails (permission denied) | `PERMISSION_DENIED` | Log error, notify admins, mark issue with "automation-failed" |
| LLM generates invalid diff | `INVALID_DIFF` | Retry once with refined prompt, then abort |
| Branch already exists with different changes | `BRANCH_EXISTS` | Error (should not happen with issue number in name) |

## Validation Rules

- **Commit message** must match: `^(fix|feat|docs|chore|refactor)\([a-z-]+\): .{10,100}$`
- **Diff** must be valid unified diff format (parsable by `git apply`)
- **files_changed** must match `file_changes` from FixPlan
- **validation_results** must all have `exit_code === 0`
- **sha** must be 40-char git commit SHA after push
- **Style preservation**: Indentation, line endings must match `style_config`

## Security Checks

Before applying any changes, verify:
```typescript
function securityPreCheck(file_changes: FileChange[]): void {
  const BLOCKED_PATTERNS = [
    '**/.env*',
    '**/config/secrets/**',
    '**/*.pem',
    '**/*.key',
    '**/deployment/**'
  ];
  
  for (const change of file_changes) {
    if (BLOCKED_PATTERNS.some(pattern => matchesPattern(change.path, pattern))) {
      throw new SecurityError(`Attempted to modify blocked file: ${change.path}`);
    }
  }
}
```

## Testing Approach

**Manual Verification Steps**:

1. **Simple Typo Fix**:
   - Create issue #42: "Fix typo in README"
   - Run code agent with planner output
   - Verify: Branch `docs/42-fix-typo-readme` created
   - Verify: Commit message: `docs(readme): correct typo...`
   - Verify: README.md changed correctly
   - Verify: `npm run lint` passes

2. **Validation Failure**:
   - Create issue that results in syntax error
   - Run code agent
   - Verify: Lint fails with exit_code=1
   - Verify: Rollback executed (branch deleted)
   - Verify: Error comment posted on issue

3. **Multi-File Change**:
   - Create issue affecting 3 files
   - Run code agent
   - Verify: All 3 files modified in single commit
   - Verify: All validations pass
   - Verify: Commit SHA returned

## Integration Points

- **Input Source**: Planner Agent output + repository clone
- **Output Destination**: Workflow artifact for PR Generator
- **Side Effects**: Git operations in repository
- **Next Agent**: PR Generator (creates pull request)

## Rollback Procedure

If ANY step fails:
```bash
# 1. Reset working directory
git reset --hard HEAD

# 2. Switch back to default branch
git checkout main

# 3. Delete feature branch (local)
git branch -D ${branch_name} 2>/dev/null || true

# 4. Delete feature branch (remote) if already pushed
git push origin --delete ${branch_name} 2>/dev/null || true

# 5. Post error comment on issue
post_comment_to_issue \
  "${issue_number}" \
  "Automated fix failed during ${failed_step}. Details: ${error_message}"

# 6. Add label
add_label_to_issue "${issue_number}" "automation-failed"
```

## LLM Prompt Engineering

### Diff Generation Prompt Template

```typescript
const DIFF_GENERATION_PROMPT = `
You are an expert code editor. Generate a minimal unified diff to implement the requested change.

CONTEXT:
- Issue: ${issue.title}
- Details: ${issue.body}
- File: ${file_change.path}
- Line Range: ${file_change.line_range || 'entire file'}

CURRENT CONTENT:
\`\`\`
${current_content}
\`\`\`

STYLE REQUIREMENTS:
- Indentation: ${style_config.indent_style === 'space' ? style_config.indent_size + ' spaces' : 'tabs'}
- Line endings: ${style_config.end_of_line.toUpperCase()}
- Final newline: ${style_config.insert_final_newline ? 'required' : 'optional'}

CONSTRAINTS:
1. Make ONLY the minimal change to fix the issue
2. Preserve ALL existing formatting, comments, and whitespace
3. Do NOT refactor or "improve" unrelated code
4. Output ONLY the unified diff (no explanations, no markdown blocks)
5. Diff must be directly applicable with 'git apply'

UNIFIED DIFF FORMAT:
--- a/${file_change.path}
+++ b/${file_change.path}
@@ -<old_start>,<old_count> +<new_start>,<new_count> @@
<context lines>
-<removed line>
+<added line>
<context lines>

OUTPUT:
`;
```

## Atomic Commit Principle (FR-019)

Each commit must represent a single logical change:

- **One issue = One commit** (unless issue explicitly requests multiple steps)
- **Commit message references issue**: `Fixes #<number>`
- **All files for that change included**: No partial commits
- **No bundling unrelated fixes**: Don't fix other issues "while we're here"

**Exception**: If FixPlan has `plan_steps.length > 10`, may split into multiple commits (one per major step), but keep atomic within each step.
