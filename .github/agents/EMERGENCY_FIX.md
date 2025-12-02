# Emergency Fix: Issue #34 Workflow Failure

## Problem
The planner agent keeps failing for issue #34, preventing the auto-fix workflow from completing.

## Quick Diagnosis

### Check Workflow Logs on GitHub:
1. Go to: https://github.com/divyasonaraa/spec-demo/actions
2. Click on the latest "Auto-Fix GitHub Issues" run for issue #34
3. Click on **"Generate Fix Plan"** job
4. Look for the error message in the logs

### Common Errors to Look For:

**Error 1: AI API Timeout**
```
Error: Request timed out
Error: Anthropic API error
```
**Solution**: Re-run the workflow (it's transient)

**Error 2: GitHub Models API Issue**
```
Error: models: read permission required
Error: GitHub Models API unavailable
```
**Solution**: Check if GitHub Models is enabled in your repo settings

**Error 3: Issue Fetch Failure**
```
Error: Issue not found
Error: Resource not accessible
```
**Solution**: Check GITHUB_TOKEN permissions

---

## Immediate Fix Options

### Option 1: Re-run Workflow (Easiest)
1. Go to: https://github.com/divyasonaraa/spec-demo/actions
2. Find the failed run for issue #34
3. Click "Re-run failed jobs" or "Re-run all jobs"
4. Wait 2-3 minutes

### Option 2: Close and Re-open Issue #34
Sometimes this helps reset the workflow state:
1. Go to issue #34
2. Click "Close issue"
3. Wait 5 seconds
4. Click "Reopen issue"
5. Workflow will trigger automatically

### Option 3: Manual Fix (If Automation Keeps Failing)

Since the bug is simple (`v-if="false && error"` → `v-if="error"`), you can fix it manually:

```bash
# 1. Create a branch
git checkout -b fix/34-validation-errors

# 2. Edit the file
# Open: src/components/form/FieldWrapper.vue
# Find line with: v-if="false && error"
# Change to: v-if="error"

# 3. Commit and push
git add src/components/form/FieldWrapper.vue
git commit -m "fix: display validation errors below input fields

Fixes #34 - Removed false condition that prevented ValidationError
component from rendering."

git push origin fix/34-validation-errors

# 4. Create PR manually on GitHub
# Base: main
# Compare: fix/34-validation-errors
# Title: Fix #34: Form validation errors are not showing up below input fields
```

---

## Root Cause Investigation

### Check if GitHub Models API is Enabled:

The planner uses GitHub's Anthropic Claude API (via GitHub Models). This requires:

1. **Repository Settings**:
   - Go to: https://github.com/divyasonaraa/spec-demo/settings
   - Check if "GitHub Models" is enabled

2. **Workflow Permissions**:
   - Go to Settings → Actions → General
   - Check "Workflow permissions" is set to "Read and write permissions"
   - Verify "models: read" permission in workflow file

### Check Workflow File Permissions:

```bash
# View current workflow permissions
cd /home/divya/Projects/AI/dynamic-form-genrator
grep -A 10 "permissions:" .github/workflows/auto-fix.yml
```

Should show:
```yaml
permissions:
  issues: write
  contents: write
  pull-requests: write
  models: read  # ← This is required for GitHub Models API
```

---

## If GitHub Models API Not Available

If GitHub Models isn't available, you have two options:

### Option A: Use Direct Anthropic API Key

Add Anthropic API key as a repository secret:

1. Get API key from: https://console.anthropic.com/
2. Go to: https://github.com/divyasonaraa/spec-demo/settings/secrets/actions
3. Click "New repository secret"
4. Name: `ANTHROPIC_API_KEY`
5. Value: `sk-ant-...` (your key)

Then update the workflow to pass it:
```yaml
- name: Run planner agent
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}  # Add this
    # ... rest of env vars
```

### Option B: Manual Testing Mode

For now, just fix issues manually until the API access is resolved.

---

## Test Locally (Advanced)

If you want to debug the planner locally:

```bash
cd .github/agents

# Install dependencies
npm install

# Create mock triage result
cat > triage-result.json << 'EOF'
{
  "success": true,
  "data": {
    "issueNumber": 34,
    "title": "Form validation errors are not showing up below input fields",
    "classification": "BUG",
    "risk": {
      "level": "LOW",
      "score": 2,
      "factors": {
        "fileCount": 1,
        "hasSecurity": false
      }
    },
    "autoFixDecision": "AUTO_FIX",
    "affectedFiles": ["src/components/form/FieldWrapper.vue"],
    "securityFlags": {
      "hasSecurityKeywords": false,
      "hasSecurityFilePath": false,
      "hasRiskyChangeTypes": false
    }
  }
}
EOF

# Run planner locally (requires GITHUB_TOKEN)
export GITHUB_TOKEN="ghp_your_token_here"
export GITHUB_REPOSITORY="divyasonaraa/spec-demo"
export ISSUE_NUMBER=34
export TRIAGE_RESULT_PATH="./triage-result.json"
export OUTPUT_PATH="./fix-plan.json"

node planner-agent.js

# Check output
cat fix-plan.json
```

---

## Recommended Next Steps

1. **Check workflow logs** to see the exact error
2. **Verify GitHub Models API** is enabled
3. **Re-run the workflow** (most likely will work on retry)
4. **Or fix manually** if automation continues to fail

The bug itself is trivial to fix - the workflow failure is likely a temporary API issue or permissions problem.

---

## Contact Me With:

When you check the logs, let me know:
- The exact error message from the "Generate Fix Plan" job
- Whether GitHub Models is enabled in your repo
- Whether you have an Anthropic API key available

This will help me provide a specific fix.
