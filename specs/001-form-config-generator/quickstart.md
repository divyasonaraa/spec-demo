# Quickstart Guide: Dynamic Form Config Generator

**Feature**: 001-form-config-generator  
**Date**: 2025-12-01  
**Purpose**: Setup instructions and manual verification scenarios for demo application

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm 9+
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Git (for cloning repository)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd dynamic-form-genrator

# Checkout feature branch
git checkout 001-form-config-generator

# Install dependencies
npm install

# Start development server
npm run dev

# Application will be available at http://localhost:5173
```

### Project Scripts

- `npm run dev` - Start Vite dev server with hot reload
- `npm run build` - Build production bundle
- `npm run preview` - Preview production build locally

## Demo Application Structure

The demo page (`/demo`) provides:

1. **Config Editor** - Textarea to paste/edit form config JSON
2. **Config Validator** - Real-time validation with error messages
3. **Form Renderer** - Live form preview from config
4. **Payload Preview** - Button to view submission payload
5. **Sample Configs** - Pre-loaded examples (basic, multi-step, conditional)

## Manual Verification Scenarios

### Scenario 1: Basic Form Rendering (User Story 1 - Core MVP)

**Objective**: Verify single-step form renders correctly with various field types

**Steps**:
1. Navigate to `/demo`
2. Select "Basic Form" from sample configs dropdown
3. Click "Load Sample"
4. Observe form renders with fields: text, email, number, select, checkbox, textarea

**Expected Results**:
- ✅ All 6 field types render with correct HTML input types
- ✅ Labels display above each field
- ✅ Placeholder text visible in empty fields
- ✅ Help text appears below fields (if defined in config)
- ✅ Required fields show red asterisk (*) next to label

**Verification Checklist**:
- [ ] Text input accepts keyboard input
- [ ] Email input shows native browser validation icon
- [ ] Number input accepts only numeric values with up/down arrows
- [ ] Select dropdown shows all options when clicked
- [ ] Checkbox can be toggled on/off
- [ ] Textarea expands as user types multiple lines

---

### Scenario 2: Validation - Required Fields (User Story 1)

**Objective**: Verify inline validation for required fields

**Steps**:
1. Load "Basic Form" sample
2. Leave all required fields empty
3. Click in first required field, then click outside (blur)
4. Observe validation error appears
5. Fill the field with valid data
6. Observe error disappears

**Expected Results**:
- ✅ Error message appears below field immediately on blur
- ✅ Error message matches `requiredMessage` from config
- ✅ Field border turns red when error present
- ✅ Error disappears when valid data entered
- ✅ Submit button remains disabled while errors exist

**Verification Checklist**:
- [ ] Required text fields show "This field is required" on blur when empty
- [ ] Required email fields validate email format
- [ ] Required number fields reject non-numeric input
- [ ] Error messages are visually distinct (red text, icon)
- [ ] Multiple errors can appear simultaneously on different fields

---

### Scenario 3: Form Submission & Payload Display (User Story 1)

**Objective**: Verify form submission and payload preview functionality

**Steps**:
1. Load "Basic Form" sample
2. Fill all required fields with valid data
3. Click "Preview Payload" button
4. Observe modal opens showing JSON payload
5. Click "Copy to Clipboard" button
6. Close modal and click "Submit" button
7. Observe loading state, then success message

**Expected Results**:
- ✅ Payload modal displays formatted JSON with syntax highlighting
- ✅ JSON structure matches field names from config
- ✅ Values have correct types (strings, numbers, booleans)
- ✅ Copy to clipboard shows success notification
- ✅ Submit button shows loading spinner during submission
- ✅ Success message appears after submission completes

**Verification Checklist**:
- [ ] JSON in modal is properly indented and readable
- [ ] Number fields produce numeric values (not strings)
- [ ] Checkbox fields produce boolean values (not strings)
- [ ] Empty optional fields are omitted from payload (not null)
- [ ] Nested structure appears if `submitField` uses dot notation

---

### Scenario 4: Multi-Step Navigation (User Story 2)

**Objective**: Verify multi-step form navigation and progress indicator

**Steps**:
1. Load "Multi-Step Form" sample (3 steps)
2. Observe only Step 1 fields visible
3. Fill Step 1 required fields
4. Click "Next" button
5. Observe Step 2 appears, Step 1 hidden
6. Click "Previous" button
7. Observe Step 1 reappears with values preserved
8. Navigate to Step 3 (final step)
9. Observe "Submit" button instead of "Next"

**Expected Results**:
- ✅ Step indicator shows "Step 1 of 3", "Step 2 of 3", etc.
- ✅ Current step highlighted in progress indicator
- ✅ Previous button disabled on Step 1
- ✅ Next button disabled if current step has validation errors
- ✅ Field values preserved when navigating backward/forward
- ✅ Submit button only appears on final step

**Verification Checklist**:
- [ ] Step transitions are smooth (300ms animation)
- [ ] Cannot proceed to next step with invalid data
- [ ] Progress dots show completed (green), current (blue), upcoming (gray)
- [ ] Mobile layout stacks steps vertically
- [ ] Keyboard users can tab through fields in current step only

---

### Scenario 5: Step Validation Blocking (User Story 2)

**Objective**: Verify users cannot proceed past step with validation errors

**Steps**:
1. Load "Multi-Step Form" sample
2. On Step 1, leave a required field empty
3. Fill other fields correctly
4. Click "Next" button
5. Observe error message appears on empty field
6. Observe step does not change (remains on Step 1)
7. Fill the empty field
8. Click "Next" again
9. Observe Step 2 appears

**Expected Results**:
- ✅ Next button triggers validation for all fields in current step
- ✅ Validation errors appear on invalid fields
- ✅ Step transition blocked until all errors resolved
- ✅ Visual feedback (shake animation) when Next clicked with errors
- ✅ Screen reader announces validation errors (ARIA live region)

**Verification Checklist**:
- [ ] All step fields validated simultaneously on Next click
- [ ] Focus moves to first error field
- [ ] Error count displayed (e.g., "2 errors on this step")
- [ ] User cannot bypass validation by editing URL or using browser navigation

---

### Scenario 6: Conditional Field Visibility (User Story 3)

**Objective**: Verify fields show/hide based on other field values

**Steps**:
1. Load "Conditional Form" sample
2. Observe "Country" select field
3. Select "USA" from dropdown
4. Observe "State" field appears below Country
5. Change Country to "Canada"
6. Observe "State" field disappears
7. Observe "Province" field appears instead
8. Change back to "USA"
9. Observe "State" reappears with value cleared

**Expected Results**:
- ✅ Conditional field hidden initially if condition not met
- ✅ Field appears smoothly (300ms fade-in) when condition becomes true
- ✅ Field disappears smoothly when condition becomes false
- ✅ Field value cleared when hidden
- ✅ Cleared values not included in submission payload

**Verification Checklist**:
- [ ] Multiple conditional fields can exist in same form
- [ ] Nested conditions work (Field C depends on B, B depends on A)
- [ ] No jarring layout shifts when fields appear/disappear
- [ ] Screen readers announce field appearance/removal
- [ ] Mobile layout adjusts smoothly without scrolling issues

---

### Scenario 7: Field Dependencies & Data Sources (User Story 3)

**Objective**: Verify dependent fields reload options when parent changes

**Steps**:
1. Load "Conditional Form" sample
2. Observe "State" field is disabled (grayed out)
3. Select "USA" in "Country" field
4. Observe "State" field enables and shows loading spinner
5. Wait for options to load
6. Observe "State" dropdown populated with US states
7. Select a state (e.g., "California")
8. Change "Country" to "Canada"
9. Observe "State" selection cleared and field disabled again

**Expected Results**:
- ✅ Dependent field disabled until parent has value
- ✅ Loading indicator shown during API fetch
- ✅ Options populate correctly from API response
- ✅ Parent value change triggers child field reload
- ✅ Child value cleared on parent change (if resetOnChange: true)

**Verification Checklist**:
- [ ] Loading spinner visible during fetch (no silent waiting)
- [ ] Error message shown if API call fails
- [ ] Retry button appears on error
- [ ] Options cached to avoid redundant API calls
- [ ] Race conditions handled (rapid parent changes don't break state)

---

### Scenario 8: Responsive Design - Mobile (Principle III)

**Objective**: Verify form works on mobile devices (320px width)

**Steps**:
1. Open browser DevTools
2. Enable device emulation (iPhone SE, 375×667)
3. Navigate to `/demo`
4. Load any sample form
5. Interact with form fields (tap, type, scroll)
6. Test multi-step navigation
7. Submit form and view payload

**Expected Results**:
- ✅ All content visible without horizontal scroll
- ✅ Touch targets minimum 44×44px (buttons, checkboxes, radio)
- ✅ Text readable without zooming (16px base font)
- ✅ Form fields full-width on mobile
- ✅ Step indicator adapts to narrow screen
- ✅ Modal dialogs sized appropriately for mobile

**Verification Checklist**:
- [ ] Tested on 320px width (smallest supported)
- [ ] Tested on 768px tablet width
- [ ] Portrait and landscape orientations work
- [ ] Native iOS/Android keyboard appears for input types
- [ ] No text overlapping or cut-off
- [ ] Smooth 60fps scrolling

---

### Scenario 9: Keyboard Navigation (Accessibility)

**Objective**: Verify full keyboard accessibility without mouse

**Steps**:
1. Load any sample form
2. Press Tab key repeatedly
3. Observe focus moves through form fields in logical order
4. Fill fields using only keyboard (type, arrows, space, enter)
5. Navigate steps using Tab + Enter on buttons
6. Submit form using Enter key
7. Close modal using Escape key

**Expected Results**:
- ✅ Tab order follows visual layout (top to bottom, left to right)
- ✅ Focus visible indicator on all interactive elements
- ✅ Enter key submits form when focus on input field
- ✅ Space/Enter toggles checkboxes and radio buttons
- ✅ Arrow keys navigate select dropdowns
- ✅ Escape closes modals and cancels actions
- ✅ Skip to content link at top for screen readers

**Verification Checklist**:
- [ ] No keyboard traps (can always tab out)
- [ ] Focus never hidden or off-screen
- [ ] Focus indicator contrast meets WCAG AA (3:1)
- [ ] Shift+Tab moves focus backward
- [ ] Screen reader announces field labels and errors

---

### Scenario 10: Dark Mode Support (Responsive Design)

**Objective**: Verify form respects system dark mode preference

**Steps**:
1. Enable dark mode in OS settings
2. Reload application
3. Observe form renders with dark theme
4. Check color contrast (text on background)
5. Toggle dark mode off
6. Observe form switches to light theme

**Expected Results**:
- ✅ Background color changes to dark (no white flash)
- ✅ Text color inverted for readability
- ✅ Input fields have appropriate dark styling
- ✅ Color contrast meets WCAG AA (4.5:1 for text)
- ✅ All colors remain distinguishable in dark mode

**Verification Checklist**:
- [ ] No pure white (#fff) or pure black (#000) used
- [ ] Borders and dividers visible in both modes
- [ ] Error messages readable in dark mode (not pure red)
- [ ] Focus indicators visible in both modes
- [ ] Images/icons adapt to theme (if any)

---

### Scenario 11: Config Validation - Errors (User Story 4)

**Objective**: Verify invalid configs are caught with helpful error messages

**Steps**:
1. Navigate to `/demo`
2. In config editor, create invalid JSON (missing quote)
3. Click "Validate Config" button
4. Observe parse error message with line number
5. Fix JSON, but use invalid field type (`type: "invalid"`)
6. Click "Validate Config"
7. Observe error: "Unsupported field type 'invalid' in field 'X'"

**Expected Results**:
- ✅ JSON parse errors show line number and syntax issue
- ✅ Invalid field types list supported types
- ✅ Missing required properties identified by name
- ✅ Circular dependencies detected and explained
- ✅ Errors displayed in red with error icon

**Verification Checklist**:
- [ ] Multiple errors shown simultaneously
- [ ] Errors grouped by type (parse, validation, logic)
- [ ] Click error to jump to line in editor (if possible)
- [ ] Validation runs automatically after 1s of no typing
- [ ] Success message shows green checkmark when valid

---

### Scenario 12: Sample Configs & Documentation (User Story 4)

**Objective**: Verify documentation examples are comprehensive and accurate

**Steps**:
1. Navigate to `/demo`
2. Click "Documentation" link
3. Browse field type examples
4. Copy a sample config snippet
5. Paste into config editor
6. Observe form renders correctly
7. Review validation rules examples
8. Test a rule in the form

**Expected Results**:
- ✅ All supported field types documented with examples
- ✅ Validation rules table shows all available rules
- ✅ Conditional logic examples cover common scenarios
- ✅ Multi-step form example includes 3+ steps
- ✅ All examples are copy-paste ready (valid JSON)
- ✅ Examples include comments explaining each property

**Verification Checklist**:
- [ ] Search functionality works (find field types)
- [ ] Examples organized by complexity (basic → advanced)
- [ ] Mobile-friendly documentation layout
- [ ] Code snippets have syntax highlighting
- [ ] Download sample configs as files

---

### Scenario 13: Performance - Large Forms

**Objective**: Verify form performs well with 50+ fields

**Steps**:
1. Load a config with 50 fields across 5 steps
2. Observe initial render time (should be <500ms)
3. Navigate between steps
4. Observe step transitions are smooth (60fps)
5. Type in various fields
6. Observe no input lag (<100ms response)
7. Open DevTools Performance tab
8. Record interaction and check FPS

**Expected Results**:
- ✅ Initial render <500ms on mid-range device
- ✅ Step transitions maintain 60fps
- ✅ No input lag or janky scrolling
- ✅ Bundle size <200KB gzipped
- ✅ Time to Interactive (TTI) <3 seconds

**Verification Checklist**:
- [ ] Tested on throttled CPU (4x slowdown in DevTools)
- [ ] Tested on slow 3G network (Network tab)
- [ ] No memory leaks after 5 minutes of interaction
- [ ] Lighthouse Performance score >90
- [ ] No console errors or warnings

---

### Scenario 14: Error Handling - API Failures

**Objective**: Verify graceful error handling for failed API calls

**Steps**:
1. Load form with dataSource field (requires API call)
2. Open DevTools Network tab
3. Enable "Offline" mode
4. Trigger API call (select parent field value)
5. Observe error message appears
6. Observe "Retry" button shown
7. Disable offline mode
8. Click "Retry"
9. Observe options load successfully

**Expected Results**:
- ✅ Error message explains what failed ("Failed to load states")
- ✅ Retry button allows user to re-attempt
- ✅ Loading states clear after error
- ✅ Form remains usable (other fields not affected)
- ✅ Screen reader announces error (ARIA live region)

**Verification Checklist**:
- [ ] 404 errors show "Not found" message
- [ ] 500 errors show "Server error" message
- [ ] Timeout errors show "Request timed out"
- [ ] Network errors show "Connection failed"
- [ ] Error details available in console for debugging

---

### Scenario 15: Submission Success & State Transitions

**Objective**: Verify post-submission state transitions work correctly

**Steps**:
1. Load form with `submitConfig.stateTransitions.onSuccess`
2. Fill form completely
3. Click Submit
4. Observe loading spinner on button
5. Wait for API response (success)
6. Observe success message appears
7. After delay, observe action executes (navigate, next step, etc.)
8. Verify form state cleared (if configured)

**Expected Results**:
- ✅ Submit button shows loading state during API call
- ✅ Success message matches `onSuccess.message` from config
- ✅ Delay respected before action executes
- ✅ Navigation works (if action: 'navigate')
- ✅ Form cleared after successful submission (if configured)

**Verification Checklist**:
- [ ] Multiple state transitions can chain (message → navigate)
- [ ] Error transitions work (onError shows error message)
- [ ] Loading state prevents duplicate submissions
- [ ] Success animation (checkmark icon, green background)
- [ ] Form disabled during submission (no editing mid-flight)

---

## Performance Benchmarks

Run these tests to validate performance requirements:

```bash
# Lighthouse CI (run 3 times, average scores)
npm run build
npm run preview
lighthouse http://localhost:4173/demo --view

