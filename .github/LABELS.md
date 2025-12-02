# GitHub Auto-Fix System - Required Labels Setup

This document lists all labels required by the auto-fix system. Create these labels in your GitHub repository before deploying the workflow.

## How to Create Labels

### Option 1: Via GitHub UI
1. Go to your repository → Issues → Labels
2. Click "New label" for each label below
3. Copy the name, description, and color hex code

### Option 2: Via GitHub CLI
```bash
# Install GitHub CLI: https://cli.github.com/

# Create all labels at once
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

### Option 3: Via GitHub API Script
```javascript
// labels-setup.js
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

const labels = [
  // Auto-fix workflow labels
  { name: 'auto-triage', description: 'Issue has been automatically triaged', color: '0E8A16' },
  { name: 'auto-fix', description: 'Issue has been automatically fixed', color: '1D76DB' },
  { name: 'low-risk', description: 'Low risk change - safe for auto-fix', color: '0E8A16' },
  { name: 'medium-risk', description: 'Medium risk - requires human review', color: 'FBCA04' },
  { name: 'high-risk', description: 'High risk - blocks auto-fix', color: 'D93F0B' },
  { name: 'security', description: 'Security-sensitive change', color: 'D93F0B' },
  { name: 'human-review-required', description: 'Requires maintainer review before fix', color: 'B60205' },
  { name: 'needs-review', description: 'Draft PR needs maintainer approval', color: 'FBCA04' },
  { name: 'automation-failed', description: 'Auto-fix workflow encountered an error', color: 'D93F0B' },
  { name: 'created-by-autofix', description: 'Issue/PR created by auto-fix bot', color: 'EDEDED' },
  
  // Classification labels
  { name: 'bug', description: 'Something isn\'t working', color: 'D93F0B' },
  { name: 'feature', description: 'New feature or request', color: 'A2EEEF' },
  { name: 'documentation', description: 'Documentation improvements', color: '0075CA' },
  { name: 'chore', description: 'Maintenance tasks', color: 'FEF2C0' },
  { name: 'other', description: 'Uncategorized or ambiguous', color: 'EDEDED' },
];

for (const label of labels) {
  try {
    await octokit.issues.createLabel({ owner, repo, ...label });
    console.log(`✓ Created label: ${label.name}`);
  } catch (error) {
    if (error.status === 422) {
      console.log(`- Label already exists: ${label.name}`);
    } else {
      console.error(`✗ Failed to create label ${label.name}:`, error.message);
    }
  }
}
```

Run with: `GITHUB_TOKEN=ghp_xxx GITHUB_REPOSITORY=owner/repo node labels-setup.js`

---

## Required Labels Reference

### Workflow State Labels

| Label | Color | Description | Applied By |
|-------|-------|-------------|------------|
| `auto-triage` | 🟢 `0E8A16` | Issue has been automatically triaged | Triage Agent |
| `auto-fix` | 🔵 `1D76DB` | Issue has been automatically fixed | Code Agent |
| `automation-failed` | 🔴 `D93F0B` | Auto-fix workflow encountered an error | Error Handler |
| `created-by-autofix` | ⚪ `EDEDED` | Issue/PR created by auto-fix bot (skip processing) | Bot Detection |

### Risk Level Labels

| Label | Color | Description | Applied By |
|-------|-------|-------------|------------|
| `low-risk` | 🟢 `0E8A16` | Low risk change - safe for auto-fix | Risk Assessment |
| `medium-risk` | 🟡 `FBCA04` | Medium risk - requires human review | Risk Assessment |
| `high-risk` | 🔴 `D93F0B` | High risk - blocks auto-fix | Risk Assessment |
| `security` | 🔴 `D93F0B` | Security-sensitive change (blocks auto-fix) | Security Gate |

### Review Labels

| Label | Color | Description | Applied By |
|-------|-------|-------------|------------|
| `human-review-required` | 🔴 `B60205` | Requires maintainer review before fix | Triage Agent |
| `needs-review` | 🟡 `FBCA04` | Draft PR needs maintainer approval | PR Generator |

### Classification Labels

| Label | Color | Description | Applied By |
|-------|-------|-------------|------------|
| `bug` | 🔴 `D93F0B` | Something isn't working | Triage Agent |
| `feature` | 🔵 `A2EEEF` | New feature or request | Triage Agent |
| `documentation` | 🔵 `0075CA` | Documentation improvements | Triage Agent |
| `chore` | 🟡 `FEF2C0` | Maintenance tasks | Triage Agent |
| `other` | ⚪ `EDEDED` | Uncategorized or ambiguous | Triage Agent |

---

## Label Usage Examples

### Example 1: Low-Risk Bug (Auto-Fixed)
```
Labels: auto-triage, bug, low-risk, auto-fix, docs
```
Issue triaged as documentation bug, low risk, automatically fixed with PR created.

### Example 2: Security-Sensitive Issue (Blocked)
```
Labels: auto-triage, bug, high-risk, security, human-review-required
```
Issue mentions `.env` file, flagged as security-sensitive, requires human review.

### Example 3: Medium-Risk Feature (Draft PR)
```
Labels: auto-triage, feature, medium-risk, needs-review
```
Issue requires changes to 4 files, draft PR created for maintainer approval.

### Example 4: Automation Failure
```
Labels: auto-triage, bug, low-risk, automation-failed
```
Issue triaged successfully but code generation failed, error comment posted.

---

## Verification Checklist

After creating labels, verify:

- [ ] All 15 labels created in repository
- [ ] Colors match specification (for visual consistency)
- [ ] Label descriptions are clear
- [ ] Labels visible in Issues → Labels page
- [ ] Test issue can be labeled manually

---

## Notes

- **Bot Detection**: Issues/PRs with `created-by-autofix` label are skipped to prevent infinite loops
- **Risk Hierarchy**: `security` > `high-risk` > `medium-risk` > `low-risk` (most restrictive wins)
- **Classification**: Only one classification label applied per issue (bug, feature, documentation, chore, other)
- **Workflow State**: Labels track progression (triage → fix → PR or blocked)
- **Manual Override**: Maintainers can add labels manually to override auto-fix behavior

---

**Last Updated**: 2025-12-02  
**Related**: See `specs/001-github-auto-fix/quickstart.md` for full setup guide
