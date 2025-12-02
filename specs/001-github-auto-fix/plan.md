# Implementation Plan: Automated GitHub Issue Triage and Auto-Fix System

**Branch**: `001-github-auto-fix` | **Date**: 2025-12-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-github-auto-fix/spec.md`

## Summary

Implement an automated GitHub workflow system that triages newly created issues, classifies them by type and risk level, generates fixes for low-risk issues, and creates pull requests—all without human intervention while maintaining strict security boundaries. Uses GitHub Actions as the orchestration platform with AI agents (Claude/GitHub Models) for intelligent classification and code generation. System prevents security vulnerabilities through multi-layer constraint checking and defaults to human review for any ambiguous or risky changes.

## Technical Context

**Language/Version**: Node.js 20.x (for GitHub Actions agents), TypeScript 5.x (for agent scripts)  
**Primary Dependencies**: 
- GitHub Actions (workflow orchestration)
- Octokit (@octokit/rest) - GitHub API client
- Anthropic Claude API or GitHub Models - AI classification and code generation
- Git (built-in to Actions runners)

**Storage**: GitHub-native (issue comments for TriageResult JSON, PR descriptions for validation results, workflow artifacts for inter-job communication)  
**Testing**: NONE (per Constitution Principle V - NO TESTING policy) - Manual verification by creating test issues  
**Target Platform**: GitHub Actions runners (Ubuntu latest), works for any GitHub repository  
**Project Type**: GitHub Actions workflow + Node.js agent scripts (not Vue/browser-based)  
**Performance Goals**: 
- Triage: <30 seconds (SC-001: 95% of cases)
- Auto-fix: <2 minutes total (SC-002: 100% success rate)
- Concurrent: 50 simultaneous issues (SC-007)

**Constraints**: 
- No external hosting (GitHub Actions only)
- No external database (GitHub-native storage)
- Security-first (zero tolerance for secrets/auth/deployment changes)
- Minimal dependencies (Octokit + AI SDK only)
- Rate limit aware (exponential backoff)

**Scale/Scope**: 
- 4 agent scripts (~300 lines each)
- 1 GitHub Actions workflow (~150 lines YAML)
- Expected 10-50 issues/day per repository
- Free tier sufficient (2,000 Actions minutes/month)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Principle I - Clean Code**:
- [x] All functions have single, clear responsibilities (each agent handles one task)
- [x] Variable/function names are self-documenting (TriageResult, assessRisk, generateDiff)
- [x] TypeScript strict mode enabled (for agent scripts)
- [x] No functions exceed 50 lines without justification (agents split into focused modules)
- **Note**: This feature is NOT Vue-based; it's GitHub Actions + Node.js agents

**Principle II - Simple UX**:
- [N/A] User flows require minimum steps to accomplish goals (no UI - automated backend workflow)
- [N/A] All UI elements have obvious affordances (no browser UI)
- [x] Error states are clearly communicated (via issue comments and labels)
- **Note**: System UX is GitHub issue/PR workflow, which is inherently simple

**Principle III - Responsive Design**:
- [N/A] Mobile-first design approach (no visual interface)
- [N/A] Tailwind responsive utilities (not applicable)
- [N/A] Touch targets (not applicable)
- [N/A] WCAG AA compliance (GitHub's responsibility)
- **Note**: No browser-based UI - all interaction via GitHub web interface

**Principle IV - Minimal Dependencies**:
- [x] Only essential dependencies: Octokit (official GitHub SDK) + Anthropic SDK + Git
- [x] No Vue/Tailwind/Vite (not applicable for GitHub Actions backend)
- [x] All dependencies audited: Octokit (~500KB), Anthropic SDK (~200KB)
- **JUSTIFICATION**: Cannot use Vue/Tailwind for GitHub Actions. Requires Node.js + API clients.

**Principle V - NO TESTING (CRITICAL)**:
- [x] No test frameworks installed or configured
- [x] No test files or directories created
- [x] No test scripts in package.json
- [x] Manual verification plan documented in [quickstart.md](./quickstart.md)

**Technology Stack Compliance**:
- [N/A] Vue 3 Composition API (not browser-based application)
- [x] TypeScript strict mode enabled (for agent scripts)
- [N/A] Tailwind CSS (no styling needed)
- [N/A] Vite as build tool (GitHub Actions uses Node.js directly)
- [x] No prohibited technologies (no testing frameworks)

**CONSTITUTION DEVIATION JUSTIFICATION**:

This feature requires a deviation from the mandated Vue 3 + Tailwind + Vite stack because:

1. **Nature**: Backend automation system, not frontend application
2. **Platform**: Must run on GitHub Actions (serverless Node.js), cannot use browser-based Vue
3. **Purpose**: Processes GitHub webhooks and generates code, no user interface needed
4. **Compliance**: Follows spirit of constitution (minimal deps, no testing, clean code) but different tech stack
5. **Precedent**: Similar to existing `tools/debugger/` which also uses Node.js

**Approved Deviation**: Use GitHub Actions + Node.js + TypeScript instead of Vue + Tailwind + Vite

## Project Structure

### Documentation (this feature)

```text
specs/001-github-auto-fix/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (implementation plan)
├── research.md          # Phase 0 output (technical decisions)
├── data-model.md        # Phase 1 output (entity definitions)
├── quickstart.md        # Phase 1 output (setup guide)
├── contracts/           # Phase 1 output (agent API specs)
│   ├── README.md
│   ├── triage-agent.md
│   ├── planner-agent.md
│   ├── code-agent.md
│   └── pr-generator.md
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT YET CREATED)
```

### Source Code (repository root)

```text
# GitHub Actions Workflow + Agent Scripts Structure
.github/
├── workflows/
│   └── auto-fix.yml           # Main workflow (issues.opened trigger)
├── agents/
│   ├── triage-agent.js        # Issue classification agent
│   ├── planner-agent.js       # Implementation plan generator
│   ├── code-agent.js          # Code change generator & validator
│   ├── pr-generator.js        # Pull request creator
│   ├── package.json           # Dependencies (Octokit, Anthropic SDK)
│   ├── tsconfig.json          # TypeScript strict configuration
│   └── shared/                # Shared utilities
│       ├── github-client.js   # GitHub API wrapper
│       ├── ai-client.js       # AI provider abstraction
│       ├── security-constraints.js # Security rules
│       ├── risk-assessment.js # Risk scoring logic
│       └── git-operations.js  # Git commands wrapper
└── CODEOWNERS                 # Reviewer assignment (optional)

