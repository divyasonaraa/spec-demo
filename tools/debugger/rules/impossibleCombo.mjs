export default function impossibleCombo({ config, state }) {
    const findings = []
    const age = Number(state.values.age)
    const consent = state.values.parentConsent

    // Find age field validation rules
    let ageValidation = null
    for (const step of config.steps) {
        const ageField = step.fields.find(f => f.name === 'age')
        if (ageField) {
            ageValidation = ageField.validation
            break
        }
    }

    if (!Number.isNaN(age) && age < 0 && consent === false) {
        const minRule = ageValidation?.min !== undefined ? `min: ${ageValidation.min}` : 'no min constraint defined'
        findings.push({
            severity: 'error',
            title: 'Impossible value combination across fields',
            explanation: `Field "age" has value ${age} (negative), which violates logical constraints (${minRule}). Combined with "parentConsent"=false, this creates an impossible state. Negative ages are never valid, and the validation rules should prevent this. The form allows entering invalid data that cannot be processed.`,
            jsonPaths: [
                'steps[].fields[name=age].validation',
                'steps[].fields[name=age]',
                'steps[].fields[name=parentConsent]'
            ],
            reproducerState: state.values,
            fixGuidance: [
                `Add validation rule to age field: { "min": 0, "max": 120, "required": true } to prevent negative values`,
                `Add client-side validation with error message: "Age must be between 0 and 120"`,
                'Example valid combination that passes: { "age": 25, "parentConsent": false } (adult, no consent needed)',
                'Example valid combination for minor: { "age": 15, "parentConsent": true } (minor with consent)'
            ]
        })
    }

    // Check for more impossible combinations
    const email = state.values.email
    const emailOptOut = state.values.emailOptOut
    if (email && emailOptOut === true) {
        findings.push({
            severity: 'warning',
            title: 'Contradictory field combination',
            explanation: `User provided email "${email}" but also selected "emailOptOut"=true. This is contradictory - why collect email if user opted out? This suggests either the opt-out should clear the email field, or the email field should be hidden when opted out.`,
            jsonPaths: ['steps[].fields[name=email]', 'steps[].fields[name=emailOptOut]'],
            reproducerState: state.values,
            fixGuidance: [
                'Add showIf to email field: { "field": "emailOptOut", "operator": "equals", "value": false } to hide email when opted out',
                'Clear email value automatically when emailOptOut is toggled to true',
                'Example valid combination: { "email": "user@example.com", "emailOptOut": false }'
            ]
        })
    }

    return findings
}
