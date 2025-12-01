export default function mutuallyExclusive({ config, state }) {
    const findings = []

    // Analyze all conditional fields for conflicts
    const conditionalFields = []
    for (const step of config.steps) {
        for (const field of step.fields) {
            if (field.showIf) {
                conditionalFields.push({ name: field.name, showIf: field.showIf, step: step.title })
            }
        }
    }

    // Check for semantic mutual exclusion (subscribe/unsubscribe pattern)
    const s = state.values.subscribe
    const u = state.values.unsubscribe
    if (s === true && u === true) {
        findings.push({
            severity: 'warning',
            title: 'Mutually exclusive conditions active together',
            explanation: `Fields "subscribe" and "unsubscribe" are both true, which represents a logical contradiction. The user cannot simultaneously subscribe and unsubscribe. This likely indicates missing validation rules or UI controls to enforce mutual exclusivity. Current state: subscribe=${s}, unsubscribe=${u}.`,
            jsonPaths: ['steps[].fields[name=subscribe]', 'steps[].fields[name=unsubscribe]'],
            reproducerState: state.values,
            fixGuidance: [
                'Add radio button group instead of two separate checkboxes to enforce single selection',
                'Add validation rule: "if subscribe is true, unsubscribe must be false (and vice versa)"',
                'Use enum field with values ["subscribe", "unsubscribe", "no-change"] instead of two boolean fields',
                'Add cross-field validation: { "rule": "mutuallyExclusive", "fields": ["subscribe", "unsubscribe"] }'
            ]
        })
    }

    // Check for conflicting showIf conditions on same trigger field
    const triggerMap = {}
    for (const cf of conditionalFields) {
        const trigger = cf.showIf.field
        if (!triggerMap[trigger]) triggerMap[trigger] = []
        triggerMap[trigger].push(cf)
    }

    for (const [trigger, dependents] of Object.entries(triggerMap)) {
        if (dependents.length > 1) {
            // Check if multiple fields can be shown for same trigger value
            const valueGroups = {}
            for (const dep of dependents) {
                const key = JSON.stringify(dep.showIf.value)
                if (!valueGroups[key]) valueGroups[key] = []
                valueGroups[key].push(dep.name)
            }

            for (const [val, fields] of Object.entries(valueGroups)) {
                if (fields.length > 1 && fields.includes('accept') && fields.includes('decline')) {
                    findings.push({
                        severity: 'warning',
                        title: 'Potentially conflicting conditional fields',
                        explanation: `Multiple fields (${fields.join(', ')}) become visible when "${trigger}" = ${val}. If these represent mutually exclusive actions (like "accept" and "decline"), they should not both be showable simultaneously.`,
                        jsonPaths: fields.map(f => `steps[].fields[name=${f}].showIf`),
                        reproducerState: state.values,
                        fixGuidance: [
                            `Use different trigger values for mutually exclusive fields: set "accept" to show when ${trigger}="yes" and "decline" to show when ${trigger}="no"`,
                            'Consider using a single select/radio field instead of multiple conditional fields'
                        ]
                    })
                }
            }
        }
    }

    return findings
}
