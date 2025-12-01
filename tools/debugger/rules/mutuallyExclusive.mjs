// Detects dependency chain issues and missing parent fields
export default function mutuallyExclusive({ config }) {
    const findings = []

    for (const step of config.steps) {
        // REAL PROBLEM: Field has dependency but parent doesn't exist in config
        for (const field of step.fields) {
            if (field.dependency?.parent) {
                const parentName = field.dependency.parent
                const parentExists = step.fields.some(f => f.name === parentName)

                if (!parentExists) {
                    findings.push({
                        severity: 'error',
                        title: `Broken dependency: "${field.name}" depends on non-existent field`,
                        explanation: `Field "${field.name}" declares dependency on parent "${parentName}", but no field named "${parentName}" exists in step "${step.title}". This will cause runtime errors when trying to establish the dependency relationship. The dependent field will never enable.`,
                        jsonPaths: [
                            `steps[id=${step.id}].fields[name=${field.name}].dependency.parent`,
                            `steps[id=${step.id}].fields`
                        ],
                        reproducerState: {},
                        fixGuidance: [
                            `Add the missing parent field "${parentName}" to this step`,
                            `Fix typo: check if parent field has different name (common: "country" vs "countries")`,
                            `Remove dependency if not needed: delete "dependency" property from "${field.name}"`,
                            `Use showIf instead: { "showIf": { "field": "${parentName}", "operator": "equals", "value": "..." } }`
                        ]
                    })
                }
            }

            // REAL PROBLEM: showIf references non-existent field
            if (field.showIf?.field) {
                const parentName = field.showIf.field
                const parentExists = step.fields.some(f => f.name === parentName)

                if (!parentExists) {
                    findings.push({
                        severity: 'error',
                        title: `Broken conditional: "${field.name}" showIf references missing field`,
                        explanation: `Field "${field.name}" has showIf condition checking "${parentName}", but no field named "${parentName}" exists in step "${step.title}". The field will never show because the condition can't be evaluated. This is usually a copy-paste error or typo.`,
                        jsonPaths: [
                            `steps[id=${step.id}].fields[name=${field.name}].showIf.field`,
                            `steps[id=${step.id}].fields`
                        ],
                        reproducerState: {},
                        fixGuidance: [
                            `Add the missing field "${parentName}" earlier in this step`,
                            `Fix field name typo in showIf.field (check exact spelling and casing)`,
                            `Remove showIf if field should always be visible`,
                            `Check if parent field is in different step (cross-step dependencies not supported)`
                        ]
                    })
                }
            }
        }

        // REAL PROBLEM: Duplicate field names in same step
        const fieldNames = step.fields.map(f => f.name)
        const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index)

        if (duplicates.length > 0) {
            const uniqueDuplicates = [...new Set(duplicates)]
            findings.push({
                severity: 'error',
                title: `Duplicate field names in step "${step.title}"`,
                explanation: `Fields with duplicate names found: ${uniqueDuplicates.join(', ')}. Each field must have a unique name within a step. Duplicate names cause: (1) Form state overwrites - only last field's value is saved, (2) Validation errors on wrong field, (3) Conditional logic breaks. This is a critical data corruption issue.`,
                jsonPaths: uniqueDuplicates.map(name => `steps[id=${step.id}].fields[name=${name}]`),
                reproducerState: {},
                fixGuidance: [
                    `Rename duplicate fields to make them unique: e.g., "${uniqueDuplicates[0]}" → "${uniqueDuplicates[0]}Personal", "${uniqueDuplicates[0]}Business"`,
                    `If fields are for different purposes, use descriptive names: "homeAddress" vs "workAddress"`,
                    `Remove duplicate if it was copy-pasted by mistake`,
                    `Use arrays if you need multiple values: change field to type="array" with nested fields`
                ]
            })
        }
    }

    return findings
}