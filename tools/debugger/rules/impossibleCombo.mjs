export default function impossibleCombo({ state }) {
    const findings = []
    const age = Number(state.values.age)
    const consent = state.values.parentConsent
    if (!Number.isNaN(age) && age < 0 && consent === false) {
        findings.push({
            severity: 'error',
            title: 'Impossible value combination across fields',
            explanation: 'Negative age without parent consent is an impossible state',
            jsonPaths: ['values.age', 'values.parentConsent'],
            reproducerState: state.values,
            fixGuidance: [
                'Validate age >= 0',
                'Adjust consent logic for minors'
            ]
        })
    }
    return findings
}
