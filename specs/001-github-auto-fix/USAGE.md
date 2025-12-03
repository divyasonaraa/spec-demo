# Usage Guide: Auto-Fix System with Conditional Triggering

## Overview

The auto-fix system now uses a **two-step approval process**:

1. **Automatic Triage** - Runs when issue is created (no approval needed)
2. **Manual Approval** - Human adds label to trigger auto-fix (requires approval)

This ensures human oversight before any code changes are made.

---

## Workflow Steps

### Step 1: Create an Issue (Automatic Triage)

When you create a GitHub issue, the triage agent automatically:

✅ Classifies the issue type (BUG, FEATURE, DOCS, etc.)  
✅ Assesses risk level (LOW, MEDIUM, HIGH)  
✅ Checks for security concerns  
✅ Applies labels (`auto-triage`, classification, risk level)  
✅ Posts a detailed comment with analysis  

**Timeline**: Completes within 30 seconds

**Example Issue:**
```
Title: Fix typo in README
Body: Line 10 has 'teh' instead of 'the'
```

**Result:**
- Labels added: `auto-triage`, `docs`, `low-risk`
- Comment posted with classification details
- Auto-fix decision: "✅ Eligible for automatic fix"

---

### Step 2: Review Triage Results

Check the triage comment on your issue. It will show:

```markdown
## 🤖 Auto-Triage Complete

**Classification**: DOCS (95% confidence)
**Risk Level**: 🟢 LOW (score: 15/100)
**Auto-Fix Decision**: ✅ Eligible for automatic fix

**To proceed with auto-fix**: Add the `auto-fix` or `auto-fix-approved` label to this issue.

Once labeled, the system will automatically:
1. Generate a comprehensive fix
2. Run validation checks (lint, type-check)
3. Create a pull request
```

---

### Step 3: Approve Auto-Fix (Manual Decision)

**Decision Point**: Do you want the system to automatically fix this issue?

#### Option A: Approve Auto-Fix

Add one of these labels to trigger auto-fix:
- `auto-fix` (recommended)
- `auto-fix-approved` (alternative)

**How to add label:**
1. Go to the issue page
2. Click "Labels" on the right sidebar
3. Select `auto-fix`
4. Done! Workflow starts immediately

#### Option B: Decline Auto-Fix

- Don't add any approval label
- Implement the fix manually
- Or wait for someone else to implement it

---

### Step 4: Monitor Auto-Fix Execution (Automatic)

Once you add the `auto-fix` label, the system automatically:

**Prerequisites Check** (5 seconds)
- ✓ Verifies auto-fix label is present
- ✓ Confirms no security violations
- ✓ Validates risk level is acceptable

**Auto-Fix Generation** (1-2 minutes)
- ✓ Fetches project context (framework, dependencies, structure)
- ✓ Loads affected files + related dependencies (up to 8 files)
- ✓ Generates comprehensive fix using AI (senior developer level)
- ✓ Applies changes to working directory
- ✓ Runs validation (lint, type-check, build if medium risk)
- ✓ Creates commit with detailed message
- ✓ Pushes branch to repository

**PR Creation** (10 seconds)
- ✓ Formats comprehensive PR description
- ✓ Creates pull request (draft if medium risk)
- ✓ Applies labels
- ✓ Requests reviewers from CODEOWNERS

**Timeline**: Total 2-3 minutes from label addition to PR creation

---

### Step 5: Review Pull Request

The auto-fix system creates a PR with:

**Comprehensive Description**:
- Summary of what changed
- Root cause explanation
- List of modified files with change summaries
- Validation results (lint, type-check output)
- Risk assessment details
- Manual verification steps
- Rollback instructions

**Example PR:**
```markdown
## Summary
Fixed typo in README.md: 'teh' → 'the'

## What Changed
- `README.md`: Corrected spelling error on line 10

## Why
User reported typo in installation section that could cause confusion.

## Manual Verification
1. Open README.md
2. Navigate to line 10
3. Verify spelling is correct

## Risk Assessment
**Risk Level**: LOW
**Affected Areas**: README.md
**Rollback**: `git revert abc123`

<details>
<summary>Validation Results</summary>

✓ npm run lint: PASSED (1.2s)
✓ npm run type-check: PASSED (3.4s)
</details>
```

---

### Step 6: Merge or Request Changes

**For LOW risk PRs:**
- Review the changes
- Approve and merge if correct
- Request changes if fix is incomplete

**For MEDIUM risk PRs (draft):**
- PR is created in draft mode
- Must manually mark as "Ready for review"
- Requires explicit approval before merge

---

## Decision Matrix

