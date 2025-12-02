# Debugging Guide: Workflow Failure for Issue #33

## Error Summary
```
[PR Generator] ✗ Failed after 0.81s: PR_CREATION_FAILED
Error: Process completed with exit code 1.
```

## Root Cause
The code agent failed because `fix-plan.json` was not found:
```json
{
  "error": {
    "code": "ENOENT",
    "message": "ENOENT: no such file or directory, open 'fix-plan.json'"
  }
}
```

This means the **planner agent** likely failed or didn't upload its artifact properly.

---

## How to Debug

### Step 1: Check the Workflow Run
1. Go to: https://github.com/divyasonaraa/spec-demo/actions
2. Click on the failed workflow run for issue #33
3. Check each job:
   - ✅ **Triage** - Did it complete?
   - ❓ **Planner** - Did it complete? Check for errors
   - ❌ **Code** - Failed because fix-plan.json missing
   - ❌ **PR** - Skipped or failed

### Step 2: Check Planner Job Logs
Expand the "Generate Fix Plan" job and look for:
```bash
# Successful planner output should show:
[Planner] Result written to ./fix-plan.json
[Planner] ✓ Completed in X.XXs

# If you see errors like:
# - Anthropic API errors
# - Timeout errors
# - Invalid triage-result.json
```

### Step 3: Check Artifacts
In the workflow run, scroll to bottom and check "Artifacts" section:
- ✅ `triage-result` - Should exist
- ❓ `fix-plan` - **This is likely missing!**
- ❌ `commit-result` - Contains error
- ❌ `pr-result` - Not created

---

## Common Causes & Fixes

### Cause 1: AI API Timeout or Rate Limit
**Symptom**: Planner job times out or fails with Anthropic API error

**Solution**: 
- Wait a few minutes and retry
- Or: Update timeout in workflow (currently 2 minutes for planner)

### Cause 2: Invalid Triage Result
**Symptom**: Planner can't read triage-result.json

**Solution**:
- Check triage artifact was uploaded correctly
- Verify triage-result.json format

### Cause 3: GitHub Actions Artifact Download Failed
**Symptom**: Artifacts exist but download step fails

**Solution**: Re-run the workflow

---

## Quick Fix: Re-run the Workflow

The easiest solution is to re-run the failed workflow:

### Option A: Re-run from GitHub UI
1. Go to the failed workflow run
2. Click "Re-run failed jobs" button (top right)
3. Or click "Re-run all jobs"

### Option B: Trigger Manually with workflow_dispatch
1. Go to Actions → Auto-Fix GitHub Issues
2. Click "Run workflow"
3. Enter issue number: `33`
4. Click "Run workflow"

---

## If Problem Persists

### Check Planner Agent Locally

```bash
cd .github/agents

# First, you need a triage-result.json (from the artifact or create mock)
cat > triage-result.json << 'EOF'
{
  "success": true,
  "data": {
    "issueNumber": 33,
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
    "affectedFiles": ["src/components/form/FieldWrapper.vue"]
  }
}
EOF

# Run planner manually
GITHUB_TOKEN=your_token \
GITHUB_REPOSITORY=divyasonaraa/spec-demo \
ISSUE_NUMBER=33 \
TRIAGE_RESULT_PATH=./triage-result.json \
OUTPUT_PATH=./fix-plan.json \
node planner-agent.js

# Check if fix-plan.json was created
ls -la fix-plan.json
cat fix-plan.json
```

### Check for Missing Dependencies

```bash
cd .github/agents
npm install  # Ensure all dependencies are installed
```

---

## Expected Successful Flow

When working correctly, you should see:

**Triage (30s)**:
```
[Triage] Starting issue triage
[Triage] Classification: BUG
[Triage] Risk Level: LOW
[Triage] Decision: AUTO_FIX
[Triage] ✓ Completed in 25.3s
```

**Planner (60s)**:
```
[Planner] Generating fix plan for issue #33
[Planner] Branch: bug/33-form-validation-errors
[Planner] Files to modify: 1
[Planner] Result written to ./fix-plan.json
[Planner] ✓ Completed in 45.2s
```

**Code (120s)**:
```
[Code Agent] Starting for issue #33
[Code Agent] Branch: bug/33-form-validation-errors
[Code Agent] Applying patch...
[Code Agent] Running validation...
[Code Agent] ✓ Validation passed
[Code Agent] Committing changes...
[Code Agent] ✓ Completed in 78.5s
```

**PR (30s)**:
```
[PR Generator] Starting for issue #33
[PR Generator] Creating PR...
[PR Generator] PR created: #34
[PR Generator] ✓ Completed in 12.3s
```

---

## Next Steps

1. **Check the planner job logs** in the GitHub Actions UI
2. **Look for specific error messages** (API errors, timeouts, etc.)
3. **Re-run the workflow** if it was a transient error
4. **Test planner locally** if issue persists

Most likely this is a transient error (API timeout or rate limit). Re-running should fix it.

---

## Contact/Support

If the issue persists after re-running:
1. Check planner job logs for specific error
2. Download triage-result artifact to verify format
3. Test planner agent locally with the commands above
4. Check if GitHub Models API (Anthropic) is having issues
