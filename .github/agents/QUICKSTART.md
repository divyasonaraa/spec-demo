# Quick Start Guide: Auto-Fix System

This guide will help you set up the Automated GitHub Issue Triage and Auto-Fix System in your repository.

## Prerequisites

- GitHub repository with write access
- GitHub Actions enabled
- Node.js 20+ (for local testing)
- Anthropic API key (Claude access via GitHub Models)

## Installation Steps

### 1. Copy Agent Files

Copy the entire `.github/` directory structure to your repository:

```bash
.github/
├── agents/
│   ├── triage-agent.js
│   ├── planner-agent.js
│   ├── code-agent.js
│   ├── pr-generator.js
│   ├── package.json
│   └── shared/
│       ├── ai-client.js
│       ├── error-handler.js
│       ├── github-client.js
│       ├── git-operations.js
│       ├── logger.js
│       ├── retry.js
│       ├── risk-assessment.js
│       ├── security-constraints.js
│       ├── timeout.js
│       └── types.ts
├── workflows/
│   └── auto-fix.yml
└── CODEOWNERS (optional)
```

### 2. Install Dependencies

```bash
cd .github/agents
npm install
```

### 3. Create Required Labels

Create these labels in your GitHub repository (Settings → Labels):

**Classification Labels:**
- `auto-triage` (color: `#0E8A16`, description: "Automatically triaged by bot")
- `bug` (color: `#D73A4A`, description: "Something isn't working")
- `feature` (color: `#A2EEEF`, description: "New feature or request")
- `docs` (color: `#0075CA`, description: "Documentation improvements")
- `chore` (color: `#FEF2C0`, description: "Maintenance tasks")

**Risk Level Labels:**
- `low-risk` (color: `#28A745`, description: "Safe for auto-fix")
- `medium-risk` (color: `#FFA500`, description: "Requires review")
- `high-risk` (color: `#DC143C`, description: "Manual intervention required")

**Status Labels:**
- `auto-fix` (color: `#7B68EE`, description: "Automated fix applied")
- `needs-review` (color: `#FBCA04`, description: "Requires maintainer review")
- `human-review-required` (color: `#B60205`, description: "Cannot auto-fix")
- `automation-failed` (color: `#D73A4A`, description: "Automation error occurred")
- `security` (color: `#FF0000`, description: "Security-sensitive changes")

**Script to create labels:**

```bash
# Save this as create-labels.sh
#!/bin/bash

REPO="owner/repo-name"  # Change this
TOKEN="your_github_token"  # Change this

create_label() {
  local name=$1
  local color=$2
  local description=$3
  
  curl -X POST \
    -H "Authorization: token $TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    https://api.github.com/repos/$REPO/labels \
    -d "{\"name\":\"$name\",\"color\":\"$color\",\"description\":\"$description\"}"
}

# Classification labels
create_label "auto-triage" "0E8A16" "Automatically triaged by bot"
create_label "bug" "D73A4A" "Something isn't working"
create_label "feature" "A2EEEF" "New feature or request"
create_label "docs" "0075CA" "Documentation improvements"
create_label "chore" "FEF2C0" "Maintenance tasks"

# Risk level labels
create_label "low-risk" "28A745" "Safe for auto-fix"
create_label "medium-risk" "FFA500" "Requires review"
create_label "high-risk" "DC143C" "Manual intervention required"

# Status labels
create_label "auto-fix" "7B68EE" "Automated fix applied"
create_label "needs-review" "FBCA04" "Requires maintainer review"
create_label "human-review-required" "B60205" "Cannot auto-fix"
create_label "automation-failed" "D73A4A" "Automation error occurred"
create_label "security" "FF0000" "Security-sensitive changes"
```

### 4. Configure CODEOWNERS (Optional)

Create `.github/CODEOWNERS` to automatically assign reviewers:

```
# Default owners for everything
*       @your-username

# Frontend code
/src/components/    @frontend-team
/src/views/         @frontend-team

# Backend code
/src/services/      @backend-team
/src/utils/         @backend-team

# Infrastructure
/.github/           @devops-team
/docker/            @devops-team
```

### 5. Configure Repository Permissions

Ensure the `GITHUB_TOKEN` has proper permissions in workflow:

```yaml
permissions:
  issues: write         # Required for triage
  contents: write       # Required for commits
  pull-requests: write  # Required for PRs
  models: read          # Required for GitHub Models AI
```

