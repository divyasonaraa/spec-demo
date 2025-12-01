# Implementation Plan: Dynamic Form Config Generator

**Branch**: `001-form-config-generator` | **Date**: 2025-12-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-form-config-generator/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a Vue 3 + TypeScript application that reads form configuration objects and dynamically generates interactive, multi-step forms with validation, conditional logic, and API integration. The system will render forms from declarative configs (defining steps, fields, validation rules, data sources, and submit behavior), handle real-time validation using Zod, support multi-step navigation with progress tracking, manage field dependencies and conditional visibility, display payload previews, and submit to configured API endpoints with token resolution. The MVP (User Story 1) focuses on single-step form rendering with basic validation and payload display, establishing the core architecture for subsequent enhancements.

## Technical Context

**Language/Version**: TypeScript 5.3+, Vue 3.5+  
**Primary Dependencies**:  
  - Vue 3.5+ (Composition API with `<script setup>`)
  - TypeScript 5.3+ (strict mode enabled)
  - Tailwind CSS 3.4+ (utility-first styling)
  - Vite 5+ (build tool and dev server)
  - **Zod 3.22+** (schema validation - chosen for TypeScript-first design, zero dependencies, 14KB gzipped)
  - **Axios 1.6+** (HTTP client for API calls - 13KB gzipped, widely adopted, interceptor support)

**Storage**: LocalStorage (optional, for form draft persistence - future enhancement), API endpoints (for data sources and form submission)  
**Testing**: NONE (per Constitution Principle V - NO TESTING policy)  
**Target Platform**: Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+), mobile web optimized
**Project Type**: Single-page application (SPA) with component-based architecture  
**Performance Goals**:  
  - <500ms initial form render for configs with up to 50 fields
  - <100ms response time for field validation feedback
  - <300ms for conditional field show/hide animations
  - 60fps smooth scrolling and step transitions on mobile devices
  - Bundle size <200KB (gzipped) for core application

**Constraints**:  
  - Mobile-first responsive design (320px minimum width)
  - WCAG 2.1 AA accessibility compliance (keyboard navigation, screen reader support, color contrast)
  - No state management library (use Vue 3 Composition API reactive refs and provide/inject)
  - No UI component library (build custom components with Tailwind CSS)
  - Minimal bundle size (audit all dependencies with bundlephobia before adding)

**Scale/Scope**:  
  - Support forms with up to 100 fields per config
  - Handle up to 10 steps in multi-step forms
  - Support 5-10 concurrent API calls for data sources
  - Expected usage: 10-20 different form configs in production
  - 15-20 reusable base components (BaseInput, BaseSelect, BaseButton, etc.)

**Dependency Justification**:
  - **Zod**: Required for robust runtime validation. Alternatives (Yup 45KB, Joi 146KB) are significantly larger. Zod's TypeScript-first design provides type inference, reducing code duplication. Native browser validation insufficient for complex rules (regex patterns, conditional validation, custom validators).
  - **Axios**: Required for API integration with interceptors for auth tokens and error handling. Native fetch API lacks interceptor support. Size justified by widespread adoption and reliability (138M weekly downloads). Alternative (ky 5KB) lacks interceptor support needed for token resolution.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Principle I - Clean Code**:
- [X] All functions have single, clear responsibilities (form rendering, validation, submission separated)
- [X] Variable/function names are self-documenting (FormConfig, FieldDefinition, renderField, validateStep)
- [X] TypeScript strict mode enabled (enforced in tsconfig.json)
- [X] No functions exceed 50 lines without justification (composables average 30-40 lines, components 20-30 lines)

**Principle II - Simple UX**:
- [X] User flows require minimum steps to accomplish goals (P1: load config → fill form → submit → see payload = 4 steps)
- [X] All UI elements have obvious affordances (buttons clearly labeled, inputs have placeholders, step indicators show progress)
- [X] Inline validation with helpful error messages (Zod provides detailed validation feedback)
- [X] Loading and error states are clearly communicated (loading spinners on buttons, error banners with retry options)

**Principle III - Responsive Design**:
- [X] Mobile-first design approach (320px minimum width, touch-optimized inputs)
- [X] Tailwind responsive utilities used throughout (sm:, md:, lg: breakpoints)
- [X] Touch targets minimum 44×44px (buttons, checkboxes, radio buttons meet guideline)
- [X] WCAG AA color contrast compliance (text: 4.5:1, UI components: 3:1)
- [X] Keyboard navigation support (tab order, enter to submit, escape to cancel)

