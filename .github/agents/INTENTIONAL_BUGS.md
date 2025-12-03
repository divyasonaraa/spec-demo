# Intentional Bugs for Auto-Fix Testing

This document lists all intentional bugs introduced into the codebase for testing the GitHub Auto-Fix system.

**Created**: 2025-12-03  
**Purpose**: Test automatic issue triage and PR generation

---

## 🐛 Bug Summary

| # | Severity | Type | Description |
|---|----------|------|-------------|
| 1 | Simple | Typo | Button says "Sumbit" instead of "Submit" |
| 2 | Medium | UX | Dropdown doesn't close when clicking outside |
| 3 | Medium | Memory Leak | Toast timer keeps running after manual close |
| 4 | Medium | Logic Error | Wrong step highlighted in multi-step form |
| 5 | Simple | Logic Error | Validation errors never display |
| 6 | Medium | Race Condition | Form can be submitted multiple times |
| 7 | Complex | Memory Leak | App gets slower over time (cache issue) |
| 8 | Complex | Security | User input not sanitized |
| 9 | Medium | Logic Error | Validation delayed/stale |
| 10 | Medium | Logic Error | Can skip required steps in wizard |
| 11 | Medium | Type Error | Number fields crash with length validation |
| 12 | Medium | Logic Error | Async validation results lost |
| 13 | Medium | Config Error | Forms fail on slow internet |
| 14 | Low | Reactivity | Config editor doesn't update |
| 15 | Low | CSS Error | Checkboxes are way too big |
| 16 | Medium | Type Error | Radio buttons don't show as selected |
| 17 | Medium | Logic Error | Some validation errors never show |
| 18 | Medium | Silent Failure | Dropdown fails before parent selected |
| 19 | Low | Memory Leak | Download button leaks memory |
| 20 | Simple | Typo | "Documentaiton" misspelled |
| 21 | Simple | Typo | README says "dependancies" |

---

## 📋 GitHub Issue Templates (Copy & Paste)

### Bug 1: Submit Button Typo

```
Title: Button says "Sumbit" instead of "Submit"

When I hover over the submit button or use a screen reader, it says "Sumbit form" 
which is spelled wrong. Should say "Submit form".
```

---

### Bug 2: Dropdown Won't Close

```
Title: Dropdown menu doesn't close when I click somewhere else

When I open a dropdown to select an option, then click outside of it, 
the dropdown stays open. I have to click on the dropdown again to close it.
Other websites close dropdowns when you click away.
```

---

### Bug 3: Toast Message Issue

```
Title: Notification disappears even after I already closed it

When I close a notification message manually by clicking X, a few seconds later
something weird happens - like the notification state changes again. 
I think it's trying to close something that's already closed?
```

---

### Bug 4: Wrong Step Highlighted

```
Title: Step indicator shows wrong step as active in multi-step form

I'm filling out a multi-step form and I'm on step 2, but the step indicator 
at the top still shows step 1 as the current step. It's confusing because 
I can't tell which step I'm actually on.
```

---

### Bug 5: No Error Messages

```
Title: No error messages appear when I submit invalid form data

I tried submitting a form without filling required fields. The form doesn't submit,
but there's no red error message telling me what's wrong. I can't tell which 
fields I need to fix.
```

---

### Bug 6: Form Submitted Twice

```
Title: Clicking submit button multiple times sends duplicate submissions

I clicked the submit button and it was taking a while, so I clicked again.
Now I got two confirmation emails! The button should be disabled after the 
first click or something to prevent this.
```

---

### Bug 7: App Gets Slower

```
Title: App becomes slower the longer I use it

I've been using the form builder all day, switching between different forms.
The app has gotten noticeably slower over time. When I refresh the page, 
it's fast again. Something might be using up memory?
```

---

### Bug 8: Security Concern with Form Data

```
Title: Special characters in form fields might cause issues

I'm worried that if someone types special characters like < > or script tags
in form fields, it might cause problems when displayed elsewhere. Can you make 
sure the data is cleaned before being sent?
```

---

### Bug 9: Validation Timing Issue

```
Title: Error messages appear after I already fixed the field

I was typing quickly and hit submit, but then validation errors showed up
for fields I had already fixed. The validation seems to be delayed or not
keeping up with my typing.
```

