# Adding New Detection Rules

This guide explains how to create new validation rules for the form config debugger.

## Quick Start

1. **Create rule file**: `tools/debugger/rules/yourRuleName.mjs`
2. **Implement detection logic**: Export `detect(context)` function
3. **Update engine**: Add rule to `tools/debugger/engine/index.mjs`
4. **Test**: Run debugger on test configs
5. **Document**: Update README with new bug class

---

## Rule Structure

Every rule must export a `detect` function that receives a context object and returns an array of findings.

### Template

```javascript
// tools/debugger/rules/yourRuleName.mjs

/**
 * Rule: Your Rule Name
 * Detects: Brief description of what this rule catches
 * Severity: error | warning | info
 */
export function detect(context) {
  const { config } = context;
  const findings = [];

  // Your detection logic here
  // Analyze config structure, relationships, patterns
  
  if (issueDetected) {
    findings.push({
      severity: 'error', // or 'warning' or 'info'
      title: 'Short descriptive title',
      explanation: 'Detailed explanation of the problem and why it matters',
      jsonPaths: ['path.to.field', 'another.path'],
      reproducerState: {}, // Optional: state that triggers the issue
      fixGuidance: [
        'Step 1: Specific actionable fix',
        'Step 2: Alternative approach',
        'Step 3: Best practice recommendation'
      ]
    });
  }

  return findings;
}
```

---

## Detection Patterns

### Pattern 1: Structural Validation
Check for missing or malformed config properties.

```javascript
export function detect(context) {
  const { config } = context;
  const findings = [];

  // Check required top-level properties
  if (!config.id) {
    findings.push({
      severity: 'error',
      title: 'Missing config ID',
      explanation: 'Every form config must have a unique "id" field...',
      jsonPaths: ['id'],
      reproducerState: {},
      fixGuidance: [
        'Add unique id: "id": "my-form-001"',
        'Use naming convention: "{purpose}-{type}-{version}"'
      ]
    });
  }

  return findings;
}
```

### Pattern 2: Type Mismatch Detection
Find incompatible field type and validation combinations.

```javascript
export function detect(context) {
  const { config } = context;
  const findings = [];

  config.steps?.forEach((step, stepIdx) => {
    step.fields?.forEach((field, fieldIdx) => {
      // Email validation on non-email type
      if (field.type !== 'email' && field.validation?.email) {
        findings.push({
          severity: 'error',
          title: 'Email validation on non-email field',
          explanation: 'Field has email validation but type is not "email"...',
          jsonPaths: [
            `steps[${stepIdx}].fields[${fieldIdx}].type`,
            `steps[${stepIdx}].fields[${fieldIdx}].validation.email`
          ],
          reproducerState: {},
          fixGuidance: [
            'Change type to "email": "type": "email"',
            'Or remove email validation if not needed'
          ]
        });
      }
    });
  });

  return findings;
}
```

### Pattern 3: Dependency Validation
Check for broken relationships between fields.

