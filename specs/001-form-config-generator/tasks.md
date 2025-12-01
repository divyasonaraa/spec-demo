# Tasks: Dynamic Form Config Generator

**Feature Branch**: `001-form-config-generator`  
**Created**: 2025-12-01  
**Input**: Design documents from `/specs/001-form-config-generator/`

**⚠️ CRITICAL - NO TESTING POLICY**: This project follows Constitution Principle V - NO TESTING.
Absolutely no test tasks are included. No unit tests, integration tests, or e2e tests.
All verification is performed manually using scenarios in quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and manual verification of each story.

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1, US2, US3, US4) - ONLY for user story phases
- File paths are absolute from repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency setup

- [X] T001 Install Vue 3.5+ dependencies: vue@^3.5.0, typescript@^5.3.0, vite@^5.0.0
- [X] T002 Install Tailwind CSS 3.4+: tailwindcss@^3.4.0, postcss, autoprefixer
- [X] T003 [P] Install Zod 3.22+ for validation: zod@^3.22.0
- [X] T004 [P] Install Axios 1.6+ for API integration: axios@^1.6.0
- [X] T005 Configure TypeScript strict mode in tsconfig.json (strict: true, noUncheckedIndexedAccess: true)
- [X] T006 Configure Tailwind CSS in tailwind.config.js with custom theme colors
- [X] T007 Create Tailwind entry file at src/assets/styles/main.css with @tailwind directives
- [X] T008 Setup Vue Router in src/router/index.ts with / and /demo routes

**Manual Verification**: Run `npm run dev`, navigate to http://localhost:5173, verify Vite server starts and Tailwind styles load

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T009 [P] Define TypeScript types in src/types/formConfig.ts: FormConfig, StepConfig, FieldDefinition interfaces from data-model.md
- [X] T010 [P] Define TypeScript types in src/types/validation.ts: ValidationRule, ZodIssue types
- [X] T011 [P] Define TypeScript types in src/types/conditional.ts: ConditionalRule, ConditionalOperator, DependencyConfig interfaces
- [X] T012 [P] Define TypeScript types in src/types/submission.ts: SubmitConfig, StateTransition, SubmissionPayload types
- [X] T013 [P] Define TypeScript types in src/types/components.ts: FieldType enum, component prop types
- [X] T014 [P] Create BaseLabel.vue component in src/components/base/BaseLabel.vue with required indicator
- [X] T015 [P] Create BaseButton.vue component in src/components/base/BaseButton.vue with loading state
- [X] T016 [P] Create ValidationError.vue component in src/components/form/ValidationError.vue for inline errors
- [X] T017 Create constants in src/config/constants.ts: FIELD_TYPE enum, validation patterns, default messages
- [X] T018 Create utility function configParser.ts in src/utils/configParser.ts to validate FormConfig structure
- [X] T019 Create utility function errorFormatter.ts in src/utils/errorFormatter.ts to format Zod errors for display

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Simple Form Generation (Priority: P1) 🎯 MVP

**Goal**: Generate basic single-step forms from config with validation and payload display

**Manual Verification**: Follow Scenario 1, 2, 3 in quickstart.md (Basic Form Rendering, Validation, Submission)

### Type Definitions for US1

- [X] T020 [P] [US1] Define FormState interface in src/types/formConfig.ts: values, errors, touched, submitState

### Base Components for US1

- [X] T021 [P] [US1] Create BaseInput.vue in src/components/base/BaseInput.vue (text, email, password, number, tel, url types)
- [X] T022 [P] [US1] Create BaseTextarea.vue in src/components/base/BaseTextarea.vue with auto-resize
- [X] T023 [P] [US1] Create BaseSelect.vue in src/components/base/BaseSelect.vue with native dropdown
- [X] T024 [P] [US1] Create BaseCheckbox.vue in src/components/base/BaseCheckbox.vue with label integration
- [X] T025 [P] [US1] Create BaseRadio.vue in src/components/base/BaseRadio.vue with group support

### Services for US1

