# Quick Start: Adding a New Form Config

## TL;DR

```bash
# 1. Create TypeScript config
vim src/config/samples/myNewForm.ts

# 2. Sync and validate
npm run sync-validate

# 3. Fix errors (if any) and repeat step 2

# 4. Commit (only TypeScript file)
git add src/config/samples/myNewForm.ts
git commit -m "feat: add myNewForm config"
git push
```

---

## Step-by-Step Example

### 1. Create TypeScript Config

**File:** `src/config/samples/contactForm.ts`

```typescript
import type { FormConfig } from '@/types/formConfig'

export const contactForm: FormConfig = {
    id: 'contact-form-001',
    metadata: {
        title: 'Contact Us',
        description: 'Get in touch with our team',
        version: '1.0.0',
        tags: ['contact', 'support']
    },
    steps: [
        {
            id: 'contact-info',
            title: 'Contact Information',
            fields: [
                {
                    name: 'name',
                    label: 'Your Name',
                    type: 'text',
                    validation: {
                        required: true,
                        minLength: 2
                    }
                },
                {
                    name: 'email',
                    label: 'Email Address',
                    type: 'email',
                    validation: {
                        required: true,
                        email: true
                    }
                },
                {
                    name: 'message',
                    label: 'Message',
                    type: 'textarea',
                    validation: {
                        required: true,
                        minLength: 10,
                        maxLength: 500
                    }
                }
            ]
        }
    ],
    submitConfig: {
        endpoint: 'https://api.yourcompany.com/contact',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        stateTransitions: {
            onSuccess: {
                action: 'showMessage',
                message: 'Thank you! We will get back to you soon.'
            }
        }
    }
}
```

### 2. Sync and Validate

```bash
npm run sync-validate
```

**Expected Output:**

```
🔄 Form Config Sync & Validation

📂 Step 1: Discovering TypeScript samples...
   Found 5 sample(s): basicForm, complexForm, conditionalForm, contactForm, multiStepForm

📝 Step 2: Exporting to JSON...
   ✅ basicForm → basic-form.json
   ✅ complexForm → complex-form.json
   ✅ conditionalForm → conditional-form.json
   ✅ contactForm → contact-form.json
   ✅ multiStepForm → multi-step-form.json

   Exported 5/5 config(s)

🔍 Step 3: Running validation checks...

   basic-form                ✅ PASS
   complex-form              ⚠️  1 warning(s)
   conditional-form          ✅ PASS
   contact-form              ✅ PASS
   multi-step-form           ✅ PASS

──────────────────────────────────────────────────────────────────────
📊 VALIDATION SUMMARY
──────────────────────────────────────────────────────────────────────

Configs checked:  5
Passed:          5 ✅
Failed:          0 ❌
Total errors:    0
Total warnings:  1

✅ All configs validated successfully!
   JSON files synced to public/examples/
```

### 3. Fix Errors (if any)

If validation fails:

```
   contact-form              ❌ 1 error(s), 0 warning(s)
```

Run manual validation to see details:

```bash
npm run validate public/examples/contact-form.json
```

**Output:**

```
[ERROR] Placeholder API endpoint detected

Reason: submitConfig.endpoint uses "api.example.com" which is a documentation 
placeholder, not a real API...

Fix Guidance:
  1. Replace with your API: "endpoint": "https://your-domain.com/api/endpoint"
  2. For testing, use free APIs: "https://jsonplaceholder.typicode.com/posts"
```

**Fix in TypeScript file:**

```typescript
// src/config/samples/contactForm.ts

submitConfig: {
    endpoint: 'https://jsonplaceholder.typicode.com/posts', // ← Fixed
    method: 'POST',
    // ...
}
```

**Re-run validation:**

```bash
npm run sync-validate
```

### 4. Commit and Push

