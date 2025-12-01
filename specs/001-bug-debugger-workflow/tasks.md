# Tasks: Bug Debugger Workflow

**Input**: Design documents from `/specs/001-bug-debugger-workflow/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**⚠️ CRITICAL - NO TESTING POLICY**: This project follows Constitution Principle V - NO TESTING.
Absolutely no test tasks should be created. No unit tests, integration tests, or e2e tests.
All verification is performed manually during development. This policy supersedes ALL other guidance.

**Organization**: Tasks are grouped by user story to enable independent implementation and manual verification of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Repo-local Node.js tools: `tools/debugger/`
- GitHub Actions: `.github/workflows/`
- Specifications: `tools/debugger/specs/`
- All paths shown below are absolute from repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure for debugger tooling

- [X] T001 Create folder structure: `tools/debugger/{specs,rules,engine,cli}`
- [X] T002 Create `.github/workflows/` if not exists
- [X] T003 [P] Create `tools/debugger/specs/invariants.json` with versioning, payloadSchema, crossField rules
- [X] T004 [P] Create `tools/debugger/specs/examples.json` with reproducer states for bug classes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core engine and formatting infrastructure

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 [P] Create `tools/debugger/engine/stateSim.mjs` with `evalShowIf` and `simulate` functions
- [X] T006 [P] Create `tools/debugger/engine/formatter.mjs` with `formatFinding` and `formatSummary` functions
- [X] T007 Create `tools/debugger/engine/index.mjs` to orchestrate loading, rule execution, and output
- [X] T008 Create `tools/debugger/cli/run-debugger.mjs` as executable entry point with default paths

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - PR-Time Bug Reproduction (Priority: P1) 🎯 MVP

**Goal**: Detect and report likely config bugs at PR time with severity, JSON paths, and reproducer states

**Manual Verification**: Run CLI locally against `public/examples/basic-form.json` and verify output includes severity badges, JSON paths, reproducer state objects, and fix guidance for each finding

### Rule Implementation for US1

- [X] T009 [P] [US1] Create `tools/debugger/rules/requiredHidden.mjs` to detect required fields hidden by `showIf`
- [X] T010 [P] [US1] Create `tools/debugger/rules/mutuallyExclusive.mjs` to detect conflicting conditions
- [X] T011 [P] [US1] Create `tools/debugger/rules/impossibleCombo.mjs` to detect invalid field value combinations
- [X] T012 [P] [US1] Create `tools/debugger/rules/schemaDrift.mjs` to detect payload schema mismatches
- [X] T013 [P] [US1] Create `tools/debugger/rules/versionBreak.mjs` to detect breaking config version changes

### CI Integration for US1

- [X] T014 [US1] Create `.github/workflows/spec-debugger.yml` to run on pull_request events (depends on T008)
- [X] T015 [US1] Add workflow steps to run debugger against `public/examples/basic-form.json` (depends on T014)
- [X] T016 [US1] Add workflow step to upload `debugger-results.json` as artifact (depends on T014)
- [X] T017 [US1] Add workflow step to post summary comment to PR (depends on T014)

### Manual Verification for US1

- [X] T018 [US1] Manual verification: Run `node tools/debugger/cli/run-debugger.mjs public/examples/basic-form.json` locally
- [X] T019 [US1] Manual verification: Confirm output shows [ERROR], [WARNING], [INFO] badges
- [X] T020 [US1] Manual verification: Confirm each finding includes JSON paths array
- [X] T021 [US1] Manual verification: Confirm each finding includes reproducerState object
- [X] T022 [US1] Manual verification: Confirm summary shows counts (errors=X, warnings=Y, info=Z)

**Checkpoint**: User Story 1 complete - debugger runs locally and in CI with all 5 bug classes detected

---

## Phase 4: User Story 2 - Root-Cause Explanations (Priority: P2)

**Goal**: Enhance explanations to show conflicting rules, impossible states, and schema drift root causes

**Manual Verification**: Trigger each bug class and verify explanation clearly describes why the issue occurs (not just what failed)

### Enhanced Explanations for US2

- [X] T023 [P] [US2] Enhance `requiredHidden.mjs` to include which `showIf` condition causes hiding in explanation
- [X] T024 [P] [US2] Enhance `mutuallyExclusive.mjs` to parse actual condition rules and identify conflicts (not just name heuristics)
- [X] T025 [P] [US2] Enhance `impossibleCombo.mjs` to reference validation rules that make combinations impossible
- [X] T026 [P] [US2] Enhance `schemaDrift.mjs` to show expected vs actual type/value in explanation
- [X] T027 [P] [US2] Enhance `versionBreak.mjs` to parse version metadata and identify specific breaking changes

### Manual Verification for US2

- [X] T028 [US2] Manual verification: Run debugger against `public/examples/conditional-form.json`
- [X] T029 [US2] Manual verification: Confirm explanations describe root cause (e.g., "field X depends on field Y which is...")
- [X] T030 [US2] Manual verification: Confirm explanations reference specific rules/conditions from config
- [X] T031 [US2] Manual verification: Verify non-technical stakeholder can understand explanation

**Checkpoint**: User Story 2 complete - explanations are teachable and root-cause focused

---

## Phase 5: User Story 3 - Guided Fixes (Priority: P3)

**Goal**: Provide actionable fix guidance with suggested edits and example valid states

**Manual Verification**: For each bug class, verify fixGuidance array includes concrete suggestions with example values

### Fix Guidance Enhancement for US3

- [X] T032 [P] [US3] Enhance `requiredHidden.mjs` fixGuidance to suggest specific `showIf` condition rewrites
- [X] T033 [P] [US3] Enhance `mutuallyExclusive.mjs` fixGuidance to suggest adding mutual exclusion checks
- [X] T034 [P] [US3] Enhance `impossibleCombo.mjs` fixGuidance to show example valid combination that passes validation
- [X] T035 [P] [US3] Enhance `schemaDrift.mjs` fixGuidance to suggest payload mapping changes with dot-notation paths
- [X] T036 [P] [US3] Enhance `versionBreak.mjs` fixGuidance to link to migration docs or version changelog

### Manual Verification for US3

- [X] T037 [US3] Manual verification: Run debugger against `public/examples/multi-step-form.json`
- [X] T038 [US3] Manual verification: Confirm each finding has 2+ fix guidance suggestions
- [X] T039 [US3] Manual verification: Confirm fix guidance includes concrete examples (not generic advice)
- [X] T040 [US3] Manual verification: Apply suggested fix and re-run to verify it resolves the finding

**Checkpoint**: User Story 3 complete - debugger output is actionable and remediation-focused

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Multi-config support, enhanced CI output, documentation

- [X] T041 [P] Update `.github/workflows/spec-debugger.yml` to run debugger for all JSON files in `public/examples/`
- [X] T042 [P] Add conditional steps in workflow to skip missing configs gracefully
- [X] T043 Update workflow to generate formatted summary table with per-config status
- [X] T044 Add README section to `specs/001-bug-debugger-workflow/` documenting local and CI usage
- [X] T045 Add performance logging to `engine/index.mjs` to track rule execution time
- [X] T046 Add `--verbose` flag to CLI for detailed step-by-step output
- [ ] T047 Manual verification: Run workflow in actual PR and confirm comment appears within 60s
- [ ] T048 Manual verification: Download artifact and confirm JSON structure matches DebuggerFinding schema
- [ ] T049 Manual verification: Test with empty config (no steps/fields) and verify info-level guidance
- [ ] T050 Manual verification: Test offline (no API schema available) and verify warnings instead of errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundational - No dependencies on other stories
  - User Story 2 (P2): Can start after US1 or in parallel (enhances existing rules)
  - User Story 3 (P3): Can start after US1 or in parallel (enhances existing rules)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### Within Each User Story

- Rule files (T009-T013) can run in parallel - different files, no dependencies
- CI workflow creation (T014) before workflow enhancements (T015-T017)
- Manual verification (T018-T022) after rule implementation

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel
- Within US1: All rule files (T009-T013) can be created in parallel
- Within US2: All rule enhancements (T023-T027) can run in parallel
- Within US3: All fix guidance enhancements (T032-T036) can run in parallel
- Polish tasks marked [P] can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run debugger locally and in PR, confirm all 5 bug classes detected
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Engine ready
2. Add User Story 1 → Manual verify locally + CI → Deploy/Demo (MVP!)
3. Add User Story 2 → Manual verify explanations → Deploy/Demo
4. Add User Story 3 → Manual verify fix guidance → Deploy/Demo
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and manually verifiable
- All verification is manual (run CLI, inspect console output, check PR comments)
- NO automated tests per Constitution Principle V
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