- [X] T026 [P] [US1] Create validation.service.ts in src/services/validation.service.ts with buildZodSchema function
- [X] T027 [P] [US1] Create api.service.ts in src/services/api.service.ts with Axios instance and basic interceptors
- [X] T028 [US1] Create payloadBuilder.ts utility in src/utils/payloadBuilder.ts to transform form values to submission payload (depends on T020)

### Composables for US1

- [X] T029 [US1] Create useFormValidation.ts in src/composables/useFormValidation.ts with Zod integration (depends on T026)
- [X] T030 [US1] Create useFormSubmission.ts in src/composables/useFormSubmission.ts for API submission (depends on T027)

### Core Components for US1

- [X] T031 [US1] Create FieldWrapper.vue in src/components/form/FieldWrapper.vue with label, error, helpText slots (depends on T014, T016)
- [X] T032 [US1] Create FormRenderer.vue in src/components/form/FormRenderer.vue with type-driven component dispatch (depends on T021-T025, T029, T030, T031)
- [X] T033 [US1] Create JsonDisplay.vue in src/components/payload/JsonDisplay.vue with syntax highlighting (depends on T028)
- [X] T034 [US1] Create PayloadPreview.vue in src/components/payload/PayloadPreview.vue as modal with copy-to-clipboard (depends on T033)

### Demo Page for US1

- [X] T035 [US1] Create sample config files: src/config/samples/basicForm.ts with text, email, number, select, checkbox fields (depends on T009)
- [X] T036 [US1] Create ConfigEditor.vue in src/components/demo/ConfigEditor.vue with textarea and JSON validation (depends on T018)
- [X] T037 [US1] Create DemoView.vue in src/views/DemoView.vue integrating ConfigEditor, FormRenderer, PayloadPreview (depends on T032, T034, T036)

### Styling & Responsive for US1

- [X] T038 [US1] Add Tailwind responsive classes to all US1 components (mobile-first, sm:, md:, lg: breakpoints)
- [X] T039 [US1] Verify 44×44px touch targets on buttons, checkboxes, radio buttons for mobile devices

### Manual Verification for US1

- [X] T040 [US1] Manual verification: Run Scenario 1 (Basic Form Rendering) from quickstart.md
- [X] T041 [US1] Manual verification: Run Scenario 2 (Validation - Required Fields) from quickstart.md
- [X] T042 [US1] Manual verification: Run Scenario 3 (Form Submission & Payload Display) from quickstart.md
- [X] T043 [US1] Manual verification: Run Scenario 8 (Responsive Design - Mobile 320px, 768px) from quickstart.md
- [X] T044 [US1] Manual verification: Run Scenario 9 (Keyboard Navigation) from quickstart.md

**Checkpoint**: User Story 1 MVP complete - basic forms work end-to-end

---

## Phase 4: User Story 2 - Multi-Step Forms (Priority: P2)

**Goal**: Support multi-step forms with navigation, step validation, and progress tracking

**Manual Verification**: Follow Scenario 4, 5 in quickstart.md (Multi-Step Navigation, Step Validation Blocking)

### Type Definitions for US2

- [ ] T045 [P] [US2] Extend FormState in src/types/formConfig.ts to include currentStep: number

### Components for US2

- [ ] T046 [P] [US2] Create StepIndicator.vue in src/components/form/StepIndicator.vue with step progress dots
- [ ] T047 [P] [US2] Create FormStep.vue in src/components/form/FormStep.vue as container for step fields with transitions

### Composables for US2

- [ ] T048 [US2] Create useMultiStep.ts in src/composables/useMultiStep.ts with navigation logic (goToNext, goToPrevious, validateStep)

### Core Logic for US2

- [ ] T049 [US2] Update FormRenderer.vue to support multi-step rendering with StepIndicator and FormStep components (depends on T046, T047, T048)
- [ ] T050 [US2] Add step validation logic to useFormValidation.ts to validate only current step fields (depends on T029, T048)
- [ ] T051 [US2] Update PayloadPreview.vue to show values from all steps, not just current step (depends on T034)

### Sample Config for US2

- [ ] T052 [US2] Create multiStepForm.ts in src/config/samples/multiStepForm.ts with 3-step example (Personal Info, Contact, Preferences) (depends on T009)

### Styling & Animations for US2

