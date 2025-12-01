# Implementation Plan: Bug Debugger Workflow

## Technical Context

- Repo-local tools using Node.js (ESM). No external services.
- Inputs: Form config JSON/TS, payload mapping, version metadata.
- Outputs: Human-readable debugger report with severity, JSON paths, reproducer state, fix guidance.

## Architecture

- Spec Definition Layer (`tools/debugger/specs/`)
  - `invariants.json`: cross-field invariants and validation contracts
  - `examples.json`: sample configs and reproducer states
- Debug Rule Engine (`tools/debugger/engine/`)
  - Loads config + invariants, simulates state transitions
  - Applies rule modules and aggregates findings
  - Formats console output as step-by-step debugger
- Rules (`tools/debugger/rules/`)
  - Modular files implementing detection: required-hidden, mutually-exclusive, impossible-combo, schema-drift, version-break
- CLI (`tools/debugger/cli/`)
  - `run-debugger.mjs`: invoke engine locally or in CI, emit JSON + console report
- CI (`.github/workflows/spec-debugger.yml`)
  - Runs on pull_request, posts summary comment

## Folder Structure

```
tools/
  debugger/
    specs/
      invariants.json
      examples.json
    rules/
      requiredHidden.mjs
      mutuallyExclusive.mjs
      impossibleCombo.mjs
      schemaDrift.mjs
      versionBreak.mjs
    engine/
      index.mjs
      formatter.mjs
      stateSim.mjs
    cli/
      run-debugger.mjs
.github/
  workflows/
    spec-debugger.yml
```

## Data Model (DebuggerFinding)

- `severity`: error | warning | info
- `title`: short description
- `explanation`: human-readable root-cause
- `jsonPaths`: array of JSON path strings
- `reproducerState`: object of field values
- `fixGuidance`: array of suggestions

## Execution Flow

1. Load config and invariants
2. Simulate state transitions (per examples and minimal permutations)
3. Evaluate each rule, collect findings
4. Format step-by-step reasoning to console; write JSON artifact
5. In CI, post summary to PR

## Performance Targets

- < 60s total in CI on typical configs
- Rule evaluation short-circuits once sufficient evidence gathered

## Extensibility

- Each rule is a pure module with signature `(config, state, invariants) => findings[]`
- Register new rules by adding to `engine/index.mjs`

## Manual Verification

- Run CLI locally against `public/examples/*.json` configs
- Confirm outputs include severity, paths, reproducer, guidance
- Example:
  ```bash
  node tools/debugger/cli/run-debugger.mjs public/examples/basic-form.json tools/debugger/specs/invariants.json tools/debugger/specs/examples.json
  ```

## GitHub Actions Integration

**Workflow**: `.github/workflows/spec-debugger.yml`

**Triggers**: Runs on all pull requests (opened, synchronize, reopened)

**What It Does**:
1. Runs debugger against all example configs in `public/examples/`:
   - `basic-form.json`
   - `multi-step-form.json` (if present)
   - `conditional-form.json` (if present)
2. Uploads `debugger-results.json` as artifact
3. Posts summary table to PR showing which configs passed/failed
4. Exits with code 1 if any errors detected (warnings don't fail the build)

**Output**:
- Console logs show step-by-step debugger reasoning
- Artifact contains full JSON findings with reproducer states
- PR comment shows quick summary table

**Setup**:
1. Ensure example JSON files exist in `public/examples/`
2. Push workflow to default branch
3. Open a PR to test it

**Local Testing Before PR**:
```bash
# Test all configs
node tools/debugger/cli/run-debugger.mjs public/examples/basic-form.json
node tools/debugger/cli/run-debugger.mjs public/examples/multi-step-form.json
node tools/debugger/cli/run-debugger.mjs public/examples/conditional-form.json
```