```javascript
export function detect(context) {
  const { config } = context;
  const findings = [];

  config.steps?.forEach((step, stepIdx) => {
    // Build map of available fields
    const fieldNames = new Set(
      step.fields?.map(f => f.name) || []
    );

    step.fields?.forEach((field, fieldIdx) => {
      // Check if dependency parent exists
      if (field.dependency?.parent) {
        const parent = field.dependency.parent;
        if (!fieldNames.has(parent)) {
          findings.push({
            severity: 'error',
            title: 'Broken dependency chain',
            explanation: `Field "${field.name}" depends on "${parent}" but that field doesn't exist...`,
            jsonPaths: [`steps[${stepIdx}].fields[${fieldIdx}].dependency.parent`],
            reproducerState: {},
            fixGuidance: [
              `Add missing field "${parent}" to this step`,
              'Fix typo in parent field name',
              'Remove broken dependency if not needed'
            ]
          });
        }
      }
    });
  });

  return findings;
}
```

### Pattern 4: API Configuration
Validate external service configurations.

```javascript
export function detect(context) {
  const { config } = context;
  const findings = [];

  const endpoint = config.submitConfig?.endpoint;

  // Check for placeholder URLs
  if (endpoint?.includes('example.com')) {
    findings.push({
      severity: 'error',
      title: 'Placeholder API endpoint detected',
      explanation: 'submitConfig.endpoint uses "api.example.com" which is a placeholder...',
      jsonPaths: ['submitConfig.endpoint'],
      reproducerState: {},
      fixGuidance: [
        'Replace with your API: "endpoint": "https://your-domain.com/api/endpoint"',
        'For testing, use: "https://jsonplaceholder.typicode.com/posts"',
        'Add environment variable: process.env.VITE_API_ENDPOINT'
      ]
    });
  }

  return findings;
}
```

---

## Severity Guidelines

### ERROR (Blocking)
- **Broken functionality**: Form won't work without fixing
- **Data loss risk**: Could corrupt or lose user data
- **Security issues**: Exposes sensitive information
- **Invalid configuration**: Violates schema requirements

**Examples:**
- Missing required properties (id, metadata)
- Broken dependencies (field references non-existent parent)
- Type mismatches (number field with string pattern)
- Placeholder API endpoints

### WARNING (Should Fix)
- **Degraded UX**: Works but poor user experience
- **Performance issues**: Could slow down form rendering
- **Maintainability**: Hard to debug or extend later
- **Edge cases**: Works in most cases but fails in specific scenarios

**Examples:**
- Missing error messages (uses generic defaults)
- Inefficient validation patterns
- Ambiguous field labels
- Missing accessibility attributes

### INFO (Optional)
- **Best practices**: Suggestions for improvement
- **Enhancement ideas**: Optional features to consider
- **Documentation**: Helpful context or tips
- **Optimization**: Works fine but could be better

**Examples:**
- Missing success handlers (still submits, just no feedback)
- Could add help text for clarity
- Consider adding autocomplete attributes
- Optional: Enable form analytics

---

## Real-World Examples

### Example 1: Duplicate Field Names

```javascript
// tools/debugger/rules/duplicateFields.mjs

export function detect(context) {
  const { config } = context;
  const findings = [];

  config.steps?.forEach((step, stepIdx) => {
    const nameCount = {};
    
    step.fields?.forEach((field, fieldIdx) => {
      const name = field.name;
      nameCount[name] = (nameCount[name] || 0) + 1;
      
      if (nameCount[name] === 2) {
        findings.push({
          severity: 'error',
          title: 'Duplicate field names in same step',
          explanation: `Multiple fields named "${name}" in step "${step.id}". Last field wins, causing data loss.`,
          jsonPaths: [`steps[${stepIdx}].fields`],
          reproducerState: {},
          fixGuidance: [
            `Rename one field to "${name}2" or "${name}_alt"`,
            'Use unique names: "shippingAddress" vs "billingAddress"',
            'Move duplicate to different step if needed'
          ]
        });
      }
    });
  });

  return findings;
}
```

### Example 2: Required Field with Empty Default

```javascript
// tools/debugger/rules/invalidDefaults.mjs

export function detect(context) {
  const { config } = context;
  const findings = [];

  config.steps?.forEach((step, stepIdx) => {
    step.fields?.forEach((field, fieldIdx) => {
      const isRequired = field.validation?.required;
      const hasEmptyDefault = 
        field.defaultValue !== undefined && 
        (field.defaultValue === '' || field.defaultValue === null);

      if (isRequired && hasEmptyDefault) {
        findings.push({
          severity: 'error',
          title: 'Required field with empty default value',
          explanation: `Field "${field.name}" is required but has empty default. Form starts in invalid state.`,
          jsonPaths: [
            `steps[${stepIdx}].fields[${fieldIdx}].validation.required`,
            `steps[${stepIdx}].fields[${fieldIdx}].defaultValue`
          ],
          reproducerState: {},
          fixGuidance: [
            'Remove defaultValue (let user fill it)',
            'Set valid default: "defaultValue": "valid-option"',
            'Make field optional if empty default is intentional'
          ]
        });
      }
    });
  });

  return findings;
}
```

---

## Integration Steps

### 1. Add Rule to Engine

Edit `tools/debugger/engine/index.mjs`:

```javascript
// Import your new rule
import { detect as detectYourRule } from '../rules/yourRuleName.mjs';