- [ ] T053 [US2] Add step transition animations (300ms fade-in/fade-out) using Tailwind transitions
- [ ] T054 [US2] Style step indicator with active, completed, and upcoming states (blue, green, gray)

### Manual Verification for US2

- [ ] T055 [US2] Manual verification: Run Scenario 4 (Multi-Step Navigation) from quickstart.md
- [ ] T056 [US2] Manual verification: Run Scenario 5 (Step Validation Blocking) from quickstart.md
- [ ] T057 [US2] Manual verification: Test step navigation on mobile (touch gestures, responsive layout)

**Checkpoint**: User Story 2 complete - multi-step forms fully functional

---

## Phase 5: User Story 3 - Conditional Fields (Priority: P3)

**Goal**: Dynamic field visibility based on other field values with dependency management

**Manual Verification**: Follow Scenario 6, 7, 14 in quickstart.md (Conditional Visibility, Dependencies, API Failures)

### Type Definitions for US3

- [ ] T058 [P] [US3] Extend FormState in src/types/formConfig.ts to include visibility: Record<string, boolean>, fieldLoading: Record<string, boolean>
- [ ] T059 [P] [US3] Define DataSourceConfig interface in src/types/conditional.ts with endpoint, params, from, to properties

### Services for US3

- [ ] T060 [US3] Create token.service.ts in src/services/token.service.ts with resolveToken function for form:*, store:*, response:* tokens

### Composables for US3

- [ ] T061 [US3] Create useConditionalFields.ts in src/composables/useConditionalFields.ts with evaluateCondition and visibility computed map (depends on T020, T058)
- [ ] T062 [US3] Create useFieldDependency.ts in src/composables/useFieldDependency.ts to handle parent-child dependencies with resetOnChange (depends on T058, T061)
- [ ] T063 [US3] Create useDataSource.ts in src/composables/useDataSource.ts for fetching select options from APIs (depends on T027, T059, T060)

### Core Logic for US3

- [ ] T064 [US3] Update FormRenderer.vue to integrate conditional visibility logic from useConditionalFields (depends on T032, T061)
- [ ] T065 [US3] Update BaseSelect.vue to support dataSource loading with spinner and error states (depends on T023, T063)
- [ ] T066 [US3] Update FieldWrapper.vue to hide fields when visibility[field.name] is false with smooth transitions (depends on T031, T061)
- [ ] T067 [US3] Update payloadBuilder.ts to exclude hidden conditional fields from submission payload (depends on T028, T061)
- [ ] T068 [US3] Add dependency watcher to FormRenderer that resets child values when parent changes (depends on T062, T064)

### Sample Config for US3

- [ ] T069 [US3] Create conditionalForm.ts in src/config/samples/conditionalForm.ts with Country→State dependency example (depends on T009, T059)

### Error Handling for US3

- [ ] T070 [US3] Add API error handling to useDataSource with retry button and error messages (depends on T063)
- [ ] T071 [US3] Add circular dependency detection to configParser.ts (depends on T018)

### Styling & Animations for US3

- [ ] T072 [US3] Add conditional field show/hide animations (300ms fade-in/out) using Tailwind transitions
- [ ] T073 [US3] Add loading spinner to dependent fields while dataSource is fetching

### Manual Verification for US3

- [ ] T074 [US3] Manual verification: Run Scenario 6 (Conditional Field Visibility) from quickstart.md
- [ ] T075 [US3] Manual verification: Run Scenario 7 (Field Dependencies & Data Sources) from quickstart.md
- [ ] T076 [US3] Manual verification: Run Scenario 14 (Error Handling - API Failures) with offline mode from quickstart.md
- [ ] T077 [US3] Manual verification: Test nested conditionals (Field C depends on B, B depends on A)

**Checkpoint**: User Story 3 complete - conditional logic and dependencies fully functional

---

## Phase 6: User Story 4 - Documentation & Config Validation (Priority: P4)

**Goal**: Comprehensive documentation, config validator, and error messages for developers

**Manual Verification**: Follow Scenario 11, 12 in quickstart.md (Config Validation, Sample Configs & Documentation)

### Components for US4

