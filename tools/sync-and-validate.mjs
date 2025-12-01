#!/usr/bin/env node

/**
 * Sync and Validate Tool
 * 
 * This tool automates the following workflow:
 * 1. Discovers all TypeScript form configs in src/config/samples/
 * 2. Compiles TypeScript to get runtime values
 * 3. Exports each config as JSON to public/examples/
 * 4. Runs debugger validation on all exported configs
 * 5. Reports validation results
 * 
 * Usage:
 *   node tools/sync-and-validate.mjs
 *   npm run sync-validate (if added to package.json)
 * 
 * Single source of truth: src/config/samples/*.ts
 * Auto-generated: public/examples/*.json
 */

import { readdir, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

const SAMPLES_DIR = join(projectRoot, 'src/config/samples')
const OUTPUT_DIR = join(projectRoot, 'public/examples')
const DEBUGGER_CLI = join(projectRoot, 'tools/debugger/cli/run-debugger.mjs')

console.log('🔄 Starting sync and validation process...\n')

// Step 1: Discover all sample TypeScript files
console.log('📂 Discovering sample configs...')
const files = await readdir(SAMPLES_DIR)
const tsFiles = files.filter(f => f.endsWith('.ts') && !f.startsWith('index'))

if (tsFiles.length === 0) {
    console.log('⚠️  No sample files found in', SAMPLES_DIR)
    process.exit(0)
}

console.log(`   Found ${tsFiles.length} sample(s): ${tsFiles.join(', ')}\n`)

// Step 2: Build TypeScript (compile src/config/samples/)
console.log('🔨 Compiling TypeScript...')
try {
    execSync('npm run build -- --mode development', {
        cwd: projectRoot,
        stdio: 'pipe',
        encoding: 'utf8'
    })
    console.log('   ✅ TypeScript compiled\n')
} catch (error) {
    console.error('❌ TypeScript compilation failed:')
    console.error(error.stdout || error.message)
    process.exit(1)
}

// Step 3: Import compiled configs and export as JSON
console.log('📝 Exporting configs to JSON...')

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true })
}

const exportedConfigs = []

for (const tsFile of tsFiles) {
    const baseName = tsFile.replace('.ts', '')
    const exportName = baseName // e.g., 'conditionalForm'

    try {
        // Import the compiled JavaScript module
        // Note: After build, files are in dist/ - adjust path as needed based on your build config
        const modulePath = join(projectRoot, 'dist/config/samples', `${baseName}.js`)

        // Dynamic import doesn't work with file:// in some Node versions, use workaround
        const configModule = await import(`file://${modulePath}`)

        // Get the exported config (e.g., conditionalForm export)
        const config = configModule[exportName]

        if (!config) {
            console.log(`   ⚠️  No export named '${exportName}' in ${tsFile}`)
            continue
        }

        // Convert to JSON with proper formatting
        const jsonContent = JSON.stringify(config, null, 4)

        // Write to public/examples/ with kebab-case filename
        const kebabName = baseName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
        const outputPath = join(OUTPUT_DIR, `${kebabName}.json`)

        await writeFile(outputPath, jsonContent, 'utf8')

        console.log(`   ✅ ${tsFile} → ${kebabName}.json`)
        exportedConfigs.push({ name: kebabName, path: outputPath })

    } catch (error) {
        console.log(`   ❌ Failed to export ${tsFile}:`, error.message)
    }
}

if (exportedConfigs.length === 0) {
    console.log('\n⚠️  No configs were exported successfully')
    process.exit(1)
}

console.log(`\n✅ Exported ${exportedConfigs.length} config(s)\n`)

// Step 4: Run debugger validation on all exported configs
console.log('🔍 Running validation...\n')

let hasErrors = false
const results = []

for (const { name, path } of exportedConfigs) {
    console.log(`   Validating ${name}...`)

    try {
        const output = execSync(`node ${DEBUGGER_CLI} ${path}`, {
            cwd: projectRoot,
            encoding: 'utf8',
            stdio: 'pipe'
        })

        // Parse summary from output
        const summaryMatch = output.match(/Debugger Summary: errors=(\d+), warnings=(\d+), info=(\d+)/)

        if (summaryMatch) {
            const [, errors, warnings, info] = summaryMatch
            results.push({
                name,
                errors: parseInt(errors),
                warnings: parseInt(warnings),
                info: parseInt(info),
                status: parseInt(errors) > 0 ? 'FAILED' : (parseInt(warnings) > 0 ? 'WARNINGS' : 'PASSED')
            })

            if (parseInt(errors) > 0) {
                hasErrors = true
                console.log(`      ❌ ${errors} error(s), ${warnings} warning(s)`)

                // Show error details
                const errorLines = output.split('\n').filter(line =>
                    line.includes('[ERROR]') || line.includes('Reason:') || line.includes('Fix Guidance:')
                )
                errorLines.forEach(line => console.log(`         ${line.trim()}`))
            } else if (parseInt(warnings) > 0) {
                console.log(`      ⚠️  ${warnings} warning(s)`)
            } else {
                console.log(`      ✅ No issues found`)
            }
        }

    } catch (error) {
        // Debugger returns exit code 1 on errors
        const output = error.stdout || error.stderr || ''
        const summaryMatch = output.match(/Debugger Summary: errors=(\d+), warnings=(\d+), info=(\d+)/)

        if (summaryMatch) {
            const [, errors, warnings, info] = summaryMatch
            results.push({
                name,
                errors: parseInt(errors),
                warnings: parseInt(warnings),
                info: parseInt(info),
                status: 'FAILED'
            })
            hasErrors = true

            console.log(`      ❌ ${errors} error(s), ${warnings} warning(s)`)
        } else {
            console.log(`      ❌ Validation failed:`, error.message)
            results.push({ name, errors: 1, warnings: 0, info: 0, status: 'FAILED' })
            hasErrors = true
        }
    }
}

// Step 5: Print summary table
console.log('\n' + '='.repeat(60))
console.log('📊 VALIDATION SUMMARY')
console.log('='.repeat(60))
console.log('')
console.log('Config                    Errors  Warnings  Info  Status')
console.log('-'.repeat(60))

for (const result of results) {
    const name = result.name.padEnd(24)
    const errors = result.errors.toString().padStart(6)
    const warnings = result.warnings.toString().padStart(9)
    const info = result.info.toString().padStart(5)
    const status = result.status === 'PASSED' ? '✅ PASS' :
        result.status === 'WARNINGS' ? '⚠️  WARN' : '❌ FAIL'

    console.log(`${name} ${errors} ${warnings} ${info}  ${status}`)
}

console.log('')

// Exit with error if any config failed
if (hasErrors) {
    console.log('❌ Validation failed - fix errors before committing\n')
    process.exit(1)
} else {
    console.log('✅ All configs validated successfully!\n')
    process.exit(0)
}
