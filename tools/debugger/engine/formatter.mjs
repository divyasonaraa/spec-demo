export function formatFinding(f) {
    const badge = f.severity.toUpperCase()
    const paths = (f.jsonPaths || []).join(', ')
    const guidance = (f.fixGuidance || []).map((g, i) => `  - ${i + 1}. ${g}`).join('\n')
    return `\n[${badge}] ${f.title}\n\nReason: ${f.explanation}\nPaths: ${paths}\nReproducer: ${JSON.stringify(f.reproducerState)}\nFix Guidance:\n${guidance || '  - Review related rules and adjust conditions'}\n`
}

export function formatSummary(findings) {
    const counts = findings.reduce((acc, f) => {
        acc[f.severity] = (acc[f.severity] || 0) + 1
        return acc
    }, {})
    return `Debugger Summary: errors=${counts.error || 0}, warnings=${counts.warning || 0}, info=${counts.info || 0}`
}
