---
description: "Task breakdown for Automated GitHub Issue Triage and Auto-Fix System"
---

# Tasks: Automated GitHub Issue Triage and Auto-Fix System

**Input**: Design documents from `/specs/001-github-auto-fix/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**⚠️ CRITICAL - NO TESTING POLICY**: This project follows Constitution Principle V - NO TESTING.
Absolutely no test tasks have been created. No unit tests, integration tests, or e2e tests.
All verification is performed manually by creating GitHub issues and observing workflow execution.

**Organization**: Tasks are grouped by user story to enable independent implementation and manual verification of each story.

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This feature uses GitHub Actions + Node.js structure (NOT Vue):
- `.github/workflows/` - GitHub Actions workflow files
- `.github/agents/` - Node.js agent scripts
- `.github/agents/shared/` - Shared utilities

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Basic structure and configuration for GitHub Actions workflow

- [X] T001 Create `.github/agents/` directory structure
- [X] T002 Create `.github/agents/package.json` with dependencies (Octokit, Anthropic SDK)
- [X] T003 [P] Create `.github/agents/tsconfig.json` with TypeScript strict configuration
- [X] T004 [P] Create `.github/CODEOWNERS` file template for reviewer assignment
- [X] T005 [P] Document required GitHub repository labels in README or setup script

**Checkpoint**: Directory structure and configuration files ready for agent implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared utilities and security constraints that ALL agents depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Create security constraints in `.github/agents/shared/security-constraints.js`
- [X] T007 [P] Implement GitHub API client wrapper in `.github/agents/shared/github-client.js`
- [X] T008 [P] Implement AI provider abstraction in `.github/agents/shared/ai-client.js`
- [X] T009 [P] Implement risk assessment logic in `.github/agents/shared/risk-assessment.js`
- [X] T010 Create git operations wrapper in `.github/agents/shared/git-operations.js`
- [X] T011 [P] Define TypeScript interfaces in `.github/agents/shared/types.ts` (Issue, TriageResult, FixPlan, Commit, PullRequest)
- [X] T012 [P] Implement error handling utilities in `.github/agents/shared/error-handler.js`
- [X] T013 Implement exponential backoff retry logic in `.github/agents/shared/retry.js`

**Checkpoint**: Foundation ready - agent implementation can now begin in parallel

---

## Phase 3: User Story 1 - Automated Issue Triage (Priority: P1) 🎯 MVP

**Goal**: Automatically classify GitHub issues, assess risk, and apply labels within 30 seconds

**Manual Verification**: 
1. Create test issue: "Fix typo in README: 'teh' should be 'the'"
2. Verify labels applied: `auto-triage`, `docs`, `low-risk`
3. Verify comment posted with triage analysis JSON
4. Verify completion within 30 seconds

### Implementation for User Story 1

- [X] T014 [P] [US1] Create triage agent main file in `.github/agents/triage-agent.js`
- [X] T015 [P] [US1] Implement bot detection logic (check for `[bot]` suffix, `created-by-autofix` label)
- [X] T016 [P] [US1] Implement keyword-based classification (BUG/FEATURE/DOCS/CHORE/OTHER)
- [X] T017 [US1] Implement LLM fallback classification for ambiguous issues
- [X] T018 [US1] Implement security constraint checking (keywords, file patterns)
- [X] T019 [US1] Implement affected files identification from issue body
- [X] T020 [US1] Implement risk assessment scoring (file sensitivity + scope multiplier)
- [X] T021 [US1] Implement auto-fix decision logic (LOW risk + no security flags = YES)
- [X] T022 [US1] Format triage result as JSON comment for GitHub issue
- [X] T023 [US1] Apply labels to issue based on classification and risk
- [X] T024 [US1] Create GitHub Actions workflow job for triage in `.github/workflows/auto-fix.yml`
- [X] T025 [US1] Test with sample issues: typo (LOW), security keyword (HIGH), feature request (MEDIUM)

**Checkpoint**: Triage agent fully functional - issues are automatically classified and labeled

---

## Phase 4: User Story 2 - Safe Auto-Fix for Low-Risk Issues (Priority: P1)

**Goal**: Implement fixes for LOW risk issues, create branches, run validation, and generate commits

**Manual Verification**:
1. Create issue: "Fix typo in README: 'teh' → 'the'"
2. Verify PR created within 2 minutes
3. Verify branch name: `docs/42-fix-typo-readme`
4. Verify commit message follows conventional commits
5. Verify validation passed (lint, type-check)

### Planning Sub-Story (US2A)

- [X] T026 [P] [US2] Create planner agent main file in `.github/agents/planner-agent.js`
- [X] T027 [P] [US2] Implement branch name generation (prefix + issue number + slug)
- [X] T028 [US2] Implement LLM-based plan step generation
- [X] T029 [US2] Implement file change analysis (CREATE/MODIFY/DELETE operations)
- [X] T030 [US2] Implement validation command selection based on risk and file types
- [X] T031 [US2] Implement human review check logic (MEDIUM risk, >5 files, COMPLEX)
- [X] T032 [US2] Create GitHub Actions workflow job for planner in `.github/workflows/auto-fix.yml`

### Code Generation Sub-Story (US2B)

- [X] T033 [P] [US2] Create code agent main file in `.github/agents/code-agent.js`
- [X] T034 [P] [US2] Implement git branch creation with idempotency check
- [X] T035 [US2] Implement LLM-based unified diff generation
- [X] T036 [US2] Implement patch application using `git apply --check` then `git apply`
- [X] T037 [US2] Implement validation runner (execute lint, type-check, build commands)
- [X] T038 [US2] Implement rollback logic on validation failure
- [X] T039 [US2] Implement conventional commit message generation
- [X] T040 [US2] Implement git commit and push operations
- [X] T041 [US2] Handle merge conflicts and permission errors gracefully
- [X] T042 [US2] Create GitHub Actions workflow job for code agent in `.github/workflows/auto-fix.yml`
- [X] T043 [US2] Test with docs typo, missing import, and validation failure scenarios

**Checkpoint**: Auto-fix pipeline generates code changes, validates, and creates commits for LOW risk issues

---

## Phase 5: User Story 3 - Security-First Auto-Fix Decision Gate (Priority: P1)

**Goal**: Block auto-fix for security-sensitive changes with zero false negatives

**Manual Verification**:
1. Create issue: "Update API key in .env file"
2. Verify auto-fix blocked (no PR created)
3. Verify labels: `human-review-required`, `security`, `high-risk`
4. Verify comment explains why blocked

### Implementation for User Story 3

- [X] T044 [P] [US3] Add predefined security constraints to `.github/agents/shared/security-constraints.js`
- [X] T045 [P] [US3] Implement keyword pattern matching (password, secret, api key, token)
- [X] T046 [P] [US3] Implement file path pattern matching (.env*, config/secrets/*, *.pem, *.key)
- [X] T047 [US3] Implement change type detection (migration, schema change, binary compilation)
- [X] T048 [US3] Integrate security checks into triage agent risk assessment
- [X] T049 [US3] Add security flag generation to TriageResult
- [X] T050 [US3] Ensure HIGH risk + security flags → auto_fix_decision = HUMAN_REVIEW_REQUIRED
- [X] T051 [US3] Add pre-check in code agent to block security-sensitive file changes
- [X] T052 [US3] Test with: .env change, auth code change, deployment config, database migration

**Checkpoint**: Security gate prevents any auto-fix of sensitive code - 100% block rate for flagged issues

---

## Phase 6: User Story 4 - PR Generation with Test Results (Priority: P2)

**Goal**: Create comprehensive PR descriptions with all required sections and validation results

**Manual Verification**:
1. After auto-fix completes, open created PR
2. Verify PR body contains: Summary, What Changed, Why, Manual Verification, Risk Assessment
3. Verify validation results in collapsible `<details>` section
4. Verify commit list with SHAs
5. Verify issue reference: "Fixes #42"

### Implementation for User Story 4

- [X] T053 [P] [US4] Create PR generator agent main file in `.github/agents/pr-generator.js`
- [X] T054 [P] [US4] Implement PR title generation (Fix/Add/Update #number: title)
- [X] T055 [US4] Implement PR body template formatting with all required sections
- [X] T056 [US4] Format file changes list with change summaries
- [X] T057 [US4] Format validation results as collapsible markdown details
- [X] T058 [US4] Generate manual verification steps based on classification
- [X] T059 [US4] Include rollback instructions with commit SHA
- [X] T060 [US4] Implement suggested reviewers from CODEOWNERS or git blame
- [X] T061 [US4] Implement PR label selection (auto-fix, classification, risk level)
- [X] T062 [US4] Create PR via GitHub API with draft mode logic
- [X] T063 [US4] Apply labels and request reviewers via GitHub API
- [X] T064 [US4] Post success comment on source issue with PR link
- [X] T065 [US4] Handle duplicate PR detection (branch already has PR)
- [X] T066 [US4] Create GitHub Actions workflow job for PR generator in `.github/workflows/auto-fix.yml`
- [X] T067 [US4] Test PR creation for LOW and MEDIUM risk issues

**Checkpoint**: PRs include comprehensive, well-formatted descriptions with all required information

---

## Phase 7: User Story 5 - Manual Review Override for Medium-Risk Issues (Priority: P3)

**Goal**: Create draft PRs for MEDIUM risk issues requiring maintainer approval

**Manual Verification**:
1. Create issue requiring 3-file change: "Update API endpoint path in routes, handlers, types"
2. Verify PR created in DRAFT mode
3. Verify labels include `needs-review`, `medium-risk`
4. Verify comment requests maintainer review
5. Verify suggested reviewers assigned

### Implementation for User Story 5

- [ ] T068 [P] [US5] Implement draft mode logic in PR generator (risk=MEDIUM → draft=true)
- [ ] T069 [P] [US5] Add draft mode warning in PR body for MEDIUM risk
- [ ] T070 [US5] Ensure MEDIUM risk issues trigger human_check_reason in planner
- [ ] T071 [US5] Add `needs-review` label for draft PRs
- [ ] T072 [US5] Post comment on issue explaining MEDIUM risk requires review
- [ ] T073 [US5] Test with multi-file change and API modification scenarios

**Checkpoint**: MEDIUM risk issues generate draft PRs with clear review requirements

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, rate limiting, monitoring, and edge case coverage

- [ ] T074 [P] Implement GitHub API rate limit handling with exponential backoff
- [ ] T075 [P] Add structured logging to all agents (JSON output to stderr)
- [ ] T076 [P] Implement timeout handling for LLM API calls
- [ ] T077 [P] Add retry logic for transient GitHub API failures
- [ ] T078 Implement automation-failed label and comment on errors
- [ ] T079 [P] Handle ambiguous issue classification (mark as OTHER, request clarification)
- [ ] T080 [P] Handle validation failure with detailed error comment
- [ ] T081 Handle merge conflicts in code agent with graceful degradation
- [ ] T082 [P] Add workflow timeout limits (30s triage, 60s plan, 120s code, 30s PR)
- [ ] T083 [P] Implement idempotency checks (skip if already processed, update if needed)
- [ ] T084 Add workflow_dispatch trigger for manual testing
- [ ] T085 Create quickstart documentation for repository setup
- [ ] T086 Create label creation script or documentation
- [ ] T087 Add cost monitoring and estimation logging
- [ ] T088 Final end-to-end manual verification with diverse issue types

**Checkpoint**: System handles edge cases, errors, and rate limits gracefully

---

## Implementation Strategy

### MVP Scope (Minimum Viable Product)

**Goal**: Get core value with minimal scope  
**Includes**: Phase 1, 2, 3, 4 (User Stories 1 & 2)  
**Delivers**: Auto-triage + auto-fix for LOW risk issues only  
**Time Estimate**: ~3-5 days

### Phase 2 Expansion

**Adds**: Phase 5, 6 (User Stories 3 & 4)  
**Delivers**: Security gates + comprehensive PR descriptions  
**Time Estimate**: +2-3 days

### Full Feature

**Adds**: Phase 7, 8 (User Story 5 + polish)  
**Delivers**: MEDIUM risk support + production-ready error handling  
**Time Estimate**: +1-2 days

**Total Estimate**: 6-10 days full implementation

---

## Dependency Graph

```
Phase 1 (Setup)
  ↓
