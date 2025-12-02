# Quick Testing Guide - GitHub Auto-Fix System

## ✅ Updated: Now supports OpenAI API!

The system now works with **OpenAI API** (you already have the key) or Anthropic API.

---

## Step 1: Add OpenAI API Key to Repository

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `OPENAI_API_KEY`
5. Value: Your OpenAI API key (starts with `sk-...`)
6. Click **Add secret**

---

## Step 2: Commit and Push Your Changes

```bash
# Make sure you're on the correct branch
git add .
git commit -m "feat: add OpenAI support for auto-fix triage agent"
git push origin 001-github-auto-fix
```

**Important**: The workflow file must be on your **default branch** (main/master) to trigger on issues!

To merge to main:
```bash
git checkout main
git merge 001-github-auto-fix
git push origin main
```

---

## Step 3: Create Labels (Required!)

Run these commands to create all required labels:

```bash
# Using GitHub CLI (recommended)
gh label create "auto-triage" --description "Issue has been automatically triaged" --color "0E8A16"
gh label create "low-risk" --description "Low risk change - safe for auto-fix" --color "0E8A16"
gh label create "medium-risk" --description "Medium risk - requires human review" --color "FBCA04"
gh label create "high-risk" --description "High risk - blocks auto-fix" --color "D93F0B"
gh label create "security" --description "Security-sensitive change" --color "D93F0B"
gh label create "human-review-required" --description "Requires maintainer review" --color "B60205"
gh label create "automation-failed" --description "Auto-fix workflow encountered an error" --color "D93F0B"

# Classification labels
gh label create "bug" --description "Something isn't working" --color "D93F0B"
gh label create "feature" --description "New feature or request" --color "A2EEEF"
gh label create "docs" --description "Documentation improvements" --color "0075CA"
gh label create "chore" --description "Maintenance tasks" --color "FEF2C0"
gh label create "other" --description "Uncategorized" --color "EDEDED"
```

Or create them manually via GitHub UI: **Issues** → **Labels** → **New label**

---

## Step 4: Test with a Simple Issue

### Test Case 1: Documentation Typo (Low Risk)

Create a new issue:

**Title**: 
```
Fix typo in README: 'teh' should be 'the'
```

**Body**:
```
There's a typo in README.md on line 10.

The word "teh" should be "the".

File: README.md
```

Click **Submit new issue**

---

## Step 5: Watch the Workflow

1. Go to **Actions** tab in your repository
2. You should see "Auto-Fix GitHub Issues" workflow running
3. Click on it to see the logs
4. The "Triage Issue" job should complete in ~10-20 seconds

---

## Step 6: Verify Results

Check the issue you created:

✅ **Expected Results**:
- Comment posted with triage analysis
- Labels applied: `auto-triage`, `docs`, `low-risk`
- Classification shown in comment
- Risk level: LOW
- Auto-fix decision: AUTO_FIX

---

## Troubleshooting

### Issue 1: Workflow Not Running

**Problem**: Created issue but nothing happens

**Solutions**:
1. Check workflow file is on default branch (main/master):
   ```bash
   git checkout main
   git merge 001-github-auto-fix
   git push origin main
   ```

2. Verify workflow file location: `.github/workflows/auto-fix.yml`

3. Check Actions are enabled:
   - Go to **Settings** → **Actions** → **General**
   - Ensure "Allow all actions and reusable workflows" is selected

4. Check workflow permissions:
   - **Settings** → **Actions** → **General** → **Workflow permissions**
   - Select "Read and write permissions"
   - Check "Allow GitHub Actions to create and approve pull requests"

### Issue 2: Permission Denied Error

**Error**: `Resource not accessible by integration`

**Solution**:
1. Go to **Settings** → **Actions** → **General**
2. Under "Workflow permissions", select **"Read and write permissions"**
3. Save changes
4. Re-run the workflow

### Issue 3: OPENAI_API_KEY Not Found

**Error**: `No AI provider configured`

**Solution**:
1. Verify secret is named exactly: `OPENAI_API_KEY` (not `OPENAI_KEY`)
2. Check it's in **Actions secrets** (not Environment secrets)
3. Re-run the workflow after adding the secret

### Issue 4: Labels Not Applied

**Error**: Labels missing on issue

**Solution**:
1. Create the labels first (see Step 3)
2. Check workflow logs for errors
3. Verify workflow has write permissions

---

## Manual Local Testing (Optional)

Test the triage agent locally before pushing:

```bash
cd .github/agents

# Set environment variables
export GITHUB_TOKEN=your_github_token
export OPENAI_API_KEY=your_openai_key
export GITHUB_REPOSITORY_OWNER=divyasonaraa
export GITHUB_REPOSITORY_NAME=spec-demo
export ISSUE_NUMBER=1

# Run triage agent
node triage-agent.js
```

---

## View Workflow Logs

To see detailed logs:

1. **Actions** tab → Click on workflow run
2. Click **Triage Issue** job
3. Expand **Run triage agent** step
4. Look for:
   - `Using keyword-based classification` (fast path)
   - `Using LLM fallback classification` (OpenAI call)
   - Final triage result JSON

---

## Expected Output in Logs

```json
{
  "level": "INFO",
  "message": "Starting issue triage",
  "repository": "divyasonaraa/spec-demo",
  "issueNumber": 1
}

{
  "level": "INFO",
  "message": "Using keyword-based classification",
  "classification": "DOCS",
  "confidence": 0.8
}

{
  "level": "INFO",
  "message": "Triage complete",
  "issueNumber": 1,
  "classification": "DOCS",
  "risk": "LOW",
  "autoFixDecision": "AUTO_FIX",
  "duration": 5234
}
```

---

## More Test Cases

### Test 2: Security-Sensitive (Should Block)

**Title**: `Update API key in .env file`

**Expected**: Labels include `security`, `high-risk`, `human-review-required`

### Test 3: Feature Request (Medium Risk)

**Title**: `Add user authentication`

**Body**: 
```
Implement authentication for:
- src/routes/users.js
- src/middleware/auth.js
```

**Expected**: `feature`, `medium-risk` labels

---

## What Happens After Triage?

Currently (Phase 3 complete):
- ✅ Issue is triaged and labeled
- ✅ Comment posted with analysis
- ❌ No auto-fix yet (Phase 4 not implemented)
- ❌ No PR created yet (Phase 6 not implemented)

To get auto-fix working, you need to implement Phase 4 (planner and code agents).

---

## Cost Estimate

Using OpenAI GPT-4o-mini:
- **Keyword classification**: $0 (no API call)
- **LLM classification**: ~$0.0001 per issue (10% of issues)
- **Average cost**: ~$0.00001 per issue

Very affordable! 🎉

---

## Next Steps

1. ✅ Add OPENAI_API_KEY secret
2. ✅ Merge to main branch
3. ✅ Create required labels
4. ✅ Create test issue
5. ✅ Verify triage works
6. 🚀 Implement Phase 4 for auto-fix (planner + code agents)

---

**Need Help?**
- Check Actions tab for workflow errors
- Look at issue comments for error details
- Review workflow logs for detailed execution trace
