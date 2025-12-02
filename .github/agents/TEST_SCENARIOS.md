# Test Scenarios: Auto-Fix System

Comprehensive test cases covering positive scenarios, negative scenarios, edge cases, and graceful failure modes.

## Test Execution

For each test:
1. Create a new GitHub issue with the specified content
2. Observe workflow execution in Actions tab
3. Verify expected outcomes (labels, comments, PRs)
4. Check workflow logs for structured logging
5. Review artifacts for detailed results

---

## ✅ Positive Test Scenarios

### P1: Simple Typo Fix (LOW Risk - Happy Path)

**Issue Title**: `Fix typo in README`

**Issue Body**:
```
## Bug Description
There's a typo in README.md line 42: "teh" should be "the"

## Expected Behavior
README should have correct spelling

## Affected Files
- README.md
```

**Expected Outcome**:
- ✅ Labels: `auto-triage`, `docs`, `low-risk`, `auto-fix`
- ✅ Triage comment posted with analysis
- ✅ PR created within 2 minutes
- ✅ Branch name: `docs/1-fix-typo-readme` (or similar)
- ✅ Commit message: `docs: fix typo in README`
- ✅ PR merged automatically or ready to merge
- ✅ Success comment on issue with PR link

**Validation**:
- Check PR includes proper description
- Verify commit only changes the typo
- Confirm PR body has all required sections

---

### P2: Missing Import Fix (LOW Risk - Code Change)

**Issue Title**: `Add missing React import in UserProfile component`

**Issue Body**:
```
## Bug Description
The UserProfile.tsx component is missing the React import, causing a build error.

## Error Message
```
ReferenceError: React is not defined
```

## Affected Files
- src/components/UserProfile.tsx

## Expected Fix
Add `import React from 'react';` at the top of the file
```

**Expected Outcome**:
- ✅ Labels: `auto-triage`, `bug`, `low-risk`, `auto-fix`
- ✅ PR created with import added
- ✅ Validation passes (TypeScript check)
- ✅ Commit message follows conventional commits
- ✅ PR description explains the fix

---

### P3: Documentation Update (LOW Risk - Multiple Files)

**Issue Title**: `Update installation instructions in docs`

**Issue Body**:
```
## Feature Request
Update installation docs to mention Node.js 20+ requirement

## Affected Files
- README.md
- docs/installation.md

## Changes Needed
- Add Node.js version requirement
- Update npm install command examples
```

**Expected Outcome**:
- ✅ Labels: `auto-triage`, `docs`, `low-risk`, `auto-fix`
- ✅ PR modifies 2 files
- ✅ Changes are coherent across both files
- ✅ PR includes verification steps

---

### P4: Configuration Update (MEDIUM Risk - Draft PR)

**Issue Title**: `Update API endpoint in config and services`

**Issue Body**:
```
## Feature Request
Change API base URL from `api.example.com` to `api.newdomain.com`

## Affected Files
- src/config/api.ts
- src/services/api.service.ts
- src/services/user.service.ts

## Changes Needed
Replace all occurrences of old domain with new domain
```

**Expected Outcome**:
- ✅ Labels: `auto-triage`, `feature`, `medium-risk`, `needs-review`, `auto-fix`
- ✅ **DRAFT PR** created (not ready to merge)
- ✅ Comment explains MEDIUM risk requires review
- ✅ Suggested reviewers assigned
- ✅ PR body includes warning about risk level
- ✅ Manual verification steps listed

**Validation**:
- Confirm PR is in DRAFT state
- Verify needs-review label present
- Check maintainer approval required

---

### P5: Chore Task (LOW Risk - Dependency Update)

**Issue Title**: `Update eslint-plugin-react to latest version`

**Issue Body**:
```
## Chore
Update eslint-plugin-react from 7.32.0 to 7.34.1

## Affected Files
- package.json

## Changes Needed
Update version number in dependencies
```

