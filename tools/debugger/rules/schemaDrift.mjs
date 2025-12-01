export default function schemaDrift({ config, invariants, state }) {
    const findings = []

    for (const req of invariants.payloadSchema.required) {
        const parts = req.split('.')
        let cur = state.values
        for (const p of parts) cur = cur?.[p]
        if (cur === undefined || cur === '') {
            // Find if there's a field that should map to this
            let suggestedField = null
            for (const step of config.steps) {
                for (const field of step.fields) {
                    if (field.name === parts[parts.length - 1] || field.name === req) {
                        suggestedField = field.name
                        break
                    }
                }
            }

            findings.push({
                severity: 'error',
                title: 'Payload schema required field missing',
                explanation: `API expects required field "${req}" in payload, but current form state does not provide it. Expected type: ${invariants.payloadSchema.types[req] || 'unknown'}. Actual value: ${cur === undefined ? 'undefined' : 'empty string'}. This will cause API validation errors. The payload mapping may be misconfigured or the form is missing a required field.`,
                jsonPaths: [
                    req,
                    suggestedField ? `steps[].fields[name=${suggestedField}]` : 'payload.mapping'
                ],
                reproducerState: state.values,
                fixGuidance: [
                    suggestedField
                        ? `Add payload mapping: map form field "${suggestedField}" to "${req}"`
                        : `Add form field that maps to "${req}" or provide a default value`,
                    `Add to payload transform: { "${req}": formValues.${suggestedField || req} || "default" }`,
                    `If field is optional, update API schema to mark "${req}" as optional instead of required`,
                    `Example valid payload: { "${req}": "example-value" }`
                ]
            })
        }
    }

    for (const [path, expectedType] of Object.entries(invariants.payloadSchema.types)) {
        const parts = path.split('.')
        let cur = state.values
        for (const p of parts) cur = cur?.[p]
        const actualType = typeof cur

        if (cur !== undefined && actualType !== expectedType) {
            findings.push({
                severity: 'warning',
                title: 'Payload schema type drift',
                explanation: `Field "${path}" has type mismatch. Expected: ${expectedType}, Actual: ${actualType} (value: ${JSON.stringify(cur)}). This drift means the form is collecting data in a different format than the API expects. While the API might coerce the type, this is fragile and could break if API validation becomes stricter.`,
                jsonPaths: [
                    path,
                    `steps[].fields[name=${parts[parts.length - 1]}].type`
                ],
                reproducerState: state.values,
                fixGuidance: [
                    expectedType === 'number' && actualType === 'string'
                        ? `Add type coercion in payload transform: { "${path}": Number(formValues.${path}) }`
                        : expectedType === 'string' && actualType === 'number'
                            ? `Add type coercion: { "${path}": String(formValues.${path}) }`
                            : `Convert ${actualType} to ${expectedType} before sending to API`,
                    `Change field input type to match expected type (e.g., type="number" for numeric fields)`,
                    `Update API schema documentation to accept ${actualType} if this is the intended format`,
                    `Example correct payload: { "${path}": ${expectedType === 'number' ? '42' : '"string-value"'} }`
                ]
            })
        }
    }

    return findings
}
