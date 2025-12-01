export default function versionBreak({ invariants, config }) {
    const findings = []
    const currentVersion = config.metadata?.version
    const expectedVersion = invariants.versioning.currentVersion

    if (!currentVersion) {
        findings.push({
            severity: 'info',
            title: 'Config version not specified',
            explanation: `Config is missing "metadata.version" field. Current expected version: ${expectedVersion}. Without explicit versioning, it's difficult to track breaking changes and ensure compatibility. Add version field to enable version drift detection.`,
            jsonPaths: ['metadata', 'metadata.version'],
            reproducerState: {},
            fixGuidance: [
                `Add to config root: { "metadata": { "version": "${expectedVersion}", "lastUpdated": "${new Date().toISOString().split('T')[0]}" } }`,
                'Follow semantic versioning: MAJOR.MINOR.PATCH (e.g., "2.1.0")',
                'Increment MAJOR for breaking changes, MINOR for new features, PATCH for bug fixes'
            ]
        })
        return findings
    }

    if (currentVersion !== expectedVersion) {
        const [curMajor, curMinor] = currentVersion.split('.').map(Number)
        const [expMajor, expMinor] = expectedVersion.split('.').map(Number)

        const isBreaking = curMajor !== expMajor
        const isMinor = curMajor === expMajor && curMinor !== expMinor

        const breakingRule = invariants.versioning.breakingRules.find(r => r.path === 'metadata.version')
        const changeDescription = breakingRule?.note || 'Version mismatch detected'

        // Analyze actual breaking changes
        const breakingChanges = []
        if (isBreaking) {
            // Check for removed required fields
            const schemaRequired = invariants.payloadSchema?.required || []
            for (const req of schemaRequired) {
                let found = false
                for (const step of config.steps) {
                    if (step.fields.some(f => f.name === req)) {
                        found = true
                        break
                    }
                }
                if (!found) {
                    breakingChanges.push(`Required field "${req}" is missing from current config`)
                }
            }
        }

        findings.push({
            severity: isBreaking ? 'warning' : 'info',
            title: isBreaking ? 'Breaking version change detected' : 'Config version drift',
            explanation: `Config version is ${currentVersion}, but expected version is ${expectedVersion}. ${changeDescription}. ${isBreaking ? `This is a MAJOR version change (${curMajor}.x → ${expMajor}.x), which typically indicates breaking changes that require migration.` : isMinor ? `This is a MINOR version difference (x.${curMinor} → x.${expMinor}), which may include new features but should be backward compatible.` : 'This is a PATCH-level difference.'}${breakingChanges.length > 0 ? ` Detected issues: ${breakingChanges.join('; ')}` : ''}`,
            jsonPaths: ['metadata.version'],
            reproducerState: {},
            fixGuidance: [
                isBreaking
                    ? `Review migration guide: docs/migrations/v${curMajor}-to-v${expMajor}.md`
                    : `Update config version to ${expectedVersion} if compatible`,
                breakingChanges.length > 0
                    ? `Address breaking changes: ${breakingChanges[0]}`
                    : 'Test config against latest API version to ensure compatibility',
                `Run validation: node tools/debugger/cli/run-debugger.mjs <config> to detect specific issues`,
                `If intentionally using older version, add comment: // Locked to ${currentVersion} due to [reason]`
            ]
        })
    }

    return findings
}
