# Demo Bugs for Auto-Fix Agent

These bugs have been intentionally introduced to demonstrate the auto-fix agent with issues that non-technical users would naturally report.

## Bug #1: Ghost button text is too light to read
**Severity**: UX Issue
**User Report**: "I can't read the text on the cancel button, it's too light gray"

**GitHub Issue Template**:
```
Title: Cancel button text is too light and hard to read
Labels: bug, auto-fix, ui

The cancel button in the form uses a ghost style but the text color is too light (gray-300).
Users are having trouble reading it, especially in bright lighting.

Steps to reproduce:
1. Open any form with a cancel button
2. Notice the text is very light gray
3. Hard to read against white background

Expected: Button text should be dark enough to read clearly (gray-700)
Actual: Button text is very light gray (gray-300)

Affected file: src/components/base/BaseButton.vue
```

---

## Bug #2: Success notification shows wrong icon
**Severity**: Visual Bug
**User Report**: "When I submit the form, the success message shows an X icon instead of a checkmark"

**GitHub Issue Template**:
```
Title: Success notification displays error icon instead of checkmark
Labels: bug, auto-fix, ui

When a form is successfully submitted, the toast notification appears with a success
message but shows a red X icon (error icon) instead of a green checkmark.

This is confusing because:
- The message says "Success"
- The background is green
- But the icon is a red X

Steps to reproduce:
1. Fill out any form
2. Submit successfully
3. Look at the toast notification
4. See X icon instead of checkmark

Expected: Green circle with checkmark icon
Actual: Shows X icon (error icon)

Affected file: src/components/common/ToastNotification.vue
```

---

## Bug #3: Step counter shows wrong number
**Severity**: Confusing UX
**User Report**: "The step counter at the top says 'Step 0 of 3' when I start the form"

**GitHub Issue Template**:
```
Title: Multi-step form shows "Step 0" instead of "Step 1"
Labels: bug, auto-fix, ui

The step progress indicator at the top of multi-step forms displays the wrong step number.

Current behavior:
- First step shows: "Step 0 of 3"
- Second step shows: "Step 1 of 3"
- Third step shows: "Step 2 of 3"

Expected behavior:
- First step should show: "Step 1 of 3"
- Second step should show: "Step 2 of 3"
- Third step should show: "Step 3 of 3"

This is confusing for users who expect steps to be numbered starting from 1, not 0.

Steps to reproduce:
1. Open the demo page
2. Start a multi-step form
3. Look at the step counter text
4. See "Step 0 of 3" on the first step

Affected file: src/components/form/StepIndicator.vue
```

---

## How to Demo

### For Each Bug:

1. **Create the GitHub Issue**
   - Copy the issue template above
   - Create a new issue in your repository
   - Add labels: `bug` and `auto-fix`

2. **Let the Agent Work**
   - Triage agent analyzes the issue
   - Auto-fix agent generates the fix
   - PR is created automatically

3. **Verify the Fix**
   - Check the PR description
   - Review the code changes
   - Merge if correct

### Expected Fixes:

**Bug #1**: Change `text-gray-300` to `text-gray-700` in ghost button variant
**Bug #2**: Use correct checkmark icon SVG path for success toast
**Bug #3**: Add `+ 1` to display `currentStep + 1` instead of just `currentStep`

### Why These Bugs Are Good for Demo:

✅ **Non-technical language** - Anyone can report these
✅ **Visual/UX issues** - Easy to verify before and after
✅ **Clear impact** - Obviously wrong behavior
✅ **Simple fixes** - Agent can handle them easily
✅ **Real-world** - These are actual bugs users would encounter
✅ **Safe** - Won't break functionality, just visual/UX issues

## Demo Script

1. **Show the bugs live**:
   - Open the app
   - Point out the light ghost button text
   - Submit a form and show the wrong icon
   - Navigate steps and show "Step 0"

2. **Create issues as a user would**:
   - Use natural language
   - Describe what you see vs. what you expect
   - No technical jargon

3. **Watch the automation**:
   - Triage agent classifies the issues
   - Auto-fix agent generates solutions
   - PRs are created

4. **Show the results**:
   - Review the generated code
   - Merge the PRs
   - Verify bugs are fixed in the UI

   checking for issues