**Expected Outcome**:
- ✅ Labels: `auto-triage`, `chore`, `low-risk`, `auto-fix`
- ✅ PR updates package.json
- ✅ Commit message: `chore: update eslint-plugin-react to 7.34.1`

---

## ❌ Negative Test Scenarios (Expected Blocks)

### N1: Security Keyword Block (HIGH Risk)

**Issue Title**: `Update API key in configuration`

**Issue Body**:
```
## Bug
Need to rotate API key in .env file

## Affected Files
- .env

## Changes
Replace old API key with new one: sk-prod-abc123xyz
```

**Expected Outcome**:
- ✅ Labels: `auto-triage`, `chore`, `high-risk`, `security`, `human-review-required`
- ✅ Comment explains auto-fix blocked due to security
- ✅ Security flags listed: `hasSecurityKeywords: true`
- ✅ **NO PR CREATED**
- ✅ Workflow stops after triage

**Validation**:
- Verify planner/code/pr jobs are skipped
- Confirm security label applied
- Check comment explains why blocked

---

### N2: Sensitive File Block (HIGH Risk)

**Issue Title**: `Update database connection in secrets file`

**Issue Body**:
```
## Feature
Update PostgreSQL connection string

## Affected Files
- config/secrets/database.yml
- .env.production

## Changes
Update host from old-db.example.com to new-db.example.com
```

**Expected Outcome**:
- ✅ Labels: `auto-triage`, `feature`, `high-risk`, `security`, `human-review-required`
- ✅ Comment shows security file patterns matched
- ✅ Security flags: `hasSecurityFilePath: true`
- ✅ **NO PR CREATED**
- ✅ Planner not executed

---

### N3: Database Migration Block (HIGH Risk)

**Issue Title**: `Add user_role column to users table`

**Issue Body**:
```
## Feature
Add new column for user roles

## Affected Files
- db/migrations/20250101_add_user_role.sql
- src/models/User.ts

## Changes
- Create migration to add column
- Update TypeScript interface
```

**Expected Outcome**:
- ✅ Labels: `auto-triage`, `feature`, `high-risk`, `human-review-required`
- ✅ Security flags: `hasRiskyChangeTypes: true` (migration detected)
- ✅ Comment explains database changes require manual review
- ✅ **NO PR CREATED**

---

### N4: Infrastructure Change Block (HIGH Risk)

**Issue Title**: `Update Kubernetes deployment replicas`

**Issue Body**:
```
## Chore
Scale deployment from 3 to 5 replicas

## Affected Files
- k8s/deployment.yaml
- .github/workflows/deploy.yml

## Changes
Update replica count and workflow config
```

**Expected Outcome**:
- ✅ Labels: `auto-triage`, `chore`, `high-risk`, `human-review-required`
- ✅ Security flags show infrastructure/CI-CD patterns matched
- ✅ **NO PR CREATED**
- ✅ Comment lists risky change types detected

---

### N5: Too Many Files (MEDIUM Risk → Draft PR)

**Issue Title**: `Refactor API service layer across multiple files`

**Issue Body**:
```
## Refactoring
Refactor API services to use new base class

## Affected Files
- src/services/api.service.ts
- src/services/user.service.ts
- src/services/post.service.ts
- src/services/comment.service.ts
- src/services/auth.service.ts
- src/utils/apiClient.ts

## Changes
Extract common logic to BaseService class
```

**Expected Outcome**:
- ✅ Labels: `auto-triage`, `chore`, `medium-risk`, `needs-review`, `auto-fix`
- ✅ **DRAFT PR created** (6 files → MEDIUM risk)
- ✅ Comment warns about scope and complexity
- ✅ Maintainer review required before merge

---

## 🔄 Graceful Failure Scenarios

### F1: Validation Failure (Rollback)

**Issue Title**: `Fix linting error in UserProfile`

**Issue Body**:
```
## Bug
Remove unused import from UserProfile.tsx

## Affected Files
- src/components/UserProfile.tsx

## Changes
Remove `import { OldService } from './old-service';`
```

**Setup**: Intentionally break validation by having code agent generate invalid syntax

