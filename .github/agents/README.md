# GitHub Auto-Fix System - Setup & Testing Guide

## Phase 3 Complete: Automated Issue Triage ✅

The triage agent is now fully implemented and ready for testing.

## Prerequisites

1. **GitHub Repository** with Issues enabled
2. **GitHub Actions** enabled
3. **API Keys** (choose one):
   - **Anthropic API Key** (recommended): Sign up at https://console.anthropic.com/
   - **GitHub Models** (free tier): Uses your GitHub token

## Setup Instructions

### 1. Create Repository Secrets

Go to your repository → Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

```
ANTHROPIC_API_KEY=sk-ant-xxxxx...
```

(The `GITHUB_TOKEN` is automatically provided by GitHub Actions)

### 2. Install Dependencies

```bash
cd .github/agents
npm install
```

This will install:
- `@octokit/rest` - GitHub API client
- `@anthropic-ai/sdk` - Anthropic Claude API client
- `@octokit/webhooks-types` - TypeScript types

### 3. Create Required Labels

Run this script to create all required labels in your repository:

```bash
# Using GitHub CLI
gh label create "auto-triage" --description "Issue has been automatically triaged" --color "0E8A16"
gh label create "auto-fix" --description "Issue has been automatically fixed" --color "1D76DB"
gh label create "low-risk" --description "Low risk change - safe for auto-fix" --color "0E8A16"
gh label create "medium-risk" --description "Medium risk - requires human review" --color "FBCA04"
gh label create "high-risk" --description "High risk - blocks auto-fix" --color "D93F0B"
gh label create "security" --description "Security-sensitive change" --color "D93F0B"
gh label create "human-review-required" --description "Requires maintainer review before fix" --color "B60205"
gh label create "needs-review" --description "Draft PR needs maintainer approval" --color "FBCA04"
gh label create "automation-failed" --description "Auto-fix workflow encountered an error" --color "D93F0B"
gh label create "created-by-autofix" --description "Issue/PR created by auto-fix bot" --color "EDEDED"

# Classification labels
gh label create "bug" --description "Something isn't working" --color "D93F0B"
gh label create "feature" --description "New feature or request" --color "A2EEEF"
gh label create "docs" --description "Documentation improvements" --color "0075CA"
gh label create "chore" --description "Maintenance tasks" --color "FEF2C0"
gh label create "other" --description "Uncategorized or ambiguous" --color "EDEDED"
```

Or use the detailed setup guide in `.github/LABELS.md`.

### 4. Customize CODEOWNERS (Optional)

Edit `.github/CODEOWNERS` to match your repository structure and team members.

## Testing Phase 3: Triage Agent

### Test Case 1: Low-Risk Documentation Fix (Should Auto-Fix)

Create a new issue with:

**Title**: `Fix typo in README: 'teh' should be 'the'`

**Body**:
```
There's a typo in the README.md file.

Line 42 has "teh" instead of "the".
```

**Expected Results**:
- ✅ Labels applied: `auto-triage`, `docs`, `low-risk`
- ✅ Comment posted with triage analysis (JSON details)
- ✅ Auto-fix decision: `AUTO_FIX`
- ✅ Completion within 30 seconds

### Test Case 2: Security-Sensitive Change (Should Block)

Create a new issue with:

**Title**: `Update API key in .env file`

**Body**:
```
Need to rotate the API key in .env file.

File: .env
```

**Expected Results**:
- ✅ Labels applied: `auto-triage`, `chore`, `high-risk`, `security`, `human-review-required`
- ✅ Comment posted with security warning
- ✅ Auto-fix decision: `HUMAN_REVIEW_REQUIRED`
- ✅ No PR created

### Test Case 3: Medium-Risk Feature (Should Create Draft PR)

Create a new issue with:

**Title**: `Add user authentication to API endpoints`

**Body**:
```
Implement authentication middleware for the following API routes:
- src/routes/users.js
- src/routes/posts.js
- src/middleware/auth.js
```

**Expected Results**:
- ✅ Labels applied: `auto-triage`, `feature`, `medium-risk`
- ✅ Comment posted with triage analysis
- ✅ Auto-fix decision: `DRAFT_PR` (will be implemented in Phase 7)
- ✅ 3 files detected

### Test Case 4: Ambiguous Issue (LLM Fallback)

Create a new issue with:

**Title**: `Something is not right`

**Body**:
```
When I do the thing, it doesn't work as expected.
```

**Expected Results**:
- ✅ Labels applied: `auto-triage`, `other` (or classification determined by LLM)
- ✅ Comment indicates LLM classification was used
- ✅ Confidence score shown

## Monitoring Workflow Execution

### View Workflow Runs

1. Go to your repository → Actions tab
2. Click on "Auto-Fix GitHub Issues" workflow
3. View the latest run triggered by your test issue

### Check Workflow Logs

1. Click on a workflow run
2. Click on "Triage Issue" job
3. Expand "Run triage agent" step
4. View structured JSON logs

### Verify Issue Comments

1. Go to Issues tab
2. Open the test issue
3. Verify the triage comment was posted
4. Check that labels were applied

## Manual Testing Workflow

```bash
# Test locally (requires issue already exists)
cd .github/agents

# Set environment variables
export GITHUB_TOKEN=ghp_xxxxx...
export ANTHROPIC_API_KEY=sk-ant-xxxxx...
export GITHUB_REPOSITORY_OWNER=your-username
export GITHUB_REPOSITORY_NAME=your-repo
export ISSUE_NUMBER=1

# Run triage agent
node triage-agent.js
```

## Troubleshooting

### Error: "ANTHROPIC_API_KEY not found"

- Ensure you've added the secret to GitHub repository settings
- For local testing, set the environment variable

### Error: "Rate limit exceeded"

- GitHub API has rate limits (5000 requests/hour for authenticated)
- Anthropic API has rate limits based on your plan
- Wait for rate limit reset or upgrade plan

### Error: "Permission denied"

- Ensure GitHub Actions has write permissions
- Check repository settings → Actions → General → Workflow permissions
- Select "Read and write permissions"

### Labels Not Applied

- Verify labels exist in the repository
- Check workflow logs for errors
- Ensure `GITHUB_TOKEN` has write permissions

### Workflow Not Triggering

- Ensure workflow file is in `.github/workflows/auto-fix.yml`
- Check that it's on the default branch (main/master)
- Verify `on.issues.types: [opened]` trigger is configured

## Phase 3 Performance Metrics

Track these metrics during testing:

- **Triage Time**: Should be < 30 seconds
- **Classification Accuracy**: Keyword vs LLM usage ratio
- **Security Detection**: 100% block rate for flagged issues
- **Label Application**: All expected labels applied
- **Error Rate**: Should be near 0%

## Next Steps

After Phase 3 testing is complete:

- **Phase 4**: Implement planner and code agents for auto-fix
- **Phase 5**: Enhance security constraints
- **Phase 6**: Add PR generation
- **Phase 7**: Support for MEDIUM risk issues
- **Phase 8**: Polish and production hardening

## Support

For issues or questions:
- Check the workflow logs first
- Review error messages in issue comments
- Consult the architecture documentation in `specs/001-github-auto-fix/`

---

**Phase 3 Status**: ✅ Complete - Ready for Testing
**Last Updated**: 2025-12-02
