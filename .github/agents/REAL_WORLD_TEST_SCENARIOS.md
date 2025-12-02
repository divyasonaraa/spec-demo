# Real-World Bug Test Scenarios

Practical test cases simulating actual user-reported bugs for the dynamic form generator project.

---

## 🐛 Real Bug Reports (Test These)

### Bug 1: Dropdown Not Closing on Outside Click

**Issue Title**: `Dropdown menu doesn't close when clicking outside`

**Issue Body**:
```markdown
## Bug Description
The dropdown component (BaseSelect.vue) stays open when I click outside of it. 
It should close automatically like other dropdowns.

## Steps to Reproduce
1. Click on any dropdown field in the form
2. Dropdown opens
3. Click anywhere outside the dropdown
4. **Bug**: Dropdown stays open (should close)

## Expected Behavior
Dropdown should close when clicking outside

## Current Behavior
Dropdown remains open, must click the dropdown again to close

## Affected Files
- src/components/base/BaseSelect.vue

## Browser
Chrome 120, Firefox 121

## Possible Fix
Add click-outside directive or event listener to close dropdown on outside clicks
```

**What Auto-Fix Will Do**:
1. **Triage** (~10s):
   - Classification: `BUG`
   - Risk: `LOW` (single component file)
   - Labels: `auto-triage`, `bug`, `low-risk`, `auto-fix`

2. **Planner** (~30s):
   - Analyzes BaseSelect.vue
   - Plans to add `v-click-outside` directive or `@blur` handler
   - Validation: npm run lint, npm run type-check

3. **Code Agent** (~60s):
   - Adds click-outside logic to BaseSelect.vue
   - Example fix:
   ```javascript
   // Add to mounted()
   document.addEventListener('click', this.handleClickOutside)
   
   // Add method
   handleClickOutside(event) {
     if (!this.$el.contains(event.target)) {
       this.isOpen = false
     }
   }
   
   // Add to beforeUnmount()
   document.removeEventListener('click', this.handleClickOutside)
   ```
   - Runs validation
   - Commits with message: `fix: close dropdown on outside click`

4. **PR Generator** (~10s):
   - Creates PR with description
   - Links to issue: "Fixes #123"
   - Manual verification steps included

**Expected Timeline**: 2-3 minutes from issue creation to PR

**Expected PR Title**: `Fix #123: close dropdown on outside click`

---

### Bug 2: Form Validation Error Message Not Showing

**Issue Title**: `Validation error messages are not displayed under input fields`

**Issue Body**:
```markdown
## Bug Description
When I submit a form with invalid data, the validation runs but 
error messages don't appear under the fields.

## Steps to Reproduce
1. Open any form (e.g., basic-form.json)
2. Leave required field empty
3. Click Submit
4. **Bug**: No error message shows under the field

## Expected Behavior
Red error message should appear below the invalid field

## Affected Files
- src/components/form/ValidationError.vue
- src/components/form/FieldWrapper.vue

## Console Errors
None - validation is working, just not displaying

## Possible Fix
Check if ValidationError component is being passed the error prop correctly
```

**What Auto-Fix Will Do**:
1. **Triage**:
   - Classification: `BUG`
   - Risk: `LOW` (2 files, both components)
   - Labels: `auto-triage`, `bug`, `low-risk`, `auto-fix`

2. **Planner**:
   - Analyzes both component files
   - Plans to fix prop passing or conditional rendering

3. **Code Agent**:
   - Fixes ValidationError display logic
   - Example: Ensure `v-if="error"` or `:error="validationError"`
   - Validates TypeScript types

4. **PR**: Ready in ~2-3 minutes

---

### Bug 3: Multi-Step Form Progress Not Updating

**Issue Title**: `Step indicator doesn't update when moving between form steps`

**Issue Body**:
```markdown
## Bug Description
In multi-step forms, when I click "Next" the form content changes 
but the step indicator at the top stays on step 1.

## Steps to Reproduce
1. Load multi-step-form.json example
2. Fill out step 1 fields
3. Click "Next" button
4. Form shows step 2 content ✓
5. **Bug**: Step indicator still shows "1" active

## Expected Behavior
Active step indicator should move to step 2

## Affected Files
- src/components/form/StepIndicator.vue
- src/composables/useMultiStep.ts

## Environment
Vue 3.4, Vite 5.0

## Possible Fix
Check if currentStep prop is being updated/passed correctly
```

