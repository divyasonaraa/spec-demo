export default function versionBreak({ invariants, config }) {
    const findings = []
    const cur = config.metadata?.version
    const note = invariants.versioning.breakingRules.find(r => r.path === 'metadata.version')?.note
    if (cur && note && cur !== invariants.versioning.currentVersion) {
        findings.push({
            severity: 'info',
            title: 'Potential breaking change between config versions',
            explanation: `Config version changed to ${cur}. ${note}`,
            jsonPaths: ['metadata.version'],
            reproducerState: {},
            fixGuidance: ['Document changes and update migration notes']
        })
    }
    return findings
}
