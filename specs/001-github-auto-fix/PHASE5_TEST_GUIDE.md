# Phase 5 Testing Guide: Security-First Auto-Fix Decision Gate

## Overview
Phase 5 implements comprehensive security checks to prevent auto-fix from modifying security-sensitive files or configurations. This guide provides test scenarios to verify the security gate functionality.

## Security Detection Layers

### Layer 1: Triage Agent Security Check
- **When**: During initial issue triage
- **What**: Detects security keywords, sensitive file paths, and risky change types
- **Result**: Sets `securityFlags: true`, elevates risk to HIGH, sets `autoFixDecision: HUMAN_REVIEW_REQUIRED`

### Layer 2: Code Agent Pre-Check
- **When**: Before any code modifications
- **What**: Double-checks file paths and change types
- **Result**: Throws `SECURITY_VIOLATION` error if sensitive files detected

## Test Scenarios

### Test 1: Environment File Change (Critical)
**Issue Title**: `Update API key in .env file`

**Issue Body**:
```markdown
Need to update the API_KEY value in `.env` file to the new production key.

File: `.env`
```

**Expected Results**:
- ✅ Triage completes successfully
- ✅ Classification: CHORE or OTHER
- ✅ Risk: HIGH
- ✅ Security flags: true
- ✅ Labels applied: `auto-triage`, `high-risk`, `security`, `human-review-required`
- ✅ Auto-fix decision: HUMAN_REVIEW_REQUIRED
- ✅ Comment shows: "⚠️ Security Concerns Detected"
- ✅ No planner job runs (blocked by triage decision)
- ✅ No code job runs

**Keyword Matches**: `api key`, `.env`  
**File Matches**: `.env`

---

### Test 2: Authentication Code Change
**Issue Title**: `Fix bug in authentication middleware`

**Issue Body**:
```markdown
The JWT token validation is failing for expired tokens. Need to fix the
auth middleware logic.

Files:
- `src/middleware/auth.js`
- `src/utils/jwt.js`
```

**Expected Results**:
- ✅ Triage completes
- ✅ Classification: BUG
- ✅ Risk: HIGH
- ✅ Security flags: true
- ✅ Labels: `auto-triage`, `bug`, `high-risk`, `security`, `human-review-required`
- ✅ Auto-fix decision: HUMAN_REVIEW_REQUIRED

**Keyword Matches**: `authentication`, `jwt`, `token`  
**File Matches**: `auth.js`, `jwt`

---

### Test 3: Database Migration
**Issue Title**: `Add column to users table`

**Issue Body**:
```markdown
Need to add a new `last_login` column to the users table.

ALTER TABLE users ADD COLUMN last_login TIMESTAMP;

File: `db/migrations/20231202_add_last_login.sql`
```

**Expected Results**:
- ✅ Triage completes
- ✅ Classification: FEATURE or CHORE
- ✅ Risk: HIGH
- ✅ Security flags: true
- ✅ Risky change type detected: DATABASE_MIGRATION
- ✅ Labels: `auto-triage`, `high-risk`, `human-review-required`
- ✅ Auto-fix decision: HUMAN_REVIEW_REQUIRED

**Keyword Matches**: `database`, `alter table`, `users`  
**Risky Change**: DATABASE_MIGRATION

---

### Test 4: Deployment Configuration
**Issue Title**: `Update production docker-compose configuration`

**Issue Body**:
```markdown
Need to change the production database connection string in docker-compose.

File: `docker-compose.prod.yml`
```

**Expected Results**:
- ✅ Triage completes
- ✅ Risk: HIGH
- ✅ Security flags: true
- ✅ Risky change type: INFRASTRUCTURE_CONFIG
- ✅ Labels: `auto-triage`, `high-risk`, `security`, `human-review-required`
- ✅ Auto-fix decision: HUMAN_REVIEW_REQUIRED

**Keyword Matches**: `production`, `database connection`  
**File Matches**: `docker-compose.prod`  
**Risky Change**: INFRASTRUCTURE_CONFIG

---

### Test 5: CI/CD Workflow Change
**Issue Title**: `Fix GitHub Actions workflow syntax error`