**What Auto-Fix Will Do**:
1. **Triage**:
   - Classification: `BUG`
   - Risk: `LOW` (2 files, UI components)
   - Decision: `AUTO_FIX`

2. **Planner**:
   - Identifies reactive state issue
   - Plans to fix prop reactivity or emit event

3. **Code Agent**:
   - Updates StepIndicator to watch currentStep properly
   - Example: Change to `:current="currentStep"` or add `watch`
   - Tests TypeScript compilation

4. **PR**: Created automatically

---

### Bug 4: JSON Configuration Not Loading from URL

**Issue Title**: `DataSource component fails to load config from API endpoint`

**Issue Body**:
```markdown
## Bug Description
When I try to load form configuration from a URL, nothing happens.
The form should fetch and display the config.

## Steps to Reproduce
1. Use ConfigEditor to load from URL
2. Enter: https://api.example.com/form-config.json
3. Click "Load from URL"
4. **Bug**: Nothing happens, no error shown

## Expected Behavior
Form should fetch JSON and render the form

## Error in Console
```
TypeError: Cannot read property 'fields' of undefined
```

## Affected Files
- src/composables/useDataSource.ts
- src/components/demo/ConfigEditor.vue

## Possible Fix
Add error handling for failed API requests
Check if response.data exists before accessing fields
```

**What Auto-Fix Will Do**:
1. **Triage**:
   - Classification: `BUG`
   - Risk: `LOW` (2 files)
   - Decision: `AUTO_FIX`

2. **Code Agent**:
   - Adds try-catch in useDataSource
   - Adds null checks for response.data
   - Example:
   ```javascript
   try {
     const response = await fetch(url)
     const data = await response.json()
     if (!data || !data.fields) {
       throw new Error('Invalid config format')
     }
     return data
   } catch (error) {
     console.error('Failed to load config:', error)
     throw error
   }
   ```

3. **PR**: Includes error handling improvements

---

### Bug 5: Conditional Fields Not Hiding When Condition Changes

**Issue Title**: `Conditional field stays visible after trigger value changes`

**Issue Body**:
```markdown
## Bug Description
When I have a conditional field that shows based on another field's value,
it doesn't hide when the trigger value changes back.

## Steps to Reproduce
1. Load conditional-form.json
2. Select "Yes" for "Do you have experience?" 
3. "Years of experience" field appears ✓
4. Change back to "No"
5. **Bug**: "Years of experience" still visible (should hide)

## Expected Behavior
Conditional field should hide when condition is no longer met

## Affected Files
- src/composables/useConditionalFields.ts
- src/components/form/FieldWrapper.vue

## Possible Fix
Watch for changes to the trigger field and re-evaluate visibility
```

**What Auto-Fix Will Do**:
1. **Triage**:
   - Classification: `BUG`
   - Risk: `LOW`
   - Decision: `AUTO_FIX`

2. **Code Agent**:
   - Adds reactive watch in useConditionalFields
   - Example:
   ```javascript
   watch(() => formData[condition.field], (newValue) => {
     isVisible.value = evaluateCondition(condition, newValue)
   })
   ```

3. **PR**: Auto-created with fix

---

## 🚨 Bugs That Should Block Auto-Fix

### Bug 6: Authentication Token Not Working (Security)

**Issue Title**: `JWT token validation failing in api.service.ts`

**Issue Body**:
```markdown
## Bug Description
API requests are failing because JWT token is not being sent correctly

## Affected Files
- src/services/api.service.ts
- src/services/token.service.ts

## Error
401 Unauthorized

## Possible Fix
Update Authorization header: Bearer ${token}
```

**What Auto-Fix Will Do**:
1. **Triage**:
   - Classification: `BUG`
   - Risk: **`HIGH`** (security keywords: "token", "authorization", "authentication")
   - Security flags: `hasSecurityKeywords: true`
   - Decision: **`HUMAN_REVIEW_REQUIRED`**

2. **Outcome**:
   - ❌ NO PR created
   - ✅ Labels: `high-risk`, `security`, `human-review-required`
   - ✅ Comment: "Auto-fix blocked due to security-sensitive changes"
   - ✅ Manual review required

---

### Bug 7: Database Migration Issue (Infrastructure)

