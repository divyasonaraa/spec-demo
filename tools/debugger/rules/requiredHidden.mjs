export default function requiredHidden({ config, state }) {
    const findings = []
    for (const step of config.steps) {
        for (const field of step.fields) {
            const isRequired = field.validation?.required === true
            const hidden = state.visibility[field.name] === false
            if (isRequired && hidden) {
                const showIf = field.showIf
                const condStr = showIf ? `${showIf.field} ${showIf.operator} ${JSON.stringify(showIf.value)}` : 'unknown'
                const causeField = showIf?.field
                const causeValue = state.values[causeField]

                findings.push({
                    severity: 'error',
                    title: 'Required field hidden by conditional visibility',
                    explanation: `Field "${field.name}" is marked as required (validation.required=true) but is hidden because the condition "${condStr}" evaluates to true. When field "${causeField}" has value ${JSON.stringify(causeValue)}, this required field becomes inaccessible, making form submission impossible.`,
                    jsonPaths: [
                        `steps[].fields[name=${field.name}].validation.required`,
                        `steps[].fields[name=${field.name}].showIf`
                    ],
                    reproducerState: state.values,
                    fixGuidance: [
                        `Remove 'required: true' from field "${field.name}" if it should be conditionally optional`,
                        `Change showIf condition to invert logic: { "field": "${causeField}", "operator": "${showIf?.operator === 'equals' ? 'notEquals' : 'notIn'}", "value": ${JSON.stringify(showIf?.value)} }`,
                        `Add a default value to "${field.name}" so it's valid even when hidden`,
                        `Make "${causeField}" a required field that's always visible to prevent this hiding condition`
                    ]
                })
            }
        }
    }
    return findings
}
