# Quick Start: Automated GitHub Issue Triage and Auto-Fix System

**Feature**: [spec.md](./spec.md)  
**Created**: 2025-12-02  
**Phase**: 1 - Design

## Overview

This guide explains how to set up and deploy the automated GitHub issue triage and auto-fix system in your repository. The system processes new issues automatically, classifies them, and creates pull requests for low-risk fixes without human intervention.

## Prerequisites

- GitHub repository with admin access
- GitHub Actions enabled (free for public repos, included in all GitHub plans for private repos)
- AI API access (one of):
  - GitHub Models API (free tier available)
  - Anthropic Claude API key
  - OpenAI GPT-4 API key

## Architecture Overview

```
GitHub Issue Created
  ↓
Triage Agent (auto-runs)
  ↓
Issue classified and labeled
  ↓
**WAIT FOR APPROVAL LABEL** ← Human adds "auto-fix" or "auto-fix-approved" label
  ↓ (only after label added)
GitHub Actions Workflow Triggered
  ↓
┌─────────────────────────────────────────────────┐
│ Prerequisites Check                             │
│ - Verify auto-fix label is present             │
│ - Block if missing approval                    │
└─────────────────────────────────────────────────┘
  ↓ (if approved)
┌─────────────────────────────────────────────────┐
│ Job 1: Triage Agent (re-validation)             │
│ - Classify issue (BUG/FEATURE/DOCS/etc.)       │
│ - Assess risk (LOW/MEDIUM/HIGH)                │
│ - Check security constraints                    │
│ - Output: TriageResult JSON                     │
└─────────────────────────────────────────────────┘
  ↓ (if auto_fix_decision === 'AUTO_FIX' or 'DRAFT_PR')
┌─────────────────────────────────────────────────┐
│ Job 2: Auto-Fix Agent (enhanced)                │
│ - Fetch comprehensive project context          │
│ - Load affected files + related dependencies   │
│ - Generate production-quality fix with AI      │
│ - Apply changes with proper error handling     │
│ - Run validation (lint, type-check, build)     │
│ - Create commit with detailed message          │
│ - Output: Commit[] JSON                         │
└─────────────────────────────────────────────────┘
  ↓ (if validation passes)
┌─────────────────────────────────────────────────┐
│ Job 3: PR Generator                             │
│ - Format comprehensive PR description           │
│ - Create pull request (draft if MEDIUM risk)   │
│ - Apply labels                                  │
│ - Request reviewers                             │
│ - Output: PullRequest URL                       │
└─────────────────────────────────────────────────┘
```

## Key Changes

### ✅ Conditional Triggering
- Auto-fix **no longer runs automatically** when an issue is opened
- Triage agent still runs immediately to classify and assess the issue
- **Human approval required**: Add `auto-fix` or `auto-fix-approved` label to trigger the fix workflow
- Provides human oversight gate before any code changes are made

### ✅ Production-Quality Fixes
- AI generates comprehensive fixes following senior developer best practices
- Considers edge cases, error handling, and type safety
- Follows project conventions and framework patterns (Vue 3 Composition API, React hooks, etc.)
- Includes proper comments and maintains code consistency
- Increased context (up to 8 related files) for better understanding
- Lower temperature (0.1) for more reliable, consistent code generation

## Installation Steps

### Step 1: Configure GitHub Secrets

Navigate to your repository **Settings → Secrets and variables → Actions** and add:

```yaml
# Required: AI API Key (choose one)
ANTHROPIC_API_KEY: sk-ant-...              # Anthropic Claude
# OR
OPENAI_API_KEY: sk-...                     # OpenAI GPT-4
# OR
GITHUB_TOKEN: ghp_...                      # GitHub Models (auto-provided)

# Optional: Custom configuration
AUTO_FIX_CONFIG: |
  {
    "max_file_changes": 5,
    "max_complexity": "MODERATE",
    "blocked_patterns": ["**/.env*", "**/secrets/**"]
  }
```

### Step 2: Create Workflow File

Create `.github/workflows/auto-fix.yml` in your repository:

