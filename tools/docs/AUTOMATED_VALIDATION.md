# Automated Config Sync & Validation

This project uses **automated validation** to ensure form configs are error-free before deployment.

## 🎯 Single Source of Truth

**TypeScript configs in `src/config/samples/`** are the single source of truth.

- ✅ Edit: `src/config/samples/*.ts`
- ❌ Don't edit: `public/examples/*.json` (auto-generated)

## 🔄 How It Works

```
src/config/samples/*.ts  →  [Sync Tool]  →  public/examples/*.json  →  [Debugger]  →  ✅/❌
     (SOURCE)                                    (AUTO-GENERATED)          (VALIDATE)
```

### Workflow

1. **Developer edits** TypeScript config in `src/config/samples/`
2. **Run sync tool**: `npm run sync-validate`
3. **Tool auto-exports** to JSON in `public/examples/`
4. **Debugger validates** all exported configs
5. **Reports results**: Pass/fail with error details

## 🚀 Usage

### Validate All Configs

```bash
npm run sync-validate
```

This will:
- Export all TypeScript configs to JSON
- Run validation on each config
- Report errors, warnings, and pass/fail status

### Validate Single Config

```bash
npm run validate public/examples/conditional-form.json
```

### Before Commit (Recommended)

```bash
npm run precommit
```

This runs `sync-validate` automatically.

## 📝 Adding New Form Configs

### Step 1: Create TypeScript Config

Create `src/config/samples/myNewForm.ts`:

```typescript
import type { FormConfig } from '@/types/formConfig'

export const myNewForm: FormConfig = {
    id: 'my-new-form-001',
    metadata: {
        title: 'My New Form',
        description: 'Description of the form',
        version: '1.0.0',
        tags: ['new', 'example']
    },
    steps: [
        {
            id: 'step-1',
            title: 'Step 1',
            fields: [
                {
                    name: 'email',
                    label: 'Email',
                    type: 'email',
                    validation: {
                        required: true,
                        email: true
                    }
                }
            ]
        }
    ],
    submitConfig: {
        endpoint: 'https://api.yourcompany.com/submit',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }
}
```

### Step 2: Run Sync & Validate

```bash
npm run sync-validate
```

### Step 3: Fix Any Errors

If validation fails, fix errors in the **TypeScript file** (`src/config/samples/myNewForm.ts`), then run sync-validate again.

### Step 4: Commit

```bash
git add src/config/samples/myNewForm.ts
git commit -m "feat: add myNewForm config"
git push
```

**Note:** `public/examples/my-new-form.json` is auto-generated and git-ignored (in CI/CD).

## 🔍 CI/CD Integration

### GitHub Actions Workflow

The `.github/workflows/spec-debugger.yml` automatically:

1. Syncs TypeScript configs to JSON
2. Validates all configs
3. Comments on PRs with detailed error reports
4. **Blocks merge** if errors are found

### What Gets Checked

✅ Missing required fields (id, metadata, steps)  
✅ Broken dependencies (field references non-existent parent)  
✅ Type mismatches (email validation on text field)  
✅ Placeholder APIs (api.example.com)  
✅ Missing headers (Content-Type for POST/PUT)  
✅ Duplicate field names  
✅ Invalid default values  

## 📚 Detection Rules

Current validation rules in `tools/debugger/rules/`:

1. **requiredHidden** - Conditional required fields with optional parents
2. **mutuallyExclusive** - Broken dependencies, duplicate field names
3. **impossibleCombo** - Type/validation mismatches, invalid patterns
4. **schemaDrift** - API endpoint issues, missing headers
5. **versionBreak** - Missing config structure, empty steps

### Adding New Rules

See `tools/debugger/docs/ADDING_NEW_RULES.md` for a complete guide.

## 🛠️ Troubleshooting

### Export name mismatch

**Error:** `The requested module does not provide an export named 'myForm'`

**Fix:** Ensure export name matches pattern:

```typescript
// ✅ Good - detected automatically
export const conditionalForm: FormConfig = { ... }
export const myNewFormConfig: FormConfig = { ... }

// ❌ Bad - won't be detected
export default { ... }
const myForm = { ... }; export { myForm }
```

### TypeScript errors

**Error:** `Property 'xyz' does not exist on type 'FormConfig'`

**Fix:** Check your TypeScript types in `src/types/formConfig.ts`. The sync tool uses actual TypeScript type checking.

### Validation always fails

**Error:** `Placeholder API endpoint detected`

**Fix:** Replace `api.example.com` with a real endpoint:

```typescript
submitConfig: {
    endpoint: 'https://jsonplaceholder.typicode.com/posts', // Test endpoint
    // or
    endpoint: 'https://api.yourcompany.com/endpoint', // Real endpoint
}
```

## 🎨 Best Practices

### ✅ Do

- Edit TypeScript configs in `src/config/samples/`
- Run `npm run sync-validate` before committing
- Fix errors in TypeScript files (not JSON)
- Use real API endpoints (or test endpoints like jsonplaceholder.typicode.com)
- Add proper validation rules to fields
- Use descriptive field names and IDs

### ❌ Don't

- Edit JSON files in `public/examples/` (auto-generated)
- Commit with validation errors
- Use placeholder APIs in production configs
- Create duplicate field names
- Skip type checking

## 📊 Example Output

```
🔄 Form Config Sync & Validation

📂 Step 1: Discovering TypeScript samples...
   Found 4 sample(s): basicForm, complexForm, conditionalForm, multiStepForm

📝 Step 2: Exporting to JSON...
   ✅ basicForm → basic-form.json
   ✅ complexForm → complex-form.json
   ✅ conditionalForm → conditional-form.json
   ✅ multiStepForm → multi-step-form.json

   Exported 4/4 config(s)

🔍 Step 3: Running validation checks...

   basic-form                ✅ PASS
   complex-form              ⚠️  1 warning(s)
   conditional-form          ❌ 1 error(s), 0 warning(s)
   multi-step-form           ✅ PASS

──────────────────────────────────────────────────────────────────────
📊 VALIDATION SUMMARY
──────────────────────────────────────────────────────────────────────

Configs checked:  4
Passed:          3 ✅
Failed:          1 ❌
Total errors:    1
Total warnings:  1

❌ Validation FAILED - Fix errors in src/config/samples/*.ts
   Run debugger manually: node tools/debugger/cli/run-debugger.mjs public/examples/<config>.json
```

## 🔗 Related Documentation

- [Adding New Validation Rules](../debugger/docs/ADDING_NEW_RULES.md)
- [Form Config TypeScript Types](../../src/types/formConfig.ts)
- [GitHub Actions Workflow](../../.github/workflows/spec-debugger.yml)

## 💡 Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run sync-validate` | Sync all configs and validate |
| `npm run validate <file>` | Validate single JSON file |
| `npm run precommit` | Run before committing |
| `node tools/sync-and-validate-simple.mjs` | Direct invocation |

---

**Remember:** TypeScript configs are the source of truth. JSON files are auto-generated for runtime use.
