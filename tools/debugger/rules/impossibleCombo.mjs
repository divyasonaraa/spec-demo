// Detects validation rules that don't match field types and impossible patterns
export default function impossibleCombo({ config }) {
    const findings = []
    
    for (const step of config.steps) {
        for (const field of step.fields) {
            // REAL PROBLEM: Email validation on non-email field type
            if (field.validation?.email && field.type !== 'email') {
                findings.push({
                    severity: 'warning',
                    title: `Field "${field.name}" has email validation but type is "${field.type}"`,
                    explanation: `Field "${field.name}" has validation.email=true but type="${field.type}". This mismatch means: (1) Browser won't show email keyboard on mobile, (2) Autocomplete won't suggest emails, (3) Pattern validation may conflict. Best practice is to match field type with validation rules.`,
                    jsonPaths: [
                        `steps[id=${step.id}].fields[name=${field.name}].type`,
                        `steps[id=${step.id}].fields[name=${field.name}].validation.email`
                    ],
                    reproducerState: {},
                    fixGuidance: [
                        `Change field type to "email": "type": "email" for proper mobile keyboard and validation`,
                        `If type must be "text", remove email validation and use pattern: "^[^@]+@[^@]+\\.[^@]+$"`,
                        `Add placeholder to guide users: "placeholder": "you@example.com"`
                    ]
                })
            }
            
            // REAL PROBLEM: Pattern validation conflicts with field constraints
            if (field.validation?.pattern && (field.validation?.minLength || field.validation?.maxLength)) {
                const pattern = field.validation.pattern
                const minLen = field.validation.minLength
                const maxLen = field.validation.maxLength
                
                findings.push({
                    severity: 'info',
                    title: `Field "${field.name}" has both pattern and length constraints`,
                    explanation: `Field "${field.name}" has pattern="${pattern}" AND min/max length rules. This can confuse users because: (1) Pattern might allow shorter/longer than length constraints, (2) Error messages conflict ("format invalid" vs "too short"), (3) Users don't know which rule they violated. Simplify to just pattern OR just length.`,
                    jsonPaths: [
                        `steps[id=${step.id}].fields[name=${field.name}].validation.pattern`,
                        `steps[id=${step.id}].fields[name=${field.name}].validation.minLength`,
                        `steps[id=${step.id}].fields[name=${field.name}].validation.maxLength`
                    ],
                    reproducerState: {},
                    fixGuidance: [
                        `Remove minLength/maxLength and encode length in pattern: "^.{${minLen},${maxLen}}$"`,
                        `Keep only pattern if format is strict (e.g., phone: "^\\+?[0-9]{10,15}$" includes length)`,
                        `Add clear error message explaining exact format: "patternMessage": "Format: +1 555-123-4567 (11-15 digits)"`
                    ]
                })
            }
            
            // REAL PROBLEM: Number field with string pattern validation
            if (field.type === 'number' && field.validation?.pattern) {
                findings.push({
                    severity: 'warning',
                    title: `Number field "${field.name}" has pattern validation`,
                    explanation: `Field "${field.name}" has type="number" but validation.pattern="${field.validation.pattern}". Pattern validation only works on strings. For number fields, use min/max/step instead. Current pattern will be ignored by browsers.`,
                    jsonPaths: [
                        `steps[id=${step.id}].fields[name=${field.name}].type`,
                        `steps[id=${step.id}].fields[name=${field.name}].validation.pattern`
                    ],
                    reproducerState: {},
                    fixGuidance: [
                        `Remove pattern and use min/max: { "min": 0, "max": 999, "step": 1 }`,
                        `If you need pattern (e.g., "must be 3 digits"), change type to "text" or "tel"`,
                        `For formatted numbers (e.g., phone), use type="tel" with pattern instead of type="number"`
                    ]
                })
            }
            
            // REAL PROBLEM: Required field with empty default value
            if (field.validation?.required && field.defaultValue === '') {
                findings.push({
                    severity: 'warning',
                    title: `Required field "${field.name}" has empty string as default`,
                    explanation: `Field "${field.name}" is required but defaultValue="" (empty string). This creates confusion: field appears filled but fails required validation. Users see error on page load before interacting. Either remove defaultValue or set it to null/undefined.`,
                    jsonPaths: [
                        `steps[id=${step.id}].fields[name=${field.name}].validation.required`,
                        `steps[id=${step.id}].fields[name=${field.name}].defaultValue`
                    ],
                    reproducerState: { [field.name]: '' },
                    fixGuidance: [
                        `Remove defaultValue property entirely (undefined is better than empty string)`,
                        `Set to null: "defaultValue": null`,
                        `Or provide a real default: "defaultValue": "Please select..." (for select fields)`,
                        `Remove required flag if empty should be valid: delete "required": true`
                    ]
                })
            }
        }
    }
    
    return findings
}