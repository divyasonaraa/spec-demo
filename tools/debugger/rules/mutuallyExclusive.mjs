export default function mutuallyExclusive({ config, state }) {
    const findings = []
    // Simple heuristic: fields named subscribe/unsubscribe shouldn't both be true
    const s = state.values.subscribe
    const u = state.values.unsubscribe
    if (s === true && u === true) {
        findings.push({
            severity: 'warning',
            title: 'Mutually exclusive conditions active together',
            explanation: 'subscribe and unsubscribe both true, which is mutually exclusive',
            jsonPaths: ['values.subscribe', 'values.unsubscribe'],
            reproducerState: state.values,
            fixGuidance: ['Ensure only one of subscribe/unsubscribe can be true']
        })
    }
    return findings
}