Phase 2 (Foundational) ← BLOCKING: Must complete before user stories
  ↓
┌─────────────────────────────────────────────────────┐
│ Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3)      │ ← Can implement in sequence
│                      ↓                               │    or partially parallel
│                 Phase 6 (US4) → Phase 7 (US5)       │
└─────────────────────────────────────────────────────┘
  ↓
Phase 8 (Polish) ← Final cleanup and error handling
```

**User Story Dependencies**:
- US1 (Triage) → Blocks US2 (needs triage output)
- US2 (Auto-fix) → Blocks US4 (needs commits for PR)
- US3 (Security) → Integrates into US1 (modifies triage logic)
- US4 (PR Gen) → Depends on US2 (needs commits)
- US5 (MEDIUM) → Extends US4 (draft mode variant)

---

## Parallel Execution Opportunities

### Phase 2 (Foundational)
Can parallelize: T007, T008, T009, T011, T012 (different files, no cross-dependencies)

### Phase 3 (US1 - Triage)
Can parallelize: T014, T015, T016 (independent logic modules)
Sequential: T017-T025 (build on each other)

### Phase 4 (US2 - Auto-fix)
Can parallelize Sub-stories:
- **US2A (Planner)**: T026-T032
- **US2B (Code)**: Can start T033-T034 while planner in progress

### Phase 5 (US3 - Security)
Can parallelize: T044, T045, T046, T047 (independent constraint definitions)

### Phase 6 (US4 - PR Generator)
Can parallelize: T053, T054, T055, T060, T061 (independent formatters)

### Phase 8 (Polish)
Can parallelize: T074, T075, T076, T077, T079, T080, T082, T083 (cross-cutting concerns)

---

## Manual Verification Checklist

After completing each phase, manually verify:

### After Phase 3 (Triage)
- [ ] Create test issue with typo → Labels applied within 30s
- [ ] Create test issue with security keyword → Blocked, HIGH risk
- [ ] Create test issue with ambiguous title → Classified as OTHER

### After Phase 4 (Auto-fix)
- [ ] Docs typo issue → PR created within 2 minutes
- [ ] Missing import issue → PR with valid TypeScript fix
- [ ] Linting error issue → Rollback, automation-failed label

### After Phase 5 (Security)
- [ ] .env change issue → Blocked, human-review-required
- [ ] Auth file change → HIGH risk, security label
- [ ] Database migration → Blocked with explanation

### After Phase 6 (PR Generator)
- [ ] PR body has all sections (Summary, What Changed, Why, etc.)
- [ ] Validation results in collapsible details
- [ ] Reviewers assigned based on CODEOWNERS

### After Phase 7 (MEDIUM Risk)
- [ ] Multi-file issue → Draft PR created
- [ ] API change → needs-review label applied

### After Phase 8 (Polish)
- [ ] Rate limit hit → Exponential backoff works
- [ ] API timeout → Graceful error handling
- [ ] Concurrent issues → All processed correctly

---

## Task Counts by Phase

| Phase | Task Count | Parallelizable | Estimated Time |
|-------|------------|----------------|----------------|
| Phase 1: Setup | 5 | 3 (60%) | 2-4 hours |
| Phase 2: Foundational | 8 | 6 (75%) | 1-2 days |
| Phase 3: US1 (Triage) | 12 | 3 (25%) | 1-2 days |
| Phase 4: US2 (Auto-fix) | 18 | 4 (22%) | 2-3 days |
| Phase 5: US3 (Security) | 9 | 4 (44%) | 0.5-1 day |
| Phase 6: US4 (PR Gen) | 15 | 5 (33%) | 1-2 days |
| Phase 7: US5 (MEDIUM) | 6 | 2 (33%) | 0.5-1 day |
| Phase 8: Polish | 15 | 10 (67%) | 1-2 days |
| **TOTAL** | **88 tasks** | **37 parallel (42%)** | **6-10 days** |

---

## Notes

- **No Testing**: Per Constitution Principle V, zero test tasks created. All verification is manual.
- **Story-Centric**: Tasks organized by user story for independent delivery and verification.
- **Constitution Deviation**: Approved use of Node.js + GitHub Actions instead of Vue + Tailwind (backend automation, not frontend app).
- **Security First**: User Story 3 validates core safety requirement before expanding features.
- **Incremental**: Each phase delivers working, verifiable functionality.
- **Parallel Opportunities**: 42% of tasks can run in parallel (37 of 88 tasks).

---

**Generated**: 2025-12-02  
**Feature Branch**: 001-github-auto-fix  
**Ready for**: `/speckit.implement` command or manual implementation