```yaml
name: Automated Issue Triage and Auto-Fix

on:
  issues:
    types: [opened]

permissions:
  issues: write
  pull-requests: write
  contents: write

jobs:
  triage:
    name: Triage Issue
    runs-on: ubuntu-latest
    outputs:
      triage_result: ${{ steps.triage.outputs.result }}
      auto_fix: ${{ steps.triage.outputs.auto_fix }}
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Run Triage Agent
        id: triage
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
          ISSUE_TITLE: ${{ github.event.issue.title }}
          ISSUE_BODY: ${{ github.event.issue.body }}
          ISSUE_AUTHOR: ${{ github.event.issue.user.login }}
        run: |
          node .github/agents/triage-agent.js

  plan:
    name: Generate Fix Plan
    runs-on: ubuntu-latest
    needs: triage
    if: needs.triage.outputs.auto_fix == 'YES'
    outputs:
      fix_plan: ${{ steps.plan.outputs.result }}
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Run Planner Agent
        id: plan
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          TRIAGE_RESULT: ${{ needs.triage.outputs.triage_result }}
        run: |
          node .github/agents/planner-agent.js

  code:
    name: Generate and Validate Code
    runs-on: ubuntu-latest
    needs: [triage, plan]
    outputs:
      commits: ${{ steps.code.outputs.result }}
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Configure git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
      
      - name: Run Code Agent
        id: code
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          FIX_PLAN: ${{ needs.plan.outputs.fix_plan }}
        run: |
          node .github/agents/code-agent.js

  pr:
    name: Create Pull Request
    runs-on: ubuntu-latest
    needs: [triage, plan, code]
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Run PR Generator
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TRIAGE_RESULT: ${{ needs.triage.outputs.triage_result }}
          FIX_PLAN: ${{ needs.plan.outputs.fix_plan }}
          COMMITS: ${{ needs.code.outputs.commits }}
        run: |
          node .github/agents/pr-generator.js
```

### Step 3: Create Agent Scripts

Create the agent scripts in `.github/agents/`:

#### Directory Structure
```
.github/
└── agents/
    ├── triage-agent.js
    ├── planner-agent.js
    ├── code-agent.js
    ├── pr-generator.js
    └── shared/
        ├── github-client.js
        ├── ai-client.js
        └── security-constraints.js
```

#### Minimal Agent Template (triage-agent.js example)

```javascript
// .github/agents/triage-agent.js
const { Octokit } = require('@octokit/rest');
const Anthropic = require('@anthropic-ai/sdk');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function triageIssue() {
  const issue = {
    number: parseInt(process.env.ISSUE_NUMBER),
    title: process.env.ISSUE_TITLE,
    body: process.env.ISSUE_BODY,
    author: process.env.ISSUE_AUTHOR
  };

  // Skip bot-generated issues
  if (issue.author.endsWith('[bot]')) {
    console.log('Skipping bot-generated issue');
    process.exit(0);
  }

  // Classify issue using AI
  const classification = await classifyWithAI(issue);
  
  // Assess risk
  const risk = assessRisk(classification);
  
  // Check security constraints
  const securityFlags = checkSecurity(issue);
  
  // Decide auto-fix eligibility
  const autoFix = (risk === 'LOW' && securityFlags.length === 0) ? 'YES' : 'HUMAN_REVIEW_REQUIRED';
  
  const triageResult = {
    issue_number: issue.number,
    classification,
    risk,
    auto_fix_decision: autoFix,
    security_flags: securityFlags,
    timestamp: new Date().toISOString()
  };

  // Post comment on issue
  await octokit.issues.createComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue.number,
    body: formatTriageComment(triageResult)
  });

  // Output for next job
  console.log(`::set-output name=result::${JSON.stringify(triageResult)}`);
  console.log(`::set-output name=auto_fix::${autoFix}`);
}

triageIssue().catch(console.error);
```

### Step 4: Configure Repository Labels

Create the following labels in your repository (**Issues → Labels → New label**):

| Label | Color | Description |
|-------|-------|-------------|
| `auto-triage` | #0e8a16 | Automatically triaged issue |
| `auto-fix` | #1d76db | Automated fix applied |
| `low-risk` | #d4c5f9 | Low risk change |
| `medium-risk` | #fbca04 | Medium risk, needs review |
| `high-risk` | #d93f0b | High risk, requires human review |
| `human-review-required` | #b60205 | Must be reviewed by maintainer |
| `automation-failed` | #e99695 | Auto-fix encountered error |
| `security` | #d73a4a | Security-related issue |

### Step 5: Configure CODEOWNERS (Optional)

Create `.github/CODEOWNERS` to specify reviewers:

```
# Documentation
*.md @docs-team

# Frontend components
src/components/ @frontend-team

# API routes
src/api/ @backend-team

# Security-sensitive
config/secrets/ @security-team
*.env* @security-team
```

### Step 6: Test the System

1. **Create a test issue**:
   - Title: "Fix typo in README"
   - Body: "Line 10 has 'teh' instead of 'the'"

2. **Monitor workflow**:
   - Go to **Actions** tab
   - Watch "Automated Issue Triage and Auto-Fix" workflow run
   - Check each job (Triage → Plan → Code → PR)

3. **Verify results**:
   - Issue should have labels applied (auto-triage, docs, low-risk)
   - Comment should appear with triage analysis
   - PR should be created with comprehensive description
   - PR should reference issue with "Fixes #<number>"

## Configuration Options

### Environment Variables