### 6. Enable Workflows

1. Go to repository Settings → Actions → General
2. Enable "Allow all actions and reusable workflows"
3. Set workflow permissions to "Read and write permissions"
4. Check "Allow GitHub Actions to create and approve pull requests"

## Configuration

### Security Constraints

Edit `.github/agents/shared/security-constraints.js` to customize:

```javascript
// Add your security-sensitive keywords
export const SECURITY_KEYWORDS = [
  'password', 'secret', 'api_key', 'token',
  // Add more...
];

// Add your protected file patterns
export const SECURITY_FILE_PATTERNS = [
  '.env*', 'config/secrets/*', '*.pem',
  // Add more...
];
```

### Timeout Configuration

Adjust timeouts in `.github/workflows/auto-fix.yml`:

```yaml
jobs:
  triage:
    timeout-minutes: 1  # Adjust as needed
  
  planner:
    timeout-minutes: 2
  
  code:
    timeout-minutes: 5  # Increase for large repos
  
  pr:
    timeout-minutes: 1
```

## Testing

### Manual Workflow Trigger

Test the system manually using workflow_dispatch:

1. Go to Actions → Auto-Fix GitHub Issues
2. Click "Run workflow"
3. Enter an issue number
4. Click "Run workflow"

### Test Scenarios

See `TEST_SCENARIOS.md` for comprehensive test cases.

### Local Testing

Test agents locally:

```bash
cd .github/agents

# Test triage agent
GITHUB_TOKEN=your_token \
GITHUB_REPOSITORY_OWNER=owner \
GITHUB_REPOSITORY_NAME=repo \
ISSUE_NUMBER=123 \
node triage-agent.js

# Test planner agent
GITHUB_TOKEN=your_token \
GITHUB_REPOSITORY=owner/repo \
ISSUE_NUMBER=123 \
TRIAGE_RESULT_PATH=./triage-result.json \
node planner-agent.js
```

## Monitoring

### View Logs

1. Go to Actions tab
2. Click on a workflow run
3. Expand job steps to see structured logs (JSON format to stderr)

### Check Artifacts

Workflow artifacts are retained for 7 days:
- `triage-result` - Triage classification and risk assessment
- `fix-plan` - Generated fix plan
- `commit-result` - Commit and validation results
- `pr-result` - Pull request creation results

### Cost Tracking

Logs include AI API cost estimates:

```json
{
  "level": "INFO",
  "message": "AI API call completed",
  "estimatedCost": {
    "inputTokens": 5234,
    "outputTokens": 1423,
    "totalTokens": 6657,
    "estimatedCostUSD": "0.036891"
  }
}
```

## Troubleshooting

### Workflow Not Triggering

- Check that Actions are enabled
- Verify workflow file is in `.github/workflows/`
- Ensure issue trigger is `types: [opened]`

### Authentication Errors

- Verify workflow permissions are set correctly
- Check GITHUB_TOKEN has necessary scopes
- For GitHub Models API, ensure `models: read` permission

### Agent Failures

- Check workflow logs for detailed error messages
- Look for `automation-failed` label on issues
- Review error comments posted to issues

### Rate Limiting

- System includes exponential backoff
- Logs will show rate limit hits
- GitHub API: 1000 requests/hour for authenticated users
- Anthropic API: Check your plan limits

## Best Practices

1. **Start Small**: Test with simple typo fixes first
2. **Monitor Costs**: Review AI API usage regularly
3. **Review Draft PRs**: Always review MEDIUM risk PRs before merging
4. **Update Security Patterns**: Add project-specific sensitive patterns
5. **Set CODEOWNERS**: Ensure proper reviewer assignment
6. **Test Locally**: Debug issues with local agent execution

## Security Considerations

- **Never commit API keys**: Use GitHub Secrets
- **Review security patterns**: Regularly update security constraints
- **Audit auto-fixes**: Monitor PRs created by automation
- **Limit scope**: Start with docs/typos only if concerned
- **Enable branch protection**: Require reviews for main branch

## Support

For issues or questions:
- Check logs in Actions tab
- Review error comments on issues
- Look for `automation-failed` label
- File an issue for bugs in the automation system

## Next Steps

1. ✅ Complete setup steps above
2. ✅ Create required labels
3. ✅ Test with a simple docs issue
4. ✅ Review generated PR
5. ✅ Monitor for a few days
6. ✅ Gradually enable for more issue types
