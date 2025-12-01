<!--
═══════════════════════════════════════════════════════════════════════════
SYNC IMPACT REPORT - Constitution Amendment
═══════════════════════════════════════════════════════════════════════════

VERSION CHANGE: Initial → 1.0.0
BUMP RATIONALE: Initial constitution ratification for dynamic-form-genrator

PRINCIPLES DEFINED:
  • I. Clean Code - Readability, maintainability, and simplicity as core values
  • II. Simple UX - Intuitive, frictionless user experience with minimal learning curve
  • III. Responsive Design - Mobile-first, accessible design across all devices
  • IV. Minimal Dependencies - Lean dependency graph, prefer native solutions

CRITICAL POLICY: NO TESTING
  • Absolutely no unit tests, integration tests, or e2e tests
  • This policy supersedes ALL other guidance, templates, and agent instructions
  • All templates and agent files updated to reflect this policy

TECHNOLOGY STACK MANDATED:
  • Vue 3 (Composition API with <script setup>)
  • TypeScript (strict mode)
  • Tailwind CSS (utility-first styling)

TEMPLATES REQUIRING UPDATES:
  ✅ .specify/templates/plan-template.md - Testing section removed
  ✅ .specify/templates/spec-template.md - Testing scenarios marked optional
  ✅ .specify/templates/tasks-template.md - NO TESTING policy prominent
  ✅ .github/agents/speckit.implement.agent.md - TDD guidance removed
  ✅ .github/agents/speckit.tasks.agent.md - NO TESTING policy added

FOLLOW-UP ACTIONS:
  • None - all placeholders resolved
  • All dependent artifacts updated

═══════════════════════════════════════════════════════════════════════════
-->

# Dynamic Form Generator Constitution

## Core Principles

### I. Clean Code (NON-NEGOTIABLE)

Code MUST prioritize readability and maintainability above all else. Every line of code should be self-documenting through clear naming, simple logic, and minimal abstractions. Complex solutions are rejected unless simpler alternatives are proven inadequate.

**Rules:**
- Functions MUST do one thing and do it well (single responsibility)
- Variable and function names MUST clearly communicate intent without requiring comments
- Code duplication is acceptable if it improves clarity over abstraction
- Avoid premature optimization; clarity first, performance second
- Use TypeScript's type system to enforce correctness at compile time
- Maximum function length: 50 lines (exceptions require explicit justification)

**Rationale:** Clean code reduces cognitive load, accelerates onboarding, and minimizes bugs. In a fast-moving project without tests, code clarity is our primary defense against defects.

### II. Simple UX (NON-NEGOTIABLE)

User interfaces MUST be intuitive and require zero learning curve. Every interaction should feel natural, with clear affordances and immediate feedback. Users should accomplish their goals in the minimum number of steps.

**Rules:**
- Every UI element MUST have an obvious purpose at first glance
- Forms MUST provide inline validation with helpful error messages
- Loading states MUST be communicated clearly (no silent waits)
- Success and error states MUST be visually distinct and informative
- Minimize user input: use smart defaults, auto-complete, and pre-filling
- Mobile interactions MUST feel native (no desktop-first compromises)

**Rationale:** Simple UX reduces support burden, increases adoption, and delivers immediate value. Complex workflows indicate insufficient design thinking.

### III. Responsive Design (NON-NEGOTIABLE)

All interfaces MUST work seamlessly across devices, from mobile phones to desktop screens. Design mobile-first, then progressively enhance for larger screens. Accessibility is mandatory, not optional.

