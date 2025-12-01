#!/usr/bin/env node
/**
 * Run Debugger on a FormConfig provided either as:
 *  - TypeScript sample file path (src/config/samples/*.ts) using tsx
 *  - JSON file path
 *  - Inline JSON via stdin
 *
 * Usage:
 *   node tools/debugger/cli/run-debugger-config.mjs src/config/samples/conditionalForm.ts
 *   node tools/debugger/cli/run-debugger-config.mjs public/examples/conditional-form.json
 *   cat config.json | node tools/debugger/cli/run-debugger-config.mjs
 */

import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, extname, basename } from 'path'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '../../..')

async function loadConfigFromTs(tsPath) {
  // Detect export name by reading the file and finding FormConfig export
  const content = await readFile(tsPath, 'utf8')
  const exportMatch = content.match(/export\s+const\s+(\w+):\s*FormConfig/)
  if (!exportMatch) throw new Error(`No FormConfig export found in ${tsPath}`)
  const exportName = exportMatch[1]

  const tempScript = join(projectRoot, '.temp-eval.mts')
  const evalSource = `import { ${exportName} } from '${tsPath}';\nconsole.log(JSON.stringify(${exportName}, null, 2));\n`
  await (await import('fs/promises')).writeFile(tempScript, evalSource, 'utf8')
  try {
    const json = execSync(`npx tsx ${tempScript}`, { cwd: projectRoot, encoding: 'utf8', stdio: 'pipe' })
    return JSON.parse(json)
  } finally {
    try { execSync(`rm -f ${tempScript}`, { cwd: projectRoot }) } catch {}
  }
}

async function loadConfigFromJson(jsonPath) {
  const content = await readFile(jsonPath, 'utf8')
  return JSON.parse(content)
}

async function loadConfigFromStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const content = Buffer.concat(chunks).toString('utf8')
  return JSON.parse(content)
}

async function main() {
  const arg = process.argv[2]
  let config
  let nameHint = 'config'

  if (!arg) {
    // Try stdin
    if (process.stdin.isTTY) {
      console.error('Usage: run-debugger-config.mjs <path-to-ts-or-json> or pipe JSON via stdin')
      process.exit(2)
    }
    config = await loadConfigFromStdin()
  } else {
    const fullPath = arg.startsWith('/') ? arg : join(projectRoot, arg)
    const ext = extname(fullPath)
    nameHint = basename(fullPath).replace(ext, '')

    if (!existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`)
      process.exit(2)
    }

    if (ext === '.ts' || ext === '.mts' || ext === '.tsx') {
      config = await loadConfigFromTs(fullPath)
    } else {
      config = await loadConfigFromJson(fullPath)
    }
  }

  // Run engine directly with in-memory config
  const { default: runEngine } = await import(join(projectRoot, 'tools/debugger/engine/index.mjs'))
  const findings = await runEngine({ config })

  // Pretty print findings similar to existing CLI
  let errors = 0, warnings = 0, info = 0
  for (const f of findings) {
    if (f.severity === 'error') errors++
    else if (f.severity === 'warning') warnings++
    else info++

    const tag = f.severity.toUpperCase()
    console.log(`[${tag}] ${f.title}\n`)
    console.log(`Reason: ${f.explanation}`)
    if (Array.isArray(f.jsonPaths) && f.jsonPaths.length) {
      console.log(`Paths: ${f.jsonPaths.join(', ')}`)
    }
    console.log('Reproducer: {}')
    if (Array.isArray(f.fixGuidance) && f.fixGuidance.length) {
      console.log('Fix Guidance:')
      f.fixGuidance.forEach((g, i) => console.log(`  - ${i + 1}. ${g}`))
    }
    console.log('\n')
  }

  console.log(`Debugger Summary: errors=${errors}, warnings=${warnings}, info=${info}`)

  if (errors > 0) process.exit(1)
  else process.exit(0)
}

main().catch(err => {
  console.error('Debugger run failed:', err.message)
  process.exit(2)
})