**Expected Outcome**:
- ✅ Labels: `auto-triage`, `bug`, `low-risk`, `automation-failed`
- ✅ Code agent runs validation
- ✅ Validation fails (lint/type-check error)
- ✅ **Changes rolled back automatically**
- ✅ Error comment posted with validation output
- ✅ **NO PR CREATED**
- ✅ Branch deleted or reset

**Validation**:
- Confirm rollback succeeded
- Verify no commits left on branch
- Check error comment includes validation details

---

### F2: AI API Timeout

**Issue Title**: `Complex refactoring requiring deep analysis`

**Issue Body**:
```
## Feature
[Very long and complex issue description that might cause AI timeout...]

## Affected Files
[List 20+ files]

## Changes
[Very detailed requirements...]
```

**Expected Outcome**:
- ✅ Timeout after configured limit (e.g., 60s for AI call)
- ✅ Error comment: "Operation timed out"
- ✅ Label: `automation-failed`
- ✅ Graceful error message explains timeout
- ✅ Suggests manual intervention
- ✅ **NO PR CREATED**

**Validation**:
- Check logs show timeout error
- Verify error code is `TIMEOUT`
- Confirm structured log entry for timeout

---

### F3: GitHub API Rate Limit

**Issue Title**: `Simple docs fix` (after many API calls)

**Issue Body**:
```
Fix typo in README.md
```

**Setup**: Trigger after creating many issues to hit rate limit

**Expected Outcome**:
- ✅ Rate limit detected
- ✅ Exponential backoff applied
- ✅ Retry after delay (respects `Retry-After` header)
- ✅ Log entry: `"rateLimit": true`
- ✅ Eventually succeeds or fails gracefully
- ✅ Error comment if retries exhausted

**Validation**:
- Check logs for retry attempts
- Verify exponential backoff timing
- Confirm Retry-After header respected

---

### F4: Git Merge Conflict

**Issue Title**: `Update version number in package.json`

**Issue Body**:
```
## Chore
Bump version to 2.0.0

## Affected Files
- package.json
```

**Setup**: Manually push conflicting change to same file before code agent runs

**Expected Outcome**:
- ✅ Conflict detected during push
- ✅ Error comment posted
- ✅ Label: `automation-failed`
- ✅ Explanation of conflict
- ✅ Suggests manual resolution
- ✅ **NO PR CREATED**

---

### F5: Missing File Reference

**Issue Title**: `Fix typo in nonexistent file`

**Issue Body**:
```
## Bug
Fix typo in docs/nonexistent.md

## Affected Files
- docs/nonexistent.md
```

**Expected Outcome**:
- ✅ Triage succeeds (classifies as docs)
- ✅ Planner generates plan
- ✅ Code agent fails (file not found)
- ✅ Error comment: "File does not exist"
- ✅ Label: `automation-failed`
- ✅ Suggests checking file path

---

## 🔀 Edge Cases

### E1: Bot-Created Issue (Skip)

**Issue Title**: `Auto-generated report` (created by bot account)

**Issue Body**:
```
Automated issue from monitoring system
```

**Expected Outcome**:
- ✅ Triage detects bot author (username ends with `[bot]`)
- ✅ **Processing skipped entirely**
- ✅ No labels applied
- ✅ No comment posted
- ✅ Workflow exits early with success

---

### E2: Already Triaged Issue (Idempotency)

**Issue Title**: `Fix typo in README`

**Issue Body**: (any)

**Setup**: Manually add labels before automation runs:
- `auto-triage`
- `docs`
- `low-risk`

**Expected Outcome**:
- ✅ Triage detects existing labels
- ✅ **Processing skipped** (idempotency check)
- ✅ Log: "Issue already triaged, skipping"
- ✅ Returns `alreadyProcessed: true`
- ✅ No duplicate processing

---

### E3: Ambiguous Classification (OTHER)

**Issue Title**: `Question about implementation`

**Issue Body**:
```
I'm wondering how the authentication flow works. Could you explain?
```

