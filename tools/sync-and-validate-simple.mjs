#!/usr/bin/env node

/**
 * Sync and Validate Tool (Simple Version)
 * 
 * This tool uses tsx to run TypeScript directly without compilation:
 * 1. Discovers all TypeScript form configs in src/config/samples/
 * 2. Uses tsx to evaluate TypeScript and extract JSON
 * 3. Exports each config as JSON to public/examples/
 * 4. Runs debugger validation on all exported configs
 * 5. Reports validation results
 * 
 * Usage:
 *   node tools/sync-and-validate-simple.mjs
 *   npm run sync-validate
 * 
 * Requirements:
 *   npm install --save-dev tsx
 * 
 * Single source of truth: src/config/samples/*.ts
 * Auto-generated: public/examples/*.json (git-ignored in production)
 */

import { readdir, writeFile, mkdir, readFile } from 'fs/promises'
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

console.log('🔄 Form Config Sync & Validation\n')

// Step 1: Discover all sample TypeScript files
console.log('📂 Step 1: Discovering TypeScript samples...')
const files = await readdir(SAMPLES_DIR)
const tsFiles = files.filter(f => f.endsWith('.ts') && !f.startsWith('index'))

if (tsFiles.length === 0) {
    console.log('   ⚠️  No sample files found in', SAMPLES_DIR)
    process.exit(0)
}

console.log(`   Found ${tsFiles.length} sample(s): ${tsFiles.map(f => f.replace('.ts', '')).join(', ')}`)

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true })
}

// Step 2: Export each TypeScript config to JSON
console.log('\n📝 Step 2: Exporting to JSON...')

const exportedConfigs = []

for (const tsFile of tsFiles) {
    const baseName = tsFile.replace('.ts', '')
    const filePath = join(SAMPLES_DIR, tsFile)
    
    // Read file to detect export name
    const fileContent = await readFile(filePath, 'utf8')
    const exportMatch = fileContent.match(/export\s+const\s+(\w+):\s*FormConfig/)
    
    if (!exportMatch) {
        console.log(`   ⚠️  ${baseName}: No FormConfig export found`)
        continue
    }
    
    const exportName = exportMatch[1] // e.g., 'conditionalForm' or 'basicFormConfig'
    
    // Create a temporary evaluation script
    const evalScript = `
import { ${exportName} } from '${filePath}';
console.log(JSON.stringify(${exportName}, null, 2));
`
    
    const tempScriptPath = join(projectRoot, '.temp-export.mts')
    
    try {
        await writeFile(tempScriptPath, evalScript, 'utf8')
        
        // Run with tsx to evaluate TypeScript
        const jsonOutput = execSync(`npx tsx ${tempScriptPath}`, {
            cwd: projectRoot,
            encoding: 'utf8',
            stdio: 'pipe'
        })
        
        // Write to public/examples/ with kebab-case filename
        const kebabName = baseName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
        const outputPath = join(OUTPUT_DIR, `${kebabName}.json`)
        
        // Pretty-print the JSON
        const config = JSON.parse(jsonOutput)
        const formattedJson = JSON.stringify(config, null, 4)
        
        await writeFile(outputPath, formattedJson, 'utf8')
        
        console.log(`   ✅ ${baseName} → ${kebabName}.json`)
        exportedConfigs.push({ name: kebabName, path: outputPath, config })
        
        // Clean up temp file
        execSync(`rm -f ${tempScriptPath}`, { cwd: projectRoot })
        
    } catch (error) {
        console.log(`   ❌ Failed to export ${tsFile}: ${error.message}`)
        // Clean up on error
        try {
            execSync(`rm -f ${tempScriptPath}`, { cwd: projectRoot })
        } catch {}
    }
}

if (exportedConfigs.length === 0) {
    console.log('\n⚠️  No configs were exported successfully')
    process.exit(1)
}

console.log(`\n   Exported ${exportedConfigs.length}/${tsFiles.length} config(s)`)

// Step 3: Run debugger validation on all exported configs
console.log('\n🔍 Step 3: Running validation checks...\n')

let hasErrors = false
const results = []

for (const { name, path } of exportedConfigs) {
    process.stdout.write(`   ${name.padEnd(25)} `)
    
    try {
        const output = execSync(`node ${DEBUGGER_CLI} ${path}`, {
            cwd: projectRoot,
            encoding: 'utf8',
            stdio: 'pipe'
        })
        
        // Parse summary from output
        const summaryMatch = output.match(/errors=(\d+), warnings=(\d+), info=(\d+)/)
        
        if (summaryMatch) {
            const [, errors, warnings, info] = summaryMatch
            const e = parseInt(errors)
            const w = parseInt(warnings)
            const i = parseInt(info)
            
            results.push({ name, errors: e, warnings: w, info: i })
            
            if (e > 0) {
                hasErrors = true
                console.log(`❌ ${e} error(s), ${w} warning(s)`)
            } else if (w > 0) {
                console.log(`⚠️  ${w} warning(s)`)
            } else {
                console.log(`✅ PASS`)
            }
        }
        
    } catch (error) {
        // Debugger returns exit code 1 on errors
        const output = error.stdout || error.stderr || ''
        const summaryMatch = output.match(/errors=(\d+), warnings=(\d+), info=(\d+)/)
        
        if (summaryMatch) {
            const [, errors, warnings] = summaryMatch
            const e = parseInt(errors)
            const w = parseInt(warnings)
            results.push({ name, errors: e, warnings: w, info: 0 })
            hasErrors = true
            console.log(`❌ ${e} error(s), ${w} warning(s)`)
        } else {
            console.log(`❌ FAILED`)
            results.push({ name, errors: 1, warnings: 0, info: 0 })
            hasErrors = true
        }
    }
}

// Step 4: Print detailed summary
console.log('\n' + '─'.repeat(70))
console.log('📊 VALIDATION SUMMARY')
console.log('─'.repeat(70))

const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)
const totalWarnings = results.reduce((sum, r) => sum + r.warnings, 0)
const passed = results.filter(r => r.errors === 0).length
const failed = results.filter(r => r.errors > 0).length

console.log(`\nConfigs checked:  ${results.length}`)
console.log(`Passed:          ${passed} ✅`)
console.log(`Failed:          ${failed} ❌`)
console.log(`Total errors:    ${totalErrors}`)
console.log(`Total warnings:  ${totalWarnings}`)

if (hasErrors) {
    console.log('\n❌ Validation FAILED - Fix errors in src/config/samples/*.ts')
    console.log('   Run debugger manually: node tools/debugger/cli/run-debugger.mjs public/examples/<config>.json')
    console.log('')
    process.exit(1)
} else {
    console.log('\n✅ All configs validated successfully!')
    console.log('   JSON files synced to public/examples/')
    console.log('')
    process.exit(0)
}
