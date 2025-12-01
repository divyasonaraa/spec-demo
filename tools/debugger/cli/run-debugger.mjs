#!/usr/bin/env node
import path from 'node:path'
import { runDebugger } from '../engine/index.mjs'

const args = process.argv.slice(2)
const configPath = args[0] || path.resolve('public/examples/basic-form.json')
const invariantsPath = args[1] || path.resolve('tools/debugger/specs/invariants.json')
const examplesPath = args[2] || path.resolve('tools/debugger/specs/examples.json')

const { findings, outPath } = await runDebugger({ configPath, invariantsPath, examplesPath })
console.log(`\nWrote JSON findings to: ${outPath}`)
process.exit(findings.some(f => f.severity === 'error') ? 1 : 0)