**Expected Outcome**:
- ✅ Keyword classification inconclusive
- ✅ AI classification used
- ✅ Classified as `OTHER` (not suitable for auto-fix)
- ✅ Labels: `auto-triage`, `question` (if you have it) or no classification label
- ✅ Risk: LOW or MEDIUM
- ✅ Decision: `HUMAN_REVIEW_REQUIRED`
- ✅ **NO PR CREATED**
- ✅ Comment suggests manual review

---

### E4: Empty File Changes (No-Op)

**Issue Title**: `Optimization request`

**Issue Body**:
```
Please optimize the code performance
```

**Expected Outcome**:
- ✅ Triage succeeds
- ✅ Planner generates plan with 0 file changes
- ✅ Code agent creates no-op result
- ✅ Comment explains no concrete changes identified
- ✅ **NO PR CREATED** (nothing to commit)
- ✅ Suggests providing more specific requirements

---

### E5: Concurrent Issue Processing

**Setup**: Create 5 issues simultaneously

**Expected Outcome**:
- ✅ All 5 workflow runs start
- ✅ Each processes independently
- ✅ No race conditions or conflicts
- ✅ Each creates separate branch/PR
- ✅ All succeed or fail independently

**Validation**:
- Check 5 separate workflow runs
- Verify different branch names
- Confirm no git conflicts between runs

---

## 📊 Test Results Summary

After running all tests, verify:

### System Health Indicators
- [ ] All positive scenarios create PRs successfully
- [ ] All security blocks work (no false negatives)
- [ ] All validation failures roll back cleanly
- [ ] Error comments are helpful and actionable
- [ ] Structured logs provide good observability
- [ ] Cost estimates are accurate
- [ ] Timeouts are respected
- [ ] Rate limiting handles gracefully
- [ ] Idempotency prevents duplicate work
- [ ] Draft PRs created for MEDIUM risk

### Performance Metrics
- [ ] Triage completes < 30 seconds
- [ ] End-to-end (triage → PR) < 3 minutes for simple fixes
- [ ] No workflow timeouts on typical issues
- [ ] API costs within acceptable range

### Error Handling
- [ ] No unhandled exceptions
- [ ] All errors have `automation-failed` label
- [ ] Error comments explain next steps
- [ ] Rollbacks complete successfully
- [ ] No orphaned branches or commits

---

## 🧪 Advanced Test Scenarios

### A1: Multi-Language Fix

**Issue**: Fix typo in Python and JavaScript files

**Expected**: Handles both file types correctly

---

### A2: Large Diff

**Issue**: Update 500-line configuration file

**Expected**: Handles large diffs without truncation errors

---

### A3: Binary File Reference

**Issue**: Mentions updating an image file

**Expected**: Detects binary, blocks or handles gracefully

---

### A4: Special Characters

**Issue Title**: Contains emoji 🚀 or special chars

**Expected**: Handles gracefully, proper escaping

---

### A5: Rapid-Fire Issues

**Setup**: Create 10 issues in 30 seconds

**Expected**: Queue processing, all complete successfully

---

## 🔍 Monitoring Checklist

For production deployment:
- [ ] Set up alerts for `automation-failed` label
- [ ] Monitor API cost trends
- [ ] Track success/failure rates
- [ ] Review draft PRs regularly
- [ ] Audit security blocks for false positives
- [ ] Check artifact retention and cleanup
- [ ] Monitor workflow execution times
- [ ] Review error logs weekly

---

## 📝 Test Execution Log

Use this template to track test results:

| Test ID | Description | Status | Notes |
|---------|-------------|--------|-------|
| P1      | Simple typo | ✅ | PR #123 merged |
| P2      | Missing import | ✅ | Validation passed |
| N1      | Security block | ✅ | Correctly blocked |
| F1      | Validation fail | ✅ | Rolled back cleanly |
| ... | ... | ... | ... |

**Test Date**: _______________  
**Tester**: _______________  
**Branch/Commit**: _______________  
**Issues Created**: #___ to #___
