export default function requiredHidden({ config, state }) {
    const findings = []
    for (const step of config.steps) {
        for (const field of step.fields) {
            const isRequired = field.validation?.required === true
            const hidden = state.visibility[field.name] === false
            if (isRequired && hidden) {
                findings.push({
                    severity: 'error',
                    title: 'Required field hidden by conditional visibility',
                    explanation: `Field "${field.name}" is required but hidden due to showIf`,
                    jsonPaths: [
                        `steps[].fields[name=${field.name}]`,
                        `steps[].fields[name=${field.name}].showIf`
                    ],
                    reproducerState: state.values,
                    fixGuidance: [
                        'Relax showIf or remove required on this field',
                        'Ensure required fields are always visible or have defaults'
                    ]
                })
            }
        }
    }
    return findings
}
