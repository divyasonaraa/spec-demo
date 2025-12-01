#!/usr/bin/env node
import path from 'node:path'
import { runDebugger } from '../engine/index.mjs'

const args = process.argv.slice(2)
const verbose = args.includes('--verbose') || args.includes('-v')
const filteredArgs = args.filter(a => a !== '--verbose' && a !== '-v')

const configPath = filteredArgs[0] || path.resolve('public/examples/basic-form.json')
const invariantsPath = filteredArgs[1] || path.resolve('tools/debugger/specs/invariants.json')
const examplesPath = filteredArgs[2] || path.resolve('tools/debugger/specs/examples.json')

if (verbose) {
    console.log('🔍 Spec Debugger - Verbose Mode')
    console.log('================================\n')
}

const { findings, outPath } = await runDebugger({ configPath, invariantsPath, examplesPath, verbose })
console.log(`\n📄 Wrote JSON findings to: ${outPath}`)

const hasErrors = findings.some(f => f.severity === 'error')
const exitCode = hasErrors ? 1 : 0

if (verbose) {
    console.log(`\n🎯 Exit code: ${exitCode} ${hasErrors ? '(errors detected)' : '(no errors)'}`)
}

process.exit(exitCode)