**Issue Title**: `Update user table schema to add role column`

**Issue Body**:
```markdown
## Feature
Add role column to users table

## Affected Files
- db/migrations/add_role_column.sql
- src/types/user.ts
```

**What Auto-Fix Will Do**:
1. **Triage**:
   - Classification: `FEATURE`
   - Risk: **`HIGH`** (risky change type: database migration)
   - Security flags: `hasRiskyChangeTypes: true`
   - Decision: **`HUMAN_REVIEW_REQUIRED`**

2. **Outcome**:
   - ❌ NO PR created (blocked by security gate)
   - ✅ Manual review required

---

### Bug 8: Update Environment Variables (Security)

**Issue Title**: `Change API base URL in .env file`

**Issue Body**:
```markdown
## Chore
Update API_BASE_URL in .env from old to new server

## Affected Files
- .env
- .env.production
```

**What Auto-Fix Will Do**:
1. **Triage**:
   - Classification: `CHORE`
   - Risk: **`HIGH`** (security file: `.env*`)
   - Security flags: `hasSecurityFilePath: true`
   - Decision: **`HUMAN_REVIEW_REQUIRED`**

2. **Outcome**:
   - ❌ Blocked - no PR
   - ✅ Comment explains why

---

## 🔄 Medium Risk Bugs (Draft PR)

### Bug 9: API Endpoint Path Changed Across Multiple Services

**Issue Title**: `Update /api/v1/users endpoint to /api/v2/users`

**Issue Body**:
```markdown
## Refactoring
API version updated, need to change endpoint paths

## Affected Files
- src/services/api.service.ts
- src/services/user.service.ts
- src/config/api.ts
- src/views/UserProfile.vue
- src/views/AdminPanel.vue

## Changes
Replace /api/v1/ with /api/v2/ in all service calls
```

**What Auto-Fix Will Do**:
1. **Triage**:
   - Classification: `CHORE`
   - Risk: **`MEDIUM`** (5 files affected)
   - Decision: **`DRAFT_PR`**

2. **Planner**:
   - Generates plan to update all 5 files

3. **Code Agent**:
   - Makes changes across all files
   - Validates TypeScript

4. **PR Generator**:
   - Creates **DRAFT PR** (not ready to merge)
   - Labels: `medium-risk`, `needs-review`, `auto-fix`
   - Comment: "⚠️ This PR affects 5 files and requires maintainer review"
   - Assigns reviewers from CODEOWNERS

5. **Outcome**:
   - ✅ Draft PR created
   - ✅ Maintainer must review and approve
   - ✅ Manual testing required before merge

---

## 📋 Quick Test Checklist

### To Test the System, Create These Issues:

**✅ Should Auto-Fix (LOW Risk)**:
- [ ] Bug 1: Dropdown click outside
- [ ] Bug 2: Validation error display
- [ ] Bug 3: Step indicator update
- [ ] Bug 4: JSON loading error
- [ ] Bug 5: Conditional field hiding

**❌ Should Block (HIGH Risk)**:
- [ ] Bug 6: Authentication/security
- [ ] Bug 7: Database migration
- [ ] Bug 8: Environment variables

**🔄 Should Create Draft PR (MEDIUM Risk)**:
- [ ] Bug 9: Multi-file API update (5+ files)

---

## 🎯 Expected Outcomes Summary

| Bug # | Classification | Risk | Auto-Fix? | Outcome |
|-------|---------------|------|-----------|---------|
| 1 | BUG | LOW | ✅ YES | PR auto-created |
| 2 | BUG | LOW | ✅ YES | PR auto-created |
| 3 | BUG | LOW | ✅ YES | PR auto-created |
| 4 | BUG | LOW | ✅ YES | PR auto-created |
| 5 | BUG | LOW | ✅ YES | PR auto-created |
| 6 | BUG | HIGH | ❌ NO | Blocked (security) |
| 7 | FEATURE | HIGH | ❌ NO | Blocked (migration) |
| 8 | CHORE | HIGH | ❌ NO | Blocked (env file) |
| 9 | CHORE | MEDIUM | 🔄 DRAFT | Draft PR created |

---

## 🧪 Step-by-Step Testing Guide

### Test Bug #1 (Dropdown Click Outside)