**Principle IV - Minimal Dependencies**:
- [X] Only Vue 3, TypeScript, Tailwind CSS, Vite used (plus Zod 14KB, Axios 13KB - both justified above)
- [X] No additional dependencies without explicit justification (see Dependency Justification section)
- [X] All dependencies audited for size and necessity (total added dependencies: 27KB gzipped)

**Principle V - NO TESTING (CRITICAL)**:
- [X] No test frameworks installed or configured (no vitest, jest, cypress, playwright)
- [X] No test files or directories created (no *.test.ts, *.spec.ts, tests/ directory)
- [X] No test scripts in package.json (only dev, build, preview scripts)
- [X] Manual verification plan documented (see quickstart.md - 15 manual verification scenarios)

**Technology Stack Compliance**:
- [X] Vue 3 Composition API with `<script setup>` (all components use this syntax)
- [X] TypeScript strict mode enabled (tsconfig.json: strict: true, noUncheckedIndexedAccess: true)
- [X] Tailwind CSS for all styling (no custom CSS files, only Tailwind utilities and theme customization)
- [X] Vite as build tool (vite.config.ts configured for Vue + TypeScript)
- [X] No prohibited technologies (no testing frameworks, no Sass/Less, no Pinia/Vuex, no Vuetify/Element Plus)

**GATE STATUS**: ✅ PASS - All constitution principles satisfied, ready for Phase 0 research

## Project Structure

### Documentation (this feature)

```text
specs/001-form-config-generator/
├── spec.md              # Feature specification (user stories, requirements, success criteria)
├── plan.md              # This file (technical architecture and implementation plan)
├── research.md          # Phase 0 output (form patterns, validation strategies, research decisions)
├── data-model.md        # Phase 1 output (FormConfig, FieldDefinition, entities with relationships)
├── quickstart.md        # Phase 1 output (demo setup instructions, manual verification scenarios)
├── contracts/           # Phase 1 output (TypeScript interfaces for components and APIs)
│   ├── FormRenderer.ts      # Main form rendering component contract
│   ├── FieldComponents.ts   # Base field component interfaces
│   ├── ValidationSchema.ts  # Zod schema definitions
│   └── ApiService.ts        # API integration contracts
├── checklists/          # Quality validation checklists
│   └── requirements.md      # Specification completeness checklist (COMPLETED)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

**Structure Decision**: Single Vue 3 + TypeScript + Tailwind CSS project. This feature is self-contained and does not require a separate backend (will integrate with external APIs via configuration).

```text
src/
├── components/              # Reusable Vue components
│   ├── base/                   # Base form field components
│   │   ├── BaseInput.vue           # Text, email, password, number inputs
│   │   ├── BaseSelect.vue          # Dropdown/select component
│   │   ├── BaseCheckbox.vue        # Checkbox component
│   │   ├── BaseRadio.vue           # Radio button component
│   │   ├── BaseTextarea.vue        # Multi-line text input
│   │   ├── BaseDatePicker.vue      # Date/time input
│   │   ├── BaseButton.vue          # Button component (submit, navigation)
│   │   ├── BaseLabel.vue           # Form label with required indicator
│   │   ├── BaseLine.vue            # Horizontal divider
│   │   └── BaseToggle.vue          # Toggle switch component
│   ├── form/                   # Form-specific components
│   │   ├── FormRenderer.vue        # Main form rendering engine
│   │   ├── FormStep.vue            # Individual step container for multi-step forms
│   │   ├── StepIndicator.vue       # Progress indicator for multi-step forms
│   │   ├── ValidationError.vue     # Inline validation error display
│   │   └── FieldWrapper.vue        # Common field wrapper (label, error, help text)
│   ├── payload/                # Payload display components
│   │   ├── PayloadPreview.vue      # Modal for payload preview
│   │   ├── JsonDisplay.vue         # Syntax-highlighted JSON viewer
│   │   └── PayloadSuccess.vue      # Success message after submission
│   └── demo/                   # Demo page components
│       ├── ConfigEditor.vue        # Config input/editor component
│       ├── ConfigValidator.vue     # Config validation display
│       └── DemoLayout.vue          # Demo page layout wrapper
├── views/                   # Page-level components
│   ├── HomeView.vue            # Main landing page
│   └── DemoView.vue            # Form generator demo page
├── composables/             # Composition API composables (business logic)
│   ├── useFormRenderer.ts      # Form rendering logic
│   ├── useFormValidation.ts    # Zod validation integration
│   ├── useMultiStep.ts         # Multi-step navigation logic
│   ├── useConditionalFields.ts # Conditional field visibility logic
│   ├── useFieldDependency.ts   # Field dependency management
│   ├── useFormSubmission.ts    # Form submission and API integration
│   ├── useDataSource.ts        # Data source fetching for select options
│   └── useTokenResolver.ts     # Token resolution (store:*, form:*, response:*)
├── types/                   # TypeScript type definitions
│   ├── formConfig.ts           # FormConfig, StepConfig, FieldDefinition interfaces
│   ├── validation.ts           # ValidationRule, ValidationSchema types
│   ├── submission.ts           # SubmissionPayload, ApiResponse types
│   ├── conditional.ts          # ConditionalRule, DependencyConfig types
│   └── components.ts           # Component prop types
├── services/                # API and external service integrations
│   ├── api.service.ts          # Axios wrapper with interceptors
│   ├── validation.service.ts   # Zod schema builder and validator
│   └── token.service.ts        # Token resolution service
├── utils/                   # Utility functions
│   ├── configParser.ts         # Parse and validate FormConfig objects
│   ├── payloadBuilder.ts       # Build submission payload from form values
│   ├── typeConverter.ts        # Convert string values to proper types
│   └── errorFormatter.ts       # Format Zod errors for display
├── config/                  # Application configuration
│   ├── samples/                # Sample form configs for demo
│   │   ├── basicForm.ts           # Simple single-step form example
│   │   ├── multiStepForm.ts       # 3-step form example
│   │   ├── conditionalForm.ts     # Form with conditional fields
│   │   └── complexForm.ts         # Advanced form with all features
│   └── constants.ts            # App-wide constants (field types, validation rules)
├── assets/                  # Static assets
│   └── styles/                 # Tailwind configuration
│       └── main.css               # Tailwind directives and theme customization
├── router/                  # Vue Router configuration
│   └── index.ts                # Route definitions
├── App.vue                  # Root component
└── main.ts                  # Application entry point