| Issue Risk | Security Concerns | Triage Decision | Human Action Required | Auto-Fix Behavior |
|-----------|------------------|-----------------|----------------------|-------------------|
| LOW | None | AUTO_FIX eligible | Add `auto-fix` label | Creates PR, ready to merge |
| MEDIUM | None | DRAFT_PR eligible | Add `auto-fix` label | Creates draft PR, needs approval |
| HIGH | None | HUMAN_REVIEW_REQUIRED | Manual implementation | No auto-fix |
| Any | Yes | HUMAN_REVIEW_REQUIRED | Manual implementation | No auto-fix |

---

## Labels Reference

| Label | Meaning | When Applied | Action |
|-------|---------|--------------|--------|
| `auto-fix` | **Approval to proceed** | Manually by maintainer | Triggers auto-fix workflow |
| `auto-fix-approved` | Alternative approval | Manually by maintainer | Triggers auto-fix workflow |
| `auto-triage` | Issue has been triaged | Automatically by triage agent | Informational |
| `low-risk` | Safe for auto-fix | Automatically by triage agent | Eligible for AUTO_FIX |
| `medium-risk` | Needs review | Automatically by triage agent | Creates draft PR |
| `high-risk` | Requires manual fix | Automatically by triage agent | No auto-fix |
| `security` | Security-sensitive | Automatically by triage agent | No auto-fix |
| `human-review-required` | Manual implementation needed | Automatically by triage agent | No auto-fix |
| `automation-failed` | Auto-fix error | Automatically by agents | Check workflow logs |

---

## Common Scenarios

### Scenario 1: Simple Typo Fix

**Issue**: "Fix typo in README: 'teh' → 'the'"

1. ✅ Triage: Classified as DOCS, LOW risk
2. ✅ Human adds `auto-fix` label
3. ✅ Auto-fix creates PR within 2 minutes
4. ✅ Maintainer reviews and merges

**Result**: Fixed in < 5 minutes with human oversight

---

### Scenario 2: Component Bug Fix

**Issue**: "BaseButton component doesn't handle disabled state"

1. ✅ Triage: Classified as BUG, MEDIUM risk
2. ✅ Human adds `auto-fix` label
3. ✅ Auto-fix creates draft PR with comprehensive fix
4. ✅ Draft PR includes validation results
5. ⏸️ Maintainer reviews draft, tests locally
6. ✅ Maintainer approves and merges

**Result**: High-quality fix with human validation checkpoint

---

### Scenario 3: Security-Related Issue

**Issue**: "Update API key in .env file"

1. ✅ Triage: Classified as HIGH risk, security concerns detected
2. 🚫 Auto-fix decision: HUMAN_REVIEW_REQUIRED
3. ℹ️ Comment explains why auto-fix is blocked
4. 👤 Maintainer implements manually

**Result**: Security-sensitive change properly handled by human

---

### Scenario 4: Feature Request

**Issue**: "Add dark mode toggle"

1. ✅ Triage: Classified as FEATURE, MEDIUM risk
2. ✅ Human adds `auto-fix` label (if simple enough)
3. ✅ Auto-fix attempts implementation
4. ⚠️ May fail validation or be incomplete
5. 👤 Maintainer reviews draft PR, adds missing pieces

**Result**: Auto-fix provides starting point, human completes

---

## Configuration Options

### AI Provider Configuration

The system auto-detects your AI provider based on available API keys:

| Provider | API Key Variable | Token Limits | Best For |
|----------|-----------------|--------------|----------|
| **GitHub Models** (default) | `GITHUB_TOKEN` | 8k input / 2k output | Small fixes, free tier |
| **OpenAI GPT-4** | `OPENAI_API_KEY` | 30k input / 4k output | Medium complexity |
| **Anthropic Claude** | `ANTHROPIC_API_KEY` | 50k input / 8k output | Complex fixes, best quality |

**Priority Order**: Anthropic > OpenAI > GitHub Models

**To use a specific provider**, set the appropriate secret in your repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
3. The workflow will automatically use the higher-capacity provider

**Example workflow configuration**:
```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  # OR
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Token Budget Behavior

The system adapts its behavior based on available tokens:

**GitHub Models (8k tokens)**:
- Uses compact prompts (~400 token overhead)
- Fetches fewer files (2-4 depending on size)
- Compresses large files (extracts key sections)
- Simpler output format

**Anthropic/OpenAI (30k+ tokens)**:
- Uses detailed prompts (~800 token overhead)  
- Fetches more files (6-8 for better context)
- Full file contents when possible
- Comprehensive output with explanations

### Approval Labels

You can customize which labels trigger auto-fix by editing the workflow:

```yaml
# .github/workflows/auto-fix.yml
jobs:
  check-prerequisites:
    steps:
      - name: Check if auto-fix should proceed
        run: |
          # Check for custom labels
          if echo "$LABELS" | jq -e '.[] | select(. == "auto-fix" or . == "ready-to-autofix" or . == "🤖")' > /dev/null; then
            echo "should_proceed=true" >> $GITHUB_OUTPUT
          fi