# Bundle size analysis
npm run build
npx vite-bundle-visualizer

# Expected Results:
# - Performance: >90
# - Accessibility: 100
# - Best Practices: >90
# - Total bundle size: <200KB gzipped
```

## Browser Compatibility Matrix

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome | 90+ | ✅ Supported | Primary development browser |
| Firefox | 88+ | ✅ Supported | Test multi-step animations |
| Safari | 14+ | ✅ Supported | Test iOS keyboard behavior |
| Edge | 90+ | ✅ Supported | Test Windows high contrast mode |
| Mobile Safari | iOS 14+ | ✅ Supported | Test touch interactions |
| Chrome Android | 90+ | ✅ Supported | Test mobile performance |

---

## Troubleshooting

### Form not rendering
- Check browser console for errors
- Verify config is valid JSON
- Ensure all required properties present in config

### Validation not working
- Check Zod is installed (`npm list zod`)
- Verify validation rules in config match supported types
- Check console for validation schema build errors

### API calls failing
- Check Network tab for request details
- Verify endpoint URLs are correct
- Check CORS configuration if calling external APIs
- Ensure token resolution working (check resolved values in console)

### Performance issues
- Run Lighthouse audit to identify bottlenecks
- Check for memory leaks in DevTools Memory profiler
- Verify virtual scrolling enabled for large option lists
- Reduce bundle size (run `npx vite-bundle-visualizer`)

---

## Next Steps

After completing all 15 manual verification scenarios:

1. **Document any bugs found** in GitHub issues
2. **Run /speckit.tasks** to generate implementation task list
3. **Begin implementation** with User Story 1 (P1 MVP)
4. **Iterate and verify** each task manually as implemented
5. **Deploy demo** to staging environment for stakeholder review

**Ready for**: Task generation and implementation phase
