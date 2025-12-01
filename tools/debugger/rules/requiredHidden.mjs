// Detects when required conditional fields can't be filled because parent isn't set
export default function requiredHidden({ config }) {
    const findings = []
    
    for (const step of config.steps) {
        for (const field of step.fields) {
            const isRequired = field.validation?.required === true
            const hasShowIf = !!field.showIf
            
            if (isRequired && hasShowIf) {
                const parentField = field.showIf.field
                const parentFieldObj = step.fields.find(f => f.name === parentField)
                const isParentRequired = parentFieldObj?.validation?.required === true
                
                // REAL PROBLEM: Conditional required field but parent isn't required
                if (!isParentRequired) {
                    findings.push({
                        severity: 'error',
                        title: `Required conditional field "${field.name}" depends on optional parent`,
                        explanation: `Field "${field.name}" is required (validation.required=true) but only shows when "${parentField}" equals "${field.showIf.value}". Problem: "${parentField}" is NOT required, so users can skip it, making "${field.name}" impossible to fill. This creates a validation deadlock.`,
                        jsonPaths: [
                            `steps[id=${step.id}].fields[name=${field.name}].validation.required`,
                            `steps[id=${step.id}].fields[name=${field.name}].showIf`,
                            `steps[id=${step.id}].fields[name=${parentField}].validation`
                        ],
                        reproducerState: { [parentField]: null },
                        fixGuidance: [
                            `Make "${parentField}" required: add "validation": { "required": true } to ensure users must select it`,
                            `Remove required from "${field.name}": it should be optional since it's conditional`,
                            `Add default value to "${parentField}" so the condition is always evaluable`,
                            `Consider using field groups: if ${parentField}="${field.showIf.value}", then ALL business fields become required as a group`
                        ]
                    })
                }
            }
        }
    }
    
    return findings
}