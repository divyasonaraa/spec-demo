import fs from 'node:fs'
import path from 'node:path'
import { formatFinding, formatSummary } from './formatter.mjs'
import requiredHidden from '../rules/requiredHidden.mjs'
import mutuallyExclusive from '../rules/mutuallyExclusive.mjs'
import impossibleCombo from '../rules/impossibleCombo.mjs'
import schemaDrift from '../rules/schemaDrift.mjs'
import versionBreak from '../rules/versionBreak.mjs'

function loadJson(p) {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

export async function runDebugger({ configPath, invariantsPath, examplesPath, verbose = false }) {
    const startTime = performance.now()

    if (verbose) {
        console.log(`[VERBOSE] Loading config from: ${configPath}`)
    }

    const config = loadJson(configPath)

    if (verbose) {
        console.log(`[VERBOSE] Config loaded: ${config.steps?.length || 0} steps, ${config.id || 'no-id'}`)
        console.log(`[VERBOSE] Running static analysis (no test states needed)`)
    }

    const findings = []
    const ruleTimes = {}

    // Rules now analyze config directly without needing state simulation or invariants
    const ctx = { config }

    // Run each rule and track timing
    const rules = [
        { name: 'requiredHidden', fn: requiredHidden },
        { name: 'mutuallyExclusive', fn: mutuallyExclusive },
        { name: 'impossibleCombo', fn: impossibleCombo },
        { name: 'schemaDrift', fn: schemaDrift },
        { name: 'versionBreak', fn: versionBreak }
    ]

    for (const rule of rules) {
        const ruleStart = performance.now()
        const ruleFindings = rule.fn(ctx)
        const ruleTime = performance.now() - ruleStart

        if (!ruleTimes[rule.name]) ruleTimes[rule.name] = 0
        ruleTimes[rule.name] += ruleTime

        if (verbose && ruleFindings.length > 0) {
            console.log(`[VERBOSE] ${rule.name}: ${ruleFindings.length} findings (${ruleTime.toFixed(2)}ms)`)
        } else if (verbose) {
            console.log(`[VERBOSE] ${rule.name}: 0 findings (${ruleTime.toFixed(2)}ms)`)
        }

        findings.push(...ruleFindings)
    }

    const totalTime = performance.now() - startTime

    // Console output styled like debugger
    if (findings.length === 0) {
        console.log('✅ No issues found! Config looks good.')
    } else {
        for (const f of findings) {
            console.log(formatFinding(f))
        }
    }
    console.log('\n' + formatSummary(findings))

    // Performance summary
    console.log(`\n⏱️  Performance: Total ${totalTime.toFixed(2)}ms`)
    if (verbose) {
        console.log('Rule execution times:')
        for (const [rule, time] of Object.entries(ruleTimes)) {
            console.log(`  - ${rule}: ${time.toFixed(2)}ms`)
        }
    }

    // Write JSON artifact next to config
    const outPath = path.join(path.dirname(configPath), 'debugger-results.json')
    fs.writeFileSync(outPath, JSON.stringify(findings, null, 2))

    if (verbose) {
        console.log(`\n[VERBOSE] Results written to: ${outPath}`)
    }

    return { findings, outPath }
}