---

### Bug 10: Can Skip Steps

```
Title: I can jump to step 3 without completing step 1

In the multi-step form, I clicked directly on step 3 in the progress indicator
and it let me skip to step 3 without filling out the required fields in steps 
1 and 2. That shouldn't be allowed right?
```

---

### Bug 11: Number Field Breaks

```
Title: Form crashes when number field has certain validation

I created a form with a number field and added a minimum length validation rule.
When I try to use the form, it shows an error in the console and validation 
doesn't work properly. Number fields should probably not have "length" rules.
```

---

### Bug 12: Validation Result Missing

```
Title: Validation result seems to disappear sometimes

Sometimes when I'm typing in a field and validation runs, the result seems
to get lost or not returned properly. The error state doesn't update correctly
and I'm not sure if my input is valid or not.
```

---

### Bug 13: Forms Fail on Slow Internet

```
Title: Form submission fails on slow internet connections

When I'm on a slow internet connection (like on mobile data in a weak signal area), 
the form times out and says it failed even though the server probably received it.
Can you increase the timeout or add automatic retry?
```

---

### Bug 14: Config Changes Not Showing

```
Title: JSON editor doesn't update when form settings change

When I modify the form configuration programmatically or from another part of
the app, the JSON editor doesn't show the changes. I have to manually refresh 
or re-type the config to see updates.
```

---

### Bug 15: Checkboxes Too Big

```
Title: Checkboxes are huge and overlap with text

The checkbox inputs on forms are way too big - they look like 44 pixels square
instead of normal sized checkboxes. They overlap with the label text next to
them and look broken.
```

---

### Bug 16: Radio Button Not Showing Selection

```
Title: Radio button doesn't show as selected after clicking

I click on a radio button option and it doesn't show the filled circle indicating
it's selected. The value seems to work (form submits correctly) but visually 
it doesn't look selected. Confusing for users.
```

---

### Bug 17: Some Errors Don't Display

```
Title: Certain validation errors don't show up anywhere

Some validation rules trigger (I can see in console) but the error message 
never appears on screen. It seems like errors that aren't tied to a specific 
field are getting lost and not shown to users.
```

---

### Bug 18: Cascading Dropdown Fails

```
Title: Second dropdown fails when first dropdown not selected yet

I have a Country > State dropdown setup where State depends on Country.
Before I select a country, the State dropdown shows an error or fails to load.
It should either wait for country selection or show a helpful message.
```

---

### Bug 19: Download Button Issue

```
Title: Download button might have memory issues

I noticed if I click the "Download JSON" button many times in a row, something
seems to build up. Not sure exactly what's happening but the page might be
getting slower after many downloads.
```

---

### Bug 20: Documentation Misspelled

```
Title: Navigation link says "Documentaiton" 

On the demo page, the link to documentation is spelled "Documentaiton" 
instead of "Documentation". Small typo but looks unprofessional.
```

---

### Bug 21: README Spelling Error

```
Title: README has spelling mistake

In the Quick Start section of the README file, it says "Install dependancies"
but the correct spelling is "dependencies". Just a small typo.
```

---

## 🎯 Testing Priority

### Start with these easy ones:
1. Bug 1 (Button typo)
2. Bug 5 (No error messages)
3. Bug 4 (Wrong step highlighted)
4. Bug 15 (Checkboxes too big)
5. Bug 20 (Documentation typo)
6. Bug 21 (README typo)

### Then test medium complexity:
7. Bug 6 (Double submit)
8. Bug 10 (Skip steps)
9. Bug 16 (Radio selection)
10. Bug 3 (Toast timer)

### Complex bugs (may need human review):
11. Bug 7 (Memory leak)
12. Bug 8 (Security - should NOT auto-fix)

---

## 📊 Expected Outcomes

| Risk Level | Expected Behavior |
|------------|------------------|
| LOW | Auto-fix → PR created immediately |
| MEDIUM | Auto-fix → Draft PR, needs review label |
| HIGH (Security) | Blocked → human-review-required label |

---

**Note**: All bugs include BUG/TODO comments in the code to help the AI identify them.