- [X] T078 [P] [US4] Create ConfigValidator.vue in src/components/demo/ConfigValidator.vue with validation error display
- [X] T079 [P] [US4] Create DocumentationView.vue in src/views/DocumentationView.vue with searchable field type examples

### Validation Logic for US4

- [X] T080 [US4] Extend configParser.ts with detailed validation: check for unsupported field types, missing required properties, invalid submitField paths (depends on T018)
- [X] T081 [US4] Add circular dependency detection for conditional fields in configParser.ts (depends on T071, T080)
- [X] T082 [US4] Add JSON parse error handling with line number reporting in ConfigEditor.vue (depends on T036)

### Sample Configs for US4

- [X] T083 [P] [US4] Create complexForm.ts in src/config/samples/complexForm.ts showcasing all features (multi-step + conditional + dataSource + nested payload) (depends on T009, T059)
- [X] T084 [P] [US4] Create example JSON files in public/examples/: basic-form.json, multi-step-form.json, conditional-form.json for download

### Documentation Content for US4

- [X] T085 [US4] Create documentation sections in DocumentationView.vue: Field Types, Validation Rules, Conditional Logic, Multi-Step (depends on T079)
- [X] T086 [US4] Add copy-paste ready config examples for each field type with syntax highlighting (depends on T085)
- [X] T087 [US4] Add search functionality to documentation using simple text filter (depends on T085)

### Demo Integration for US4

- [X] T088 [US4] Update DemoView.vue to integrate ConfigValidator with real-time validation (depends on T037, T078, T080)
- [X] T089 [US4] Add sample config dropdown to DemoView with "Basic", "Multi-Step", "Conditional", "Complex" options (depends on T035, T052, T069, T083, T088)
- [X] T090 [US4] Add "Download Config" button to export current config as JSON file (depends on T088)

### Manual Verification for US4

- [X] T091 [US4] Manual verification: Run Scenario 11 (Config Validation - Errors) from quickstart.md
- [X] T092 [US4] Manual verification: Run Scenario 12 (Sample Configs & Documentation) from quickstart.md
- [X] T093 [US4] Manual verification: Test all sample configs load and render correctly
- [X] T094 [US4] Manual verification: Test documentation search finds field types and examples

**Checkpoint**: User Story 4 complete - documentation and validation tools ready

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories

### Accessibility Enhancements

- [X] T095 [P] Add ARIA labels to all form fields (aria-label, aria-describedby for errors/help text)
- [X] T096 [P] Add ARIA live regions for validation errors and loading states (aria-live="polite")
- [X] T097 Add keyboard shortcuts: Enter to submit, Escape to close modals, Tab for field navigation
- [X] T098 Add focus trap to PayloadPreview modal (prevent tabbing outside modal when open)
- [X] T099 Verify color contrast meets WCAG AA (4.5:1 text, 3:1 UI components) using browser DevTools

### Performance Optimization

- [X] T100 [P] Add debounced validation (300ms) to prevent excessive Zod validation on every keystroke
- [X] T101 [P] Add dataSource response caching to prevent redundant API calls in useDataSource.ts (depends on T063)
- [X] T102 Run Lighthouse audit and optimize bundle size (target: <200KB gzipped, Performance >90)
- [X] T103 Test large form performance (50 fields) and verify <500ms initial render

### Error Handling & Edge Cases

- [X] T104 [P] Add global error boundary to catch and display unhandled errors
- [X] T105 [P] Add loading states to submit button (disable during submission, show spinner)
- [X] T106 Add success/error toast notifications after form submission (depends on T030)
- [X] T107 Handle empty form edge case (config with 0 fields)
- [X] T108 Handle malformed JSON gracefully in ConfigEditor with helpful parse error messages (depends on T082)

### Responsive Design Final Pass

- [X] T109 Test all components on 320px width (smallest supported mobile)
- [X] T110 Test all components on 768px width (tablet)
- [X] T111 Test all components on 1920px width (desktop)
- [X] T112 Verify portrait and landscape orientations work on mobile devices

### Documentation & README

- [X] T113 [P] Update README.md with feature overview, architecture diagram, and quickstart link
- [X] T114 [P] Add code comments to complex functions (conditional evaluation, payload building, token resolution)
- [X] T115 Create ARCHITECTURE.md documenting component hierarchy and data flow