```yaml
# .github/workflows/auto-fix.yml
env:
  # AI Provider
  AI_PROVIDER: 'anthropic'  # 'anthropic' | 'openai' | 'github-models'
  
  # Risk Thresholds
  MAX_FILE_CHANGES: 5       # Block auto-fix if > 5 files
  MAX_COMPLEXITY: 'MODERATE' # Block if complexity exceeds this
  
  # Timeout Limits (seconds)
  TRIAGE_TIMEOUT: 30
  PLANNER_TIMEOUT: 60
  CODE_TIMEOUT: 120
  PR_TIMEOUT: 30
  
  # Validation Commands
  LINT_COMMAND: 'npm run lint'
  TYPE_CHECK_COMMAND: 'npm run type-check'
  BUILD_COMMAND: 'npm run build'
```

### Security Constraints

Edit `.github/agents/shared/security-constraints.js`:

```javascript
module.exports = {
  BLOCKED_FILE_PATTERNS: [
    '**/.env*',
    '**/config/secrets/**',
    '**/*.pem',
    '**/*.key',
    '**/deployment/**',
    '**/Dockerfile'
  ],
  
  BLOCKED_KEYWORDS: [
    'password',
    'secret',
    'api.?key',
    'token',
    'credential',
    'private.?key',
    'certificate',
    'oauth'
  ],
  
  BLOCKED_CHANGE_TYPES: [
    'migration',
    'schema.change',
    'alter.table',
    'binary.compilation'
  ]
};
```

## Monitoring and Maintenance

### View Audit Logs

All automated actions are logged:

1. Go to **Actions** tab
2. Select workflow run
3. Expand job steps to see detailed logs
4. Search for specific issue numbers

### Handle Failed Auto-Fixes

Issues with `automation-failed` label require manual attention:

1. Check workflow logs for error details
2. Common failures:
   - Lint/validation errors
   - Merge conflicts
   - API rate limits
3. Fix manually or adjust security constraints

### Update Agent Logic

To modify agent behavior:

1. Edit agent scripts in `.github/agents/`
2. Test with workflow_dispatch trigger (manual run)
3. Commit changes to main branch
4. Future issues will use updated logic

## Cost Estimation

### GitHub Actions Minutes

- **Free tier**: 2,000 minutes/month (private repos)
- **Per workflow run**: ~3-5 minutes
- **Estimated capacity**: 400-600 issues/month (free tier)

### AI API Costs

**Anthropic Claude**:
- Triage: ~500 tokens input, 200 tokens output = $0.002/issue
- Planner: ~1,000 tokens input, 500 tokens output = $0.005/issue
- Code: ~2,000 tokens input, 1,000 tokens output = $0.010/issue
- **Total**: ~$0.017 per auto-fixed issue

**GitHub Models** (Free Tier):
- Rate limit: 15 requests/minute
- Cost: $0 for public repositories

## Troubleshooting

### Issue Not Triggering Workflow

**Check**:
- Webhook is enabled (Settings → Webhooks)
- Workflow file is in `.github/workflows/`
- Workflow has correct trigger: `on.issues.types: [opened]`
- Repository has Actions enabled

### Auto-Fix Blocked Unexpectedly

**Check**:
- Issue doesn't mention security keywords
- Affected files not in blocked patterns
- Risk assessment not set to HIGH
- Review triage comment for reasoning

### Validation Failing

**Check**:
- Lint/type-check/build commands are correct in workflow
- Dependencies are installed (npm ci step)
- Node version matches project requirements

### PR Not Created

**Check**:
- Code job completed successfully
- Branch was pushed to origin
- GITHUB_TOKEN has `pull-requests: write` permission
- No duplicate PR exists for same branch

## Security Best Practices

1. **Review all auto-generated PRs** before merging (even LOW risk)
2. **Monitor audit logs** weekly for suspicious patterns
3. **Update security constraints** as new sensitive patterns emerge
4. **Rotate API keys** quarterly
5. **Enable branch protection** on main branch (require PR reviews)
6. **Limit auto-fix** to public, non-production repositories initially
7. **Test in staging** before deploying to production repositories

## Next Steps

After successful setup:

1. **Monitor performance**: Track average triage time, auto-fix success rate
2. **Tune risk assessment**: Adjust thresholds based on false positives/negatives
3. **Expand coverage**: Add more classification keywords, file patterns
4. **Integrate with CI/CD**: Link auto-fix PRs to deployment pipelines
5. **Train team**: Document how to use labels, request human review overrides

## Support

For issues or questions:

1. Check workflow logs in Actions tab
2. Review [contracts documentation](./contracts/)
3. Consult [data model](./data-model.md) for structure details
4. See [research document](./research.md) for technical decisions

## Upgrade Path

To add new features:

1. Update relevant agent script in `.github/agents/`
2. Add new environment variables to workflow
3. Test with manual workflow_dispatch
4. Document changes in this guide
5. Communicate to team

## Rollback Procedure

To disable the system:

1. **Immediate**: Disable workflow in Settings → Actions
2. **Temporary**: Add `if: false` to workflow jobs
3. **Permanent**: Delete `.github/workflows/auto-fix.yml`
4. **Cleanup**: Close open auto-fix PRs, remove labels

Auto-fix system is now fully configured and ready to process issues!