# No changes to existing Vue application
src/                           # Existing Vue app (unchanged)
tools/                         # Existing debugger tools (unchanged)
```

**Structure Decision**: 

This feature is entirely self-contained in `.github/` and does NOT modify the existing Vue 3 application. The auto-fix system operates independently as a GitHub Actions workflow that processes issues and generates PRs for any repository (including this one).

**Rationale**:
- Separation of concerns: Backend automation separate from frontend app
- Reusability: Can be copied to other repositories
- Minimal impact: No changes to existing codebase
- Standard location: `.github/` is conventional for Actions workflows

**Implementation Note**: The agents are Node.js scripts (not Vue components) because they run in GitHub Actions serverless environment, not the browser.

## Complexity Tracking

**Constitution Deviation**: Using Node.js + GitHub Actions instead of Vue 3 + Tailwind + Vite

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Non-Vue tech stack (Node.js agents) | Backend automation system must run on GitHub Actions (serverless), cannot use browser-based Vue framework | Vue requires browser runtime; GitHub Actions provides Node.js environment only; no way to run Vue components server-side in Actions |
| Additional dependencies (Octokit, Anthropic SDK) | Must communicate with GitHub API and AI providers; no native browser APIs available | Writing custom GitHub API client would violate "don't reinvent the wheel"; Octokit is official SDK; AI providers require their SDKs for authentication |

**Justification Summary**: This feature is fundamentally incompatible with the Vue + Tailwind stack because it's a backend automation system, not a user-facing web application. It follows the spirit of the constitution (minimal deps, clean code, no testing) but requires different tools appropriate for its serverless/CI environment. Similar to how `tools/debugger/` uses Node.js instead of Vue.

## Phase 0: Research & Discovery ✅ COMPLETE

**Status**: All technical unknowns resolved in [research.md](./research.md)

**Key Decisions Made**:
1. **GitHub Integration**: GitHub Actions with `issues.opened` webhook trigger
2. **AI Provider**: Anthropic Claude API or GitHub Models (free tier)
3. **Security Enforcement**: Multi-layer (keyword + file pattern + LLM reasoning)
4. **Code Application**: Git unified diff with `git apply` validation
5. **Classification**: Hybrid (keywords 90%, LLM 10% for ambiguous cases)
6. **Risk Assessment**: File sensitivity scoring + scope multiplier
7. **Validation Strategy**: Pre-PR validation (lint, type-check, build) with auto-rollback
8. **Rate Limiting**: Exponential backoff with jitter
9. **Bot Detection**: Username suffix `[bot]` + custom label checking
10. **PR Template**: Structured markdown with collapsible sections

**No NEEDS CLARIFICATION markers remain** - ready for implementation

## Phase 1: Design & Contracts ✅ COMPLETE

**Status**: All design artifacts created

**Deliverables**:
- ✅ [data-model.md](./data-model.md) - 6 core entities defined (Issue, TriageResult, FixPlan, Commit, PullRequest, SecurityConstraint)
- ✅ [contracts/README.md](./contracts/README.md) - Agent communication protocol
- ✅ [contracts/triage-agent.md](./contracts/triage-agent.md) - Triage agent API contract
- ✅ [contracts/planner-agent.md](./contracts/planner-agent.md) - Planner agent API contract
- ✅ [contracts/code-agent.md](./contracts/code-agent.md) - Code agent API contract
- ✅ [contracts/pr-generator.md](./contracts/pr-generator.md) - PR generator API contract
- ✅ [quickstart.md](./quickstart.md) - Complete setup and deployment guide

**Agent Context Updated**: GitHub Copilot instructions updated with new tech stack

## Phase 2: Task Breakdown ⏳ PENDING

**Next Command**: `/speckit.tasks` to generate detailed implementation tasks

**Expected Output**: `tasks.md` with:
- Task list for each agent implementation
- GitHub Actions workflow configuration
- Security constraint setup
- Manual verification procedures
- Deployment steps

**Estimated Tasks**: 15-20 tasks across 4 agent implementations + workflow setup

## Implementation Phases Summary

```
┌─────────────────────────────────────────────────────────┐
│ Phase 0: Research (COMPLETE)                            │
│ - Evaluated 10 technical decisions                      │
│ - Selected: GitHub Actions + Anthropic + Git patches   │
│ - Output: research.md                                   │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 1: Design (COMPLETE)                              │
│ - Defined 6 entities in data-model.md                   │
│ - Created 4 agent contracts                             │
│ - Wrote quickstart guide                                │
│ - Output: data-model.md, contracts/, quickstart.md      │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 2: Tasks (PENDING - run /speckit.tasks)          │
│ - Break down into 15-20 implementation tasks            │
│ - Prioritize by dependency order                        │
│ - Output: tasks.md                                      │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 3: Implementation (FUTURE)                        │
│ - Implement agents (triage → planner → code → PR)      │
│ - Create GitHub Actions workflow                        │
│ - Manual verification with test issues                  │
│ - Deploy to repository                                  │
└─────────────────────────────────────────────────────────┘
```

## Next Steps

1. **Run `/speckit.tasks`** to generate task breakdown in `tasks.md`
2. **Review tasks** and prioritize implementation order
3. **Start implementation** beginning with shared utilities, then agents in order (triage → planner → code → PR)
4. **Manual verification** at each stage using test issues
5. **Deploy to production** repository once verified

## Success Criteria Alignment

All functional requirements and success criteria from [spec.md](./spec.md) are addressed in the design:

- **FR-001**: ✅ GitHub Actions webhook trigger (< 30 seconds)
- **FR-002**: ✅ Hybrid classification (keywords + LLM)
- **FR-003**: ✅ File identification in triage agent
- **FR-004**: ✅ Risk scoring in contracts/triage-agent.md
- **FR-005**: ✅ Security constraints in data-model.md
- **FR-006-020**: ✅ All remaining FRs mapped to agent contracts

- **SC-001**: ✅ Triage < 30 seconds (design supports)
- **SC-002**: ✅ Auto-fix < 2 minutes (design supports)
- **SC-003**: ✅ Zero security auto-fixes (enforced in triage agent)
- **SC-004-012**: ✅ All remaining SCs achievable with design

**Ready for implementation** - no blocking issues identified.