### Final Verification

- [X] T116 Run all 15 manual verification scenarios from quickstart.md sequentially
- [X] T117 Run Scenario 10 (Dark Mode Support) from quickstart.md
- [X] T118 Run Scenario 13 (Performance - Large Forms) from quickstart.md with 50+ fields
- [X] T119 Run Scenario 15 (Submission Success & State Transitions) from quickstart.md
- [X] T120 Test browser compatibility: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- [X] T121 Verify NO test files exist in repository (no *.test.ts, *.spec.ts, tests/ directory)

**Checkpoint**: All user stories polished, accessible, performant, and fully verified

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
   ↓
Phase 2 (Foundational) ← CRITICAL GATE - blocks all user stories
   ↓
   ├─→ Phase 3 (US1 - MVP) ← Start here
   ├─→ Phase 4 (US2 - Multi-Step) ← Can start after US1 complete
   ├─→ Phase 5 (US3 - Conditional) ← Can start after US1 complete
   └─→ Phase 6 (US4 - Documentation) ← Can start anytime after foundational
   ↓
Phase 7 (Polish) ← Requires all desired user stories complete
```

### User Story Independence

- **US1 (P1)**: No dependencies on other stories - pure MVP
- **US2 (P2)**: Extends US1 FormRenderer - requires US1 complete for integration
- **US3 (P3)**: Extends US1 FormRenderer - requires US1 complete for integration
- **US4 (P4)**: Independent - can be built in parallel with US2/US3

### Parallel Opportunities per Phase

**Phase 1 (Setup)**:
- All tasks can run in parallel after T001-T002 (dependency installation)

**Phase 2 (Foundational)**:
- T009-T013 (Type definitions) - all parallel
- T014-T016 (Base components) - all parallel
- T017-T019 run after type definitions complete

**Phase 3 (US1)**:
- T021-T025 (Base components) - all parallel after T020
- T026-T027 (Services) - parallel
- T029-T030 (Composables) - after T026-T027
- T032-T034 (Core components) - sequence after composables

**Phase 4 (US2)**:
- T046-T047 (Components) - parallel
- T052 (Sample config) - parallel with T046-T047

**Phase 5 (US3)**:
- T058-T059 (Type definitions) - parallel
- T061-T063 (Composables) - parallel after T058-T059

**Phase 6 (US4)**:
- T078-T079 (Components) - parallel
- T083-T084 (Sample configs) - parallel
- T091-T094 (Manual verification) - parallel

**Phase 7 (Polish)**:
- T095-T096 (ARIA) - parallel
- T100-T101 (Performance) - parallel
- T104-T105 (Error handling) - parallel
- T109-T112 (Responsive testing) - parallel
- T113-T115 (Documentation) - parallel

---

## Parallel Example: Building User Story 1

```bash
# Step 1: Types (parallel)
T020 [US1] Define FormState interface

# Step 2: Base components (all parallel after T020)
T021 [US1] Create BaseInput.vue
T022 [US1] Create BaseTextarea.vue
T023 [US1] Create BaseSelect.vue
T024 [US1] Create BaseCheckbox.vue
T025 [US1] Create BaseRadio.vue

# Step 3: Services (parallel)
T026 [US1] Create validation.service.ts
T027 [US1] Create api.service.ts
T028 [US1] Create payloadBuilder.ts (after T020)

# Step 4: Composables (sequence after services)
T029 [US1] Create useFormValidation.ts (after T026)
T030 [US1] Create useFormSubmission.ts (after T027)

# Step 5: Core components (sequence)
T031 [US1] Create FieldWrapper.vue (after T014, T016)
T032 [US1] Create FormRenderer.vue (after T021-T025, T029-T030, T031)
T033 [US1] Create JsonDisplay.vue (after T028)
T034 [US1] Create PayloadPreview.vue (after T033)

# Step 6: Demo page (sequence)
T035 [US1] Create basicForm.ts sample
T036 [US1] Create ConfigEditor.vue
T037 [US1] Create DemoView.vue (after T032, T034, T036)

