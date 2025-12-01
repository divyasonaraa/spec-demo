import fs from 'node:fs'
import path from 'node:path'
import { simulate } from './stateSim.mjs'
import { formatFinding, formatSummary } from './formatter.mjs'
import requiredHidden from '../rules/requiredHidden.mjs'
import mutuallyExclusive from '../rules/mutuallyExclusive.mjs'
import impossibleCombo from '../rules/impossibleCombo.mjs'
import schemaDrift from '../rules/schemaDrift.mjs'
import versionBreak from '../rules/versionBreak.mjs'

function loadJson(p) {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

export async function runDebugger({ configPath, invariantsPath, examplesPath }) {
    const config = loadJson(configPath)
    const invariants = loadJson(invariantsPath)
    const examples = loadJson(examplesPath)

    const findings = []
    for (const ex of examples.states) {
        const sim = simulate(config, ex.values)
        const ctx = { config, invariants, state: sim, example: ex }
        findings.push(
            ...requiredHidden(ctx),
            ...mutuallyExclusive(ctx),
            ...impossibleCombo(ctx),
            ...schemaDrift(ctx),
            ...versionBreak(ctx)
        )
    }

    // Console output styled like debugger
    for (const f of findings) {
        console.log(formatFinding(f))
    }
    console.log('\n' + formatSummary(findings))

    // Write JSON artifact next to config
    const outPath = path.join(path.dirname(configPath), 'debugger-results.json')
    fs.writeFileSync(outPath, JSON.stringify(findings, null, 2))
    return { findings, outPath }
}
