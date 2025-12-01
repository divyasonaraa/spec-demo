export default function schemaDrift({ invariants, state }) {
    const findings = []
    for (const req of invariants.payloadSchema.required) {
        const parts = req.split('.')
        let cur = state.values
        for (const p of parts) cur = cur?.[p]
        if (cur === undefined || cur === '') {
            findings.push({
                severity: 'error',
                title: 'Payload schema required field missing',
                explanation: `Required payload field ${req} is missing or empty`,
                jsonPaths: [req],
                reproducerState: state.values,
                fixGuidance: ['Provide value or adjust mapping']
            })
        }
    }
    for (const [path, type] of Object.entries(invariants.payloadSchema.types)) {
        const parts = path.split('.')
        let cur = state.values
        for (const p of parts) cur = cur?.[p]
        if (cur !== undefined && typeof cur !== type) {
            findings.push({
                severity: 'warning',
                title: 'Payload schema type drift',
                explanation: `Field ${path} is ${typeof cur}, expected ${type}`,
                jsonPaths: [path],
                reproducerState: state.values,
                fixGuidance: ['Coerce value to expected type']
            })
        }
    }
    return findings
}