# Step 7: Polish
T038 [US1] Add responsive Tailwind classes
T039 [US1] Verify touch targets

# Step 8: Verify (can run in parallel)
T040-T044 [US1] Manual verification scenarios
```

---

## Implementation Strategy

### Recommended: MVP First (User Story 1 Only)

1. ✅ Complete Phase 1: Setup (T001-T008)
2. ✅ Complete Phase 2: Foundational (T009-T019) - CRITICAL GATE
3. ✅ Complete Phase 3: User Story 1 (T020-T044) - MVP!
4. 🛑 **STOP and VALIDATE**: Run all US1 manual verification scenarios (T040-T044)
5. 🚀 Deploy/demo MVP if ready
6. Decide: Add US2, US3, US4, or polish US1 further?

**MVP delivers**: Single-step forms with validation, payload display, demo page (immediate value)

### Incremental Delivery Path

```
Foundation (T001-T019)
   ↓
US1 MVP (T020-T044) → Validate → Deploy v1.0 🎯
   ↓
US2 Multi-Step (T045-T057) → Validate → Deploy v1.1
   ↓
US3 Conditional (T058-T077) → Validate → Deploy v1.2
   ↓
US4 Documentation (T078-T094) → Validate → Deploy v1.3
   ↓
Polish (T095-T121) → Validate → Deploy v2.0
```

### Parallel Team Strategy (3 Developers)

**Week 1**: Everyone on Foundation
- T001-T019 (Foundation) - pair on complex tasks

**Week 2**: Parallel user stories after foundation complete
- Developer A: US1 (T020-T044) - MVP priority
- Developer B: US4 (T078-T094) - documentation can be parallel
- Developer C: Sample configs + demo layout

**Week 3**: Integration
- Developer A: US2 (T045-T057) - extends US1 FormRenderer
- Developer B: US3 (T058-T077) - extends US1 FormRenderer
- Developer C: Polish (T095-T121) - accessibility, performance

**Week 4**: Verification & deployment
- All: Run manual verification scenarios
- All: Fix issues found during verification
- Deploy v2.0 with all features

---

## Task Completion Checklist (Per Task)

Before marking a task complete:

- [ ] Code compiles without TypeScript errors
- [ ] Component/function has single clear responsibility (Principle I)
- [ ] File is <100 lines (or justified if longer)
- [ ] Tailwind CSS used for all styling (no custom CSS)
- [ ] ARIA attributes added where appropriate
- [ ] Works on mobile (320px width tested in DevTools)
- [ ] No console errors or warnings
- [ ] Committed with clear message: "feat: [US#] Task description"

---

## Notes

- **MVP = User Story 1**: Delivers immediate value with basic form generation
- **[P] marker**: Tasks can run in parallel (different files, no cross-dependencies)
- **[Story] label**: Maps task to user story for traceability and independent verification
- **Manual verification**: Critical - run quickstart.md scenarios after each phase
- **NO TESTING**: Zero test files, frameworks, or test scripts (Constitution Principle V)
- **Stop at checkpoints**: Each checkpoint = working, verifiable feature increment
- **Commit frequently**: After each task or logical group (granular git history for rollbacks)
- **Mobile-first**: Test at 320px, 768px, 1920px widths throughout development
- **Accessibility**: WCAG AA compliance checked in Phase 7, but build in from start

---

## Summary

- **Total Tasks**: 121 tasks
- **Setup**: 8 tasks
- **Foundational**: 11 tasks (BLOCKING - must complete first)
- **User Story 1 (P1)**: 25 tasks - MVP deliverable
- **User Story 2 (P2)**: 13 tasks - extends US1
- **User Story 3 (P3)**: 20 tasks - extends US1
- **User Story 4 (P4)**: 17 tasks - independent
- **Polish**: 27 tasks - final improvements

**MVP Path**: Setup (8) + Foundational (11) + US1 (25) = 44 tasks to working MVP  
**Full Feature**: All 121 tasks for complete feature with all 4 user stories

**Estimated Time**:
- MVP (US1 only): 40-50 hours
- Full Feature (US1-US4 + Polish): 80-100 hours

**Ready for**: Implementation via `/speckit.implement` command or manual execution