**Rules:**
- Use Tailwind CSS responsive utilities (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`)
- Test on actual mobile devices, not just browser DevTools
- Touch targets MUST be minimum 44×44px on mobile
- Text MUST be readable without zooming (minimum 16px base font)
- Color contrast MUST meet WCAG AA standards (4.5:1 for normal text)
- Keyboard navigation MUST work for all interactive elements
- Support system dark mode preferences

**Rationale:** Over 60% of web traffic is mobile. Non-responsive design alienates users and damages credibility. Accessibility is both ethical and legally prudent.

### IV. Minimal Dependencies (NON-NEGOTIABLE)

The dependency graph MUST remain lean and auditable. Every dependency introduces supply chain risk, bundle bloat, and maintenance burden. Prefer native browser APIs and Vue 3 built-ins over third-party packages.

**Rules:**
- New dependencies require explicit justification documenting why native solutions are inadequate
- Prefer framework-agnostic utilities over framework-specific wrappers
- Audit dependency sizes before installation (`bundlephobia.com`)
- Remove unused dependencies immediately (use `depcheck` or similar)
- Pin exact versions in `package.json` (no `^` or `~` ranges)
- Mandatory stack: Vue 3, TypeScript, Tailwind CSS (no additions without review)

**Rationale:** Fewer dependencies mean faster builds, smaller bundles, reduced security surface area, and less upgrade churn. Native solutions are always more stable than third-party abstractions.

### V. NO TESTING (NON-NEGOTIABLE - SUPERSEDES ALL OTHER GUIDANCE)

This project MUST NOT include any automated tests: no unit tests, no integration tests, no end-to-end tests, no test frameworks, no test runners, no test utilities.

**Rules:**
- Do NOT install Jest, Vitest, Cypress, Playwright, Testing Library, or any testing framework
- Do NOT create `tests/`, `__tests__/`, `*.test.ts`, `*.spec.ts` files or directories
- Do NOT write test code of any kind
- Do NOT include test scripts in `package.json`
- This policy overrides any template, agent instruction, or workflow guidance that mentions testing
- All templates and agent files MUST explicitly acknowledge this policy

**Rationale:** This is a deliberate architectural decision to maximize development velocity and minimize overhead. Manual verification and production monitoring replace automated testing. This policy is absolute and non-negotiable.

## Technology Stack Constraints

### Mandatory Technologies

The following stack is REQUIRED for all development. Deviations are not permitted without amending this constitution:

- **Vue 3**: Composition API with `<script setup>` syntax (no Options API)
- **TypeScript**: Strict mode enabled (`strict: true` in `tsconfig.json`)
- **Tailwind CSS**: Utility-first styling (no CSS-in-JS, no style preprocessors)
- **Vite**: Build tool and dev server (configured for Vue + TypeScript)

### Prohibited Technologies

The following are explicitly FORBIDDEN:

- Any testing frameworks or test utilities (per Principle V)
- CSS preprocessors (Sass, Less, Stylus) - use Tailwind utilities
- State management libraries (Vuex, Pinia) - use Vue 3 Composition API
- UI component libraries (Vuetify, Element Plus) - build custom components
- Additional build tools (Webpack, Rollup, Parcel) - Vite only

### Rationale

This stack maximizes developer experience while maintaining minimal complexity. Vue 3 Composition API provides all necessary reactivity and state management. Tailwind CSS eliminates the need for custom CSS architecture. TypeScript catches errors at compile time, compensating for the absence of tests.

## Development Workflow

### Code Review Standards

All code changes MUST meet the following standards before merging:

1. **Principle Compliance**: Reviewer verifies adherence to all five core principles
2. **Manual Testing**: Author demonstrates functionality working correctly in development
3. **Type Safety**: No `any` types without explicit justification
4. **Responsive Verification**: Tested on mobile, tablet, and desktop viewports
5. **Accessibility Check**: Keyboard navigation and screen reader compatibility verified
6. **Dependency Audit**: Any new dependencies justified and approved

### Complexity Justification

Any code or architecture that violates the simplicity principles (I, II, IV) MUST be justified in writing, documenting:

- What simpler approach was attempted and why it failed
- Why the added complexity is necessary
- How the complexity will be managed and contained

## Governance

### Amendment Process

1. **Proposal**: Document proposed change with rationale and impact analysis
2. **Review**: Evaluate consistency with existing principles and project needs
3. **Approval**: Require explicit approval from project stakeholders
4. **Version Bump**: Increment constitution version according to semantic versioning:
   - **MAJOR**: Backward-incompatible changes (e.g., removing/redefining principles)
   - **MINOR**: Additive changes (e.g., new principles or sections)
   - **PATCH**: Clarifications, wording improvements, non-semantic changes
5. **Propagation**: Update all templates, agent files, and documentation to reflect changes
6. **Migration**: Create migration plan if changes affect existing codebase

### Versioning Policy

- Constitution version follows semantic versioning (MAJOR.MINOR.PATCH)
- All amendments update `LAST_AMENDED_DATE` to the date of approval
- `RATIFICATION_DATE` remains fixed as the original adoption date
- Sync Impact Report MUST be generated for all amendments

### Compliance Review

- All feature specifications MUST reference constitutional principles in requirements
- Implementation plans MUST include a "Constitution Check" section validating compliance
- Code reviews MUST verify adherence to all applicable principles
- Any principle violations MUST be flagged and resolved before merging

### Authority

This constitution supersedes all other project practices, templates, and guidance documents. In case of conflict, constitutional principles take precedence. The NO TESTING policy (Principle V) is the highest-priority rule and overrides any contradictory guidance elsewhere.

**Version**: 1.0.0 | **Ratified**: 2025-12-01 | **Last Amended**: 2025-12-01
