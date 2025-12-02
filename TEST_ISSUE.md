# Test Issue to Create

Copy the content below and create a new GitHub issue in your repository.

---

## Issue Title
```
Form validation errors are not showing up below input fields
```

## Issue Body
```markdown
## Bug Description
When I submit a form with invalid data (like empty required fields), the validation runs but the error messages don't appear below the input fields. The form doesn't submit (which is correct), but users have no indication of what's wrong.

## Steps to Reproduce
1. Go to the demo page
2. Open any form example (e.g., basic-form.json)
3. Leave a required field empty (like "Name" or "Email")
4. Click the Submit button
5. **Bug**: Form doesn't submit (correct) but NO error message appears below the field

## Expected Behavior
A red error message should appear below the invalid field saying something like:
- "This field is required"
- "Email is invalid"
- etc.

## Current Behavior
- Form validation logic runs (form doesn't submit)
- But no visual error message appears
- Users don't know what went wrong

## Impact
Users are confused when form doesn't submit with no explanation. This is a poor UX.

## Browser/Environment
- Chrome 120
- Firefox 121
- Safari 17

## Additional Context
The validation logic itself seems to work (form doesn't submit when invalid), but the error display is broken. Checking the Vue DevTools shows the error messages exist in state, but they're not rendering in the UI.

## Suggested Priority
**High** - This affects user experience on all forms
```

---

## What to Do Next

1. **Copy the Issue Title and Body above**
2. **Go to your GitHub repository**: https://github.com/divyasonaraa/spec-demo
3. **Click "Issues" tab**
4. **Click "New Issue" button**
5. **Paste the title and body**
6. **Click "Submit new issue"**
7. **Watch the Actions tab** - workflow will start automatically

## Expected Outcome (2-3 minutes)

### After 30 seconds:
- ✅ Comment appears with triage analysis
- ✅ Labels applied: `auto-triage`, `bug`, `low-risk`, `auto-fix`
- ✅ Classification: BUG
- ✅ Risk Level: LOW
- ✅ Decision: AUTO_FIX

### After 2-3 minutes:
- ✅ Pull Request created automatically
- ✅ PR Title: "Fix #N: display validation errors below input fields"
- ✅ PR fixes the `v-if="false && error"` bug by changing it to `v-if="error"`
- ✅ Validation passes (lint + type-check)
- ✅ Ready to merge!

### PR Will Include:
- Summary of what changed
- Explanation of the fix
- Manual testing steps
- Validation results
- Rollback instructions

## How to Verify the Fix

After PR is created:

```bash
# Checkout the PR branch
git fetch origin
git checkout fix/N-display-validation-errors  # (replace N with issue number)

# Run the app
npm install
npm run dev

# Test in browser:
# 1. Open http://localhost:5173
# 2. Try the basic form
# 3. Leave a required field empty
# 4. Click Submit
# 5. ✅ Should now see red error message below the field!
```

## If Something Goes Wrong

Check the Actions tab for logs. The system should:
- ✅ Never create a PR if it's HIGH risk (security)
- ✅ Create DRAFT PR if MEDIUM risk (3+ files)
- ✅ Post error comment if validation fails
- ✅ Add `automation-failed` label on errors

---

**The bug is now live in the codebase. Create the issue to test the auto-fix system!** 🚀