**Issue Body**:
```markdown
The auto-fix workflow has a syntax error on line 45.

File: `.github/workflows/auto-fix.yml`
```

**Expected Results**:
- ✅ Triage: Risk HIGH, security flags true
- ✅ If somehow planner runs: code agent BLOCKS with SECURITY_VIOLATION
- ✅ File pattern matches: `.github/workflows`
- ✅ Risky change type: CI_CD_PIPELINE

---

### Test 6: Private Key File
**Issue Title**: `Update SSL certificate`

**Issue Body**:
```markdown
Need to replace the expired SSL certificate.

Files:
- `certs/server.pem`
- `certs/server.key`
```

**Expected Results**:
- ✅ Risk: HIGH
- ✅ Security flags: true
- ✅ File matches: `.pem`, `.key`
- ✅ Auto-fix decision: HUMAN_REVIEW_REQUIRED

---

### Test 7: Safe Change (Negative Test)
**Issue Title**: `Fix typo in README: teh → the`

**Issue Body**:
```markdown
Simple typo in README.md on line 15.

File: `README.md`
```

**Expected Results**:
- ✅ Classification: DOCS
- ✅ Risk: LOW
- ✅ Security flags: false (no security concerns)
- ✅ Labels: `auto-triage`, `docs`, `low-risk`
- ✅ Auto-fix decision: AUTO_FIX
- ✅ Planner and code agents execute normally

---

## Verification Steps

### Step 1: Create Test Issues
For each test scenario above, create a GitHub issue with the exact title and body.

### Step 2: Monitor Workflow
Watch the GitHub Actions workflow execution:
```bash
gh run list --workflow=auto-fix.yml
gh run view <run-id> --log
```

### Step 3: Check Triage Comment
Verify the triage comment on each issue contains:
- Risk level (HIGH for security issues)
- Security concerns section (if applicable)
- Auto-fix decision explanation
- Detailed security findings (keywords, files, change types)

### Step 4: Verify Labels
Check that correct labels are applied:
```bash
gh issue view <issue-number> --json labels
```

Expected labels for security issues:
- `auto-triage`
- `high-risk`
- `security`
- `human-review-required`

### Step 5: Confirm Blocking
For security-flagged issues:
- ❌ No planner job should run
- ❌ No code job should run
- ❌ No branch created
- ❌ No PR created

### Step 6: Test Code Agent Fallback
If triage somehow misses a security issue, the code agent should still block:

1. Manually run planner-agent with a test fix-plan that includes `.env`
2. Run code-agent
3. Verify it throws SECURITY_VIOLATION before any file modifications

## Success Criteria

✅ **All 6 security test cases blocked** (Tests 1-6)  
✅ **Safe change allowed** (Test 7)  
✅ **Zero false negatives** (no security issue auto-fixed)  
✅ **Security flags properly set in triage result**  
✅ **Labels correctly applied**  
✅ **Clear explanations in comments**  
✅ **Code agent pre-check blocks even if triage missed**

## Security Patterns Tested

| Pattern Type | Examples Tested |
|--------------|----------------|
| **Keywords** | password, api key, token, authentication, database, production |
| **File Paths** | `.env`, `auth.js`, `.pem`, `.key`, `docker-compose.prod`, `.github/workflows` |
| **Change Types** | DATABASE_MIGRATION, INFRASTRUCTURE_CONFIG, CI_CD_PIPELINE |

## Known Limitations

1. **Text-based detection**: Cannot analyze actual file contents (only issue text)
2. **Pattern matching**: May have false positives (prefer blocking over allowing)
3. **No semantic analysis**: Cannot understand intent, only matches patterns

## Troubleshooting

### Issue: Security keywords detected in safe context
**Example**: "I want to add password validation to the signup form"  
**Behavior**: May be flagged as security-sensitive due to keyword "password"  
**Solution**: This is intentional - err on the side of caution. Maintainer can manually review and apply fix.

### Issue: Code agent blocks after triage approved
**Cause**: Code agent has additional hardcoded critical patterns  
**Solution**: This is defense-in-depth. Both layers should align, but code agent is final gate.

---

**Phase 5 Complete**: Security-first auto-fix decision gate operational ✅