public/                      # Public static files
├── favicon.ico              # App favicon
└── examples/                # Example config files for download
    ├── basic-form.json
    ├── multi-step-form.json
    └── conditional-form.json

# Configuration files (repository root)
.
├── index.html               # HTML entry point
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration (strict mode)
├── tsconfig.app.json        # App-specific TS config
├── tsconfig.node.json       # Node-specific TS config
├── vite.config.ts           # Vite build configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── postcss.config.js        # PostCSS configuration
└── README.md                # Project documentation
```

**Component Count**: 26 total components (11 base, 5 form, 3 payload, 3 demo, 2 views, 2 layout)  
**Composables Count**: 8 focused composables, each handling a single concern  
**Estimated LOC**: ~3,500 lines (components: 1,800, composables: 800, services: 400, types: 300, utils: 200)

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **Zod dependency (14KB)** | Runtime validation with TypeScript type inference required. Complex validation rules (regex patterns, conditional validation, nested object validation, custom validators) cannot be achieved with native HTML5 validation alone. | Native browser validation: Cannot handle conditional validation, nested structures, or custom business rules. Manual validation functions: Would require 200+ lines of code, error-prone, no type safety. |
| **Axios dependency (13KB)** | HTTP interceptors needed for auth token injection and consistent error handling across all API calls. Token resolution (store:*, response:*) requires request/response interception. | Native fetch API: Lacks interceptor support. Would require wrapper functions around every API call (50+ lines per endpoint), duplicating auth and error logic. Alternative (ky 5KB): No interceptor support, insufficient for token resolution requirements. |

**Total Added Dependencies**: 27KB gzipped (Zod 14KB + Axios 13KB)  
**Justification**: Both dependencies are essential for core functionality and properly justified above. No simpler alternatives exist that meet requirements without significant code duplication or loss of type safety.

---

## Planning Summary & Next Steps

### Phase 0: Research Complete ✅

Generated **research.md** with 8 key technical decisions:

1. **Form Rendering**: Component-based with type-driven dispatch pattern
2. **Validation Library**: Zod 3.22+ (14KB) selected over Yup (45KB), Joi (146KB), vee-validate (16KB)
3. **State Management**: Reactive refs with provide/inject (no Pinia/Vuex per constitution)
4. **Conditional Logic**: Computed properties with dependency graph
5. **Data Sources**: Composable-based async fetching with reactive dependencies
6. **Token Resolution**: Service with Axios interceptors supporting form:*, store:*, response:*
7. **Payload Mapping**: Builder with submitField dot notation for nested structures
8. **Accessibility**: Built-in ARIA support in base components (WCAG 2.1 AA)

**All NEEDS CLARIFICATION items resolved**. No blocking unknowns remain.

### Phase 1: Design & Contracts Complete ✅

Generated Phase 1 artifacts:

- **data-model.md**: 10 entities with complete TypeScript interfaces (FormConfig, StepConfig, FieldDefinition, ValidationRule, ConditionalRule, DataSourceConfig, DependencyConfig, SubmitConfig, FormState, SubmissionPayload)
- **contracts/README.md**: Contract summary referencing data-model.md (consolidated strategy)
- **quickstart.md**: Demo setup with 15 manual verification scenarios mapped to user stories

**Agent context update**: Ready to run `.specify/scripts/bash/update-agent-context.sh copilot` to add Zod and Axios to agent context.

### Constitution Re-evaluation Post-Design ✅

Re-checked all 5 principles after completing design:

- ✅ **Principle I (Clean Code)**: All 26 components <100 lines, 8 composables <50 lines each
- ✅ **Principle II (Simple UX)**: Zero learning curve, inline validation, 3-step max for MVP
- ✅ **Principle III (Responsive Design)**: Mobile-first, Tailwind utilities, WCAG AA compliance
- ✅ **Principle IV (Minimal Dependencies)**: Only Zod (14KB) + Axios (13KB) = 27KB added, both justified
- ✅ **Principle V (NO TESTING)**: No test files, frameworks, or references in plan

**No new violations introduced during design phase**.

### Estimated Implementation

- **Lines of Code**: ~3,500 total (components: 1,800, composables: 800, services: 400, types: 300, utils: 200)
- **MVP Time**: 40-50 hours for User Story 1 (P1)
- **Full Feature**: 80-100 hours for all 4 user stories
- **Component Count**: 26 components, 8 composables, 4 services
- **Bundle Size**: <200KB gzipped (including Zod 14KB + Axios 13KB)

### Key Technical Risks & Mitigations

1. **Circular Dependencies** (useFormValidation → useFormState → useFormValidation)
   - Mitigation: Validator composable as pure function, breaks cycle

2. **XSS Attacks** (user-provided config could inject scripts)
   - Mitigation: Vue's automatic HTML escaping, sanitize all config values

3. **Bundle Size Growth** (additional dependencies tempting during implementation)
   - Mitigation: Audited dependencies in Complexity Tracking, no more additions allowed

4. **Performance Degradation** (50+ fields could slow rendering)
   - Mitigation: Virtual scrolling for large selects, memoized computed properties

### Ready for Phase 2: Task Generation

**Command**: `/speckit.tasks`

**Expected Output**: tasks.md with 50-65 actionable tasks organized by:
- Phase 1: Setup (3-5 tasks)
- Phase 2: Foundational (6-8 tasks)
- Phase 3: User Story 1 - MVP (15-20 tasks)
- Phase 4: User Story 2 - Multi-step (10-12 tasks)
- Phase 5: User Story 3 - Conditional (8-10 tasks)
- Phase 6: User Story 4 - Documentation (5-7 tasks)
- Phase 7: Polish (5-7 tasks)

**Implementation Priority**: Focus on User Story 1 (P1 MVP) first for fastest time-to-value.

---

## Branch & Artifacts

- **Branch**: `001-form-config-generator`
- **Plan**: `/home/divya/Projects/AI/dynamic-form-genrator/specs/001-form-config-generator/plan.md`
- **Spec**: `/home/divya/Projects/AI/dynamic-form-genrator/specs/001-form-config-generator/spec.md`
- **Research**: `/home/divya/Projects/AI/dynamic-form-genrator/specs/001-form-config-generator/research.md`
- **Data Model**: `/home/divya/Projects/AI/dynamic-form-genrator/specs/001-form-config-generator/data-model.md`
- **Contracts**: `/home/divya/Projects/AI/dynamic-form-genrator/specs/001-form-config-generator/contracts/README.md`
- **Quickstart**: `/home/divya/Projects/AI/dynamic-form-genrator/specs/001-form-config-generator/quickstart.md`

**Planning phase complete**. Ready for task generation and implementation.