// Add to rules array
const rules = [
  { name: 'requiredHidden', fn: detectRequiredHidden },
  { name: 'mutuallyExclusive', fn: detectMutuallyExclusive },
  { name: 'impossibleCombo', fn: detectImpossibleCombo },
  { name: 'schemaDrift', fn: detectSchemaDrift },
  { name: 'versionBreak', fn: detectVersionBreak },
  { name: 'yourRuleName', fn: detectYourRule }, // <-- Add here
];
```

### 2. Test Your Rule

Create test config that triggers your rule:

```bash
# Create test config
cat > public/examples/test-your-rule.json << 'EOF'
{
  "id": "test-config",
  "metadata": { ... },
  "steps": [ ... ] // Config that triggers your rule
}
EOF

# Run debugger
node tools/debugger/cli/run-debugger.mjs public/examples/test-your-rule.json

# Should show your error
```

### 3. Update Documentation

Edit `specs/001-bug-debugger-workflow/README.md`:

```markdown
### Bug Classes Detected

1. **requiredHidden**: Required fields hidden by conditional visibility
2. **mutuallyExclusive**: Mutually exclusive conditions active together
3. **yourRuleName**: Brief description of your new rule <-- Add here
```

---

## Testing Checklist

- [ ] Rule detects the target issue correctly
- [ ] Severity level is appropriate (error/warning/info)
- [ ] Title is clear and concise (< 60 chars)
- [ ] Explanation describes why it's a problem
- [ ] JSON paths pinpoint exact location
- [ ] Fix guidance is actionable (numbered steps)
- [ ] Handles missing/null fields gracefully
- [ ] Doesn't produce false positives
- [ ] Performance is acceptable (< 10ms per config)
- [ ] Works with real-world configs (not just test cases)

---

## Common Pitfalls

### ❌ Don't: Use vague titles
```javascript
title: 'Validation issue' // Too generic
```

### ✅ Do: Be specific
```javascript
title: 'Email validation on text field type'
```

---

### ❌ Don't: Generic explanations
```javascript
explanation: 'This is wrong and needs to be fixed'
```

### ✅ Do: Explain impact
```javascript
explanation: 'Field has email validation but type is "text". Mobile devices won\'t show email keyboard, forcing users to manually switch keyboards.'
```

---

### ❌ Don't: Vague fixes
```javascript
fixGuidance: ['Fix the field', 'Update config']
```

### ✅ Do: Provide exact steps
```javascript
fixGuidance: [
  'Change field type: "type": "email"',
  'Or remove email validation if plain text is intended'
]
```

---

## Getting Help

- **Check existing rules**: `tools/debugger/rules/*.mjs` for patterns
- **Review engine**: `tools/debugger/engine/index.mjs` for integration
- **Test locally**: Run debugger on your configs before pushing
- **CI feedback**: GitHub Actions will show issues in PRs

---

## Rule Naming Conventions

- **camelCase**: File and function names
- **Descriptive**: Name should explain what it detects
- **Single responsibility**: One rule = one type of issue

**Good names:**
- `duplicateFields.mjs` - checks for duplicate field names
- `missingLabels.mjs` - finds fields without labels
- `brokenDependencies.mjs` - validates dependency chains

**Bad names:**
- `validator.mjs` - too generic
- `check.mjs` - doesn't describe what it checks
- `allRules.mjs` - violates single responsibility

---

## Next Steps

1. **Create your rule file** using the template
2. **Test locally** against real configs
3. **Add to engine** and verify integration
4. **Update docs** with new bug class
5. **Push and verify** CI catches your issues
6. **Iterate** based on false positives/negatives