**1. Create the Issue:**
- Go to your repository
- Click "Issues" → "New Issue"
- Copy-paste Bug 1 title and body exactly as shown above
- Click "Submit new issue"

**2. Watch the Workflow:**
- Go to "Actions" tab
- See "Auto-Fix GitHub Issues" workflow start automatically
- Watch each job: Triage → Planner → Code → PR

**3. Verify Triage (30 seconds):**
- Go back to the issue
- See comment with triage analysis
- Check labels: `auto-triage`, `bug`, `low-risk`, `auto-fix`

**4. Verify PR Creation (2-3 minutes):**
- Go to "Pull Requests" tab
- See new PR: "Fix #N: close dropdown on outside click"
- Open the PR

**5. Review PR Contents:**
- Check PR description has all sections:
  - ✅ Summary
  - ✅ What Changed
  - ✅ Why This Fix
  - ✅ Manual Verification Steps
  - ✅ Validation Results
- Check "Files Changed" tab
- Verify only BaseSelect.vue modified
- Review the code changes

**6. Test the Fix (Manual):**
```bash
# Checkout the PR branch
git fetch origin
git checkout fix/1-dropdown-click-outside

# Install and run
npm install
npm run dev

# Test in browser:
# 1. Open form with dropdown
# 2. Click dropdown to open
# 3. Click outside
# 4. Verify dropdown closes ✓
```

**7. Merge or Request Changes:**
- If fix works: Click "Merge pull request"
- If needs changes: Leave review comments
- Issue will auto-close when PR merges

---

### Test Bug #6 (Security Block)

**1. Create Issue:**
- Copy Bug 6 title/body
- Submit issue

**2. Verify Blocking:**
- Wait ~30 seconds for triage
- Check labels: `high-risk`, `security`, `human-review-required`
- See comment: "Auto-fix blocked due to security-sensitive changes"

**3. Verify No PR:**
- Go to Pull Requests tab
- Confirm NO PR was created
- Workflow should stop after triage job

**4. Verify Logs:**
- Actions tab → View workflow run
- See planner/code/pr jobs were **skipped**
- Logs show: "Decision: HUMAN_REVIEW_REQUIRED"

---

### Test Bug #9 (Draft PR)

**1. Create Issue:**
- Copy Bug 9 title/body
- Submit

**2. Verify Draft PR Created:**
- Wait 3-4 minutes (more files = longer)
- Go to Pull Requests
- See **DRAFT** PR created

**3. Check PR Status:**
- PR should have draft indicator
- Labels: `medium-risk`, `needs-review`, `auto-fix`
- Comment warns maintainer review required

**4. Review Before Merge:**
- Review all 5 changed files
- Test locally
- Click "Ready for review"
- Get approval from maintainer
- Then merge

---

## 📊 Success Criteria

After testing all 9 bugs:

✅ **LOW risk bugs (1-5)**: All create PRs automatically  
✅ **HIGH risk bugs (6-8)**: All blocked with clear explanation  
✅ **MEDIUM risk bug (9)**: Creates draft PR requiring review  
✅ **No false negatives**: Security issues always blocked  
✅ **Error handling**: All failures show helpful messages  
✅ **Performance**: Triage < 30s, Total < 3min for simple bugs

---

## 💡 Tips for Real Usage

1. **Start with Bug #1**: Easiest to verify end-to-end flow
2. **Test Security Early**: Verify Bug #6 blocks correctly
3. **Monitor Costs**: Check logs for AI API usage estimates
4. **Review Draft PRs**: Always test MEDIUM risk changes locally
5. **Iterate on Patterns**: If auto-fix misses something, update security-constraints.js
6. **Use Idempotency**: Re-running same issue won't duplicate work

---

## 🔍 What to Look For

### In Triage Comments:
```json
{
  "classification": "BUG",
  "confidence": "HIGH",
  "risk": {
    "level": "LOW",
    "factors": {
      "fileCount": 1,
      "sensitiveFiles": []
    }
  },
  "autoFixDecision": "AUTO_FIX"
}
```

### In PR Descriptions:
- Clear summary of what changed
- Link to original issue
- Manual testing steps
- Rollback instructions
- Validation results

### In Logs:
- Structured JSON logging
- Timing information
- Cost estimates
- Error details (if any)

---

**Start testing with Bug #1 to see the full workflow in action!** 🚀