```

### Risk Thresholds

Adjust what risk levels are eligible for auto-fix:

```javascript
// .github/agents/shared/risk-assessment.js
const AUTO_FIX_ELIGIBLE = ['LOW'];              // Default: LOW only
const DRAFT_PR_ELIGIBLE = ['LOW', 'MEDIUM'];    // Default: LOW and MEDIUM
```

---

## Troubleshooting

### Auto-Fix Didn't Run

**Check**:
1. Is `auto-fix` or `auto-fix-approved` label added?
2. Does issue have `auto-triage` label? (If not, triage might have failed)
3. Check Actions tab for workflow run
4. Look for error in issue comments

### Auto-Fix Failed

**Common causes**:
- Validation failed (lint/type-check errors)
- Security violation detected
- File conflicts
- AI timeout

**Resolution**:
1. Check workflow logs in Actions tab
2. Look for `automation-failed` label
3. Read error comment on issue
4. Implement manually or adjust constraints

### Token/Context Limit Errors

If you see errors like "Request body too large" or "Max tokens exceeded":

**Cause**: Too many/large files for the AI provider's token limit

**Solutions**:
1. **Use a higher-capacity provider**: Add `ANTHROPIC_API_KEY` for 50k tokens
2. **Simplify the issue**: Focus on one file at a time
3. **Mention specific files**: "Fix in `src/components/Button.vue` only"
4. **Check logs**: The system logs token usage - review in Actions tab

**Token Budget Output Example**:
```
[AI Client] Using GitHub Models (github-models)
[AI Client] Token budget: 8000 input, 2000 output
[FileDiscovery] Token usage: 5200/5600 tokens (92.8%)
```

### PR Quality Issues

**If auto-fix creates incomplete/wrong fixes**:
1. Close the PR with explanation
2. Comment on issue with what went wrong
3. Consider if issue needs more detail
4. Implement manually
5. Optionally: Improve AI prompt in `auto-fix-agent.js`

---

## Best Practices

### When to Use Auto-Fix

✅ **Use for**:
- Typo corrections
- Simple bug fixes with clear root cause
- Documentation updates
- Import statement additions
- Formatting fixes
- Simple component prop additions

❌ **Don't use for**:
- Security-related changes
- Complex refactoring
- Breaking changes
- Database migrations
- Infrastructure changes
- Anything involving secrets/credentials

### Reviewing Auto-Fix PRs

Even for LOW risk issues:
1. **Read the diff** - Verify changes match issue description
2. **Check validation results** - Ensure lint/type-check passed
3. **Consider edge cases** - Could this break anything?
4. **Test locally if unsure** - Pull the branch and test
5. **Look for unintended changes** - Ensure only affected files changed

### Improving Fix Quality

To get better auto-fix results:

**Write better issue descriptions**:
- ✅ "BaseButton component doesn't show loading spinner when `isLoading` prop is true. Need to add conditional rendering of spinner icon."
- ❌ "Button broken"

**Mention affected files**:
- "This affects `src/components/base/BaseButton.vue`"

**Provide context**:
- "Currently the button only handles `disabled` state but not `loading` state"
- "Other components like BaseInput already implement loading state properly"

---

## Security Considerations

The system has multiple security layers:

1. **Triage Stage**: Security keyword and file path detection
2. **Prerequisites Stage**: Label-based human approval gate
3. **Auto-Fix Stage**: Security pre-check before any file writes
4. **GitHub**: Branch protection and required reviews

**Blocked Patterns**:
- `.env*` files
- `config/secrets/*` paths
- `*.pem`, `*.key` files
- CI/CD workflow files
- Deployment configurations
- Authentication code
- Database migrations

**To disable auto-fix for specific repos**:
```yaml
# .github/workflows/auto-fix.yml
on:
  issues:
    types: [opened, labeled]
  # Add condition to skip
  workflow_dispatch: # Manual only
```

---

## Metrics to Track

Monitor these metrics to evaluate auto-fix effectiveness:

- **Triage accuracy**: % of issues correctly classified
- **Auto-fix success rate**: % of approved issues that result in merged PRs
- **Time to resolution**: Average time from issue creation to PR merge
- **False positive rate**: % of auto-fix PRs that need significant rework
- **Security incidents**: Any security issues introduced (should be 0)

---

## Support

For issues:
1. Check workflow logs: **Actions** → Select workflow run → Expand steps
2. Review triage/error comments on issue
3. Check [contracts documentation](./contracts/) for agent API details
4. See [research document](./research.md) for technical decisions