```bash
# Stage only the TypeScript file
git add src/config/samples/contactForm.ts

# Commit with descriptive message
git commit -m "feat: add contact form config

- Simple 3-field contact form
- Email validation
- Character limits on message field
- Uses test API endpoint"

# Push to trigger CI validation
git push origin your-branch-name
```

### 5. CI Validation (Automatic)

GitHub Actions will:
1. Sync TypeScript to JSON
2. Run validation
3. Comment on PR with results
4. **Block merge if errors found**

---

## Common Patterns

### Simple Form

```typescript
export const simpleForm: FormConfig = {
    id: 'simple-001',
    metadata: { title: 'Simple Form', version: '1.0.0' },
    steps: [{
        id: 'step-1',
        title: 'Step 1',
        fields: [
            { name: 'email', label: 'Email', type: 'email', validation: { required: true, email: true } }
        ]
    }],
    submitConfig: {
        endpoint: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }
}
```

### Multi-Step Form

```typescript
export const wizardForm: FormConfig = {
    id: 'wizard-001',
    metadata: { title: 'Wizard', version: '1.0.0' },
    steps: [
        { id: 'step-1', title: 'Personal', fields: [...] },
        { id: 'step-2', title: 'Contact', fields: [...] },
        { id: 'step-3', title: 'Preferences', fields: [...] }
    ],
    submitConfig: { ... }
}
```

### Conditional Fields

```typescript
fields: [
    {
        name: 'accountType',
        type: 'radio',
        props: { options: [
            { value: 'personal', label: 'Personal' },
            { value: 'business', label: 'Business' }
        ]},
        validation: { required: true }
    },
    {
        name: 'companyName',
        type: 'text',
        showIf: {
            field: 'accountType',
            operator: 'equals',
            value: 'business'
        },
        validation: { required: true }
    }
]
```

### Field Dependencies

```typescript
fields: [
    {
        name: 'country',
        type: 'select',
        props: { options: [...] },
        validation: { required: true }
    },
    {
        name: 'state',
        type: 'select',
        dependency: {
            parent: 'country',
            resetOnChange: true,
            disableUntilParent: true
        },
        props: { options: [...] }
    }
]
```

---

## Troubleshooting

### Error: "does not provide an export named 'xyz'"

**Cause:** Export name mismatch

**Fix:** Ensure `export const` uses `FormConfig` type:

```typescript
// ✅ Correct
export const myForm: FormConfig = { ... }

// ❌ Wrong
export default { ... }
```

### Error: "Broken dependency: field depends on non-existent field"

**Cause:** Dependency parent doesn't exist

**Fix:** Add the parent field or fix the typo:

```typescript
// ✅ Correct
{ name: 'country', ... },
{ name: 'state', dependency: { parent: 'country' }, ... }

// ❌ Wrong
{ name: 'state', dependency: { parent: 'region' }, ... }  // no 'region' field
```

### Error: "Placeholder API endpoint detected"

**Cause:** Using example.com

**Fix:** Use real or test endpoint:

```typescript
// ✅ Test endpoint
endpoint: 'https://jsonplaceholder.typicode.com/posts'

// ✅ Real endpoint
endpoint: 'https://api.yourcompany.com/submit'

// ❌ Placeholder
endpoint: 'https://api.example.com/submit'
```

---

## Cheat Sheet

| Task | Command |
|------|---------|
| Sync & validate all | `npm run sync-validate` |
| Validate single JSON | `npm run validate <file>` |
| Pre-commit check | `npm run precommit` |
| Manual debugger | `node tools/debugger/cli/run-debugger.mjs <file>` |

| File | Purpose |
|------|---------|
| `src/config/samples/*.ts` | ✅ Edit here (source) |
| `public/examples/*.json` | ❌ Auto-generated (don't edit) |
| `tools/sync-and-validate-simple.mjs` | Sync tool |
| `tools/debugger/rules/*.mjs` | Validation rules |

---

**Remember:** Always edit TypeScript files, never JSON files!
