# Architecture Documentation

## System Overview

The Dynamic Form Generator is a component-based architecture that transforms JSON configurations into fully functional, validated forms. The system follows a layered architecture with clear separation of concerns.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        Application Layer                          │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐     │
│  │  HomeView  │  │  DemoView   │  │  DocumentationView   │     │
│  └────────────┘  └─────────────┘  └──────────────────────┘     │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────────┐
│                    Form Orchestration Layer                       │
│                     ┌─────────────────┐                           │
│                     │  FormRenderer   │                           │
│                     └────────┬────────┘                           │
│                              │                                    │
│    ┌─────────────────────────┼──────────────────────────┐       │
│    │                         │                          │        │
│    ▼                         ▼                          ▼        │
│ ┌──────────┐         ┌─────────────┐          ┌──────────────┐ │
│ │  Multi-  │         │ Conditional │          │  Field       │ │
│ │  Step    │◄────────┤   Logic     │◄─────────┤  Dependency  │ │
│ │  Manager │         │  Evaluator  │          │   Manager    │ │
│ └──────────┘         └─────────────┘          └──────────────┘ │
└───────────────────────────┬──────────────────────────────────────┘
                            │
┌───────────────────────────┴──────────────────────────────────────┐
│                    Component Layer                                │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐           │
│  │ FieldWrapper│  │ StepIndicator│  │   FormStep    │           │
│  └─────────────┘  └──────────────┘  └───────────────┘           │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           Base Components (Input Primitives)            │    │
│  ├─────────────┬──────────────┬─────────────┬─────────────┤    │
│  │  BaseInput  │  BaseSelect  │ BaseCheckbox│  BaseRadio  │    │
│  └─────────────┴──────────────┴─────────────┴─────────────┘    │
└───────────────────────────┬──────────────────────────────────────┘
                            │
┌───────────────────────────┴──────────────────────────────────────┐
│                     Service Layer                                 │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐        │
│  │  Validation  │  │ API Client  │  │ Token Resolution │        │
│  │   Service    │  │   Service   │  │     Service      │        │
│  └──────────────┘  └─────────────┘  └──────────────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Configuration-Driven Design

The entire form structure is defined in JSON configurations:

```typescript
interface FormConfig {
  id: string
  metadata: FormMetadata
  steps: FormStep[]
  submitConfig: SubmitConfig
}
```

**Benefits:**
- Forms can be created/modified without code changes
- Configurations can be stored in databases
- Easy to version and share
- Type-safe with TypeScript

### 2. Reactive State Management

Form state is managed reactively using Vue's composition API:

```typescript
interface FormState {
  values: Record<string, any>        // Field values
  errors: Record<string, string[]>   // Validation errors
  touched: Record<string, boolean>   // User interaction tracking
  submitState: SubmitState           // Submission status
  currentStep: number                // Multi-step navigation
  visibility: Record<string, boolean> // Conditional field visibility
  fieldLoading: Record<string, boolean> // Async data loading
}
```

### 3. Composable Architecture

Business logic is encapsulated in Vue composables:

- **useFormValidation** - Zod-based validation with debouncing
- **useFormSubmission** - HTTP submission with state transitions
- **useMultiStep** - Step navigation and progress tracking
- **useConditionalFields** - Dynamic field visibility evaluation
- **useFieldDependency** - Parent-child field relationships
- **useDataSource** - API data fetching with caching

## Component Hierarchy

### FormRenderer (Orchestrator)

The central component that coordinates all functionality:

```
FormRenderer
├── Form State Management
├── Validation Orchestration
├── Submission Handling
├── Conditional Logic Processing
├── Multi-Step Coordination
└── Field Rendering

Composables Used:
- useFormValidation
- useFormSubmission
- useMultiStep (conditional)
- useConditionalFields
- useFieldDependency
- useDataSource
```

### Field Components

**Base Components** - Primitive inputs:
```
BaseInput      → text, email, number, tel, url, password
BaseTextarea   → textarea
BaseSelect     → select (single/multiple)
BaseCheckbox   → checkbox
BaseRadio      → radio group
BaseButton     → buttons with loading states
BaseLabel      → accessible labels
```

**Wrapper Components**:
```
FieldWrapper
├── Label (with required indicator)
├── Input Component (slot)
├── Help Text
└── Validation Error (with ARIA live region)
```

**Step Components** (Multi-step forms):
```
StepIndicator → Visual progress indicator
FormStep → Container for step fields
```

## Data Flow

### 1. User Input Flow

```
User Input
    ↓
BaseComponent (emits update:modelValue)
    ↓
FormRenderer (updateFieldValue)
    ↓
FormState.values updated
    ↓
┌─────────────────────────────────────┐
│ Reactive Effects Triggered:         │
├─────────────────────────────────────┤
│ 1. Conditional field evaluation     │
│ 2. Field dependency resolution      │
│ 3. Debounced validation (300ms)     │
│ 4. Parent component update event    │
└─────────────────────────────────────┘
```

### 2. Validation Flow

```
Field Blur Event
    ↓
validateField(fieldName) [debounced]
    ↓
buildZodSchema(field definition)
    ↓
Zod validation execution
    ↓
┌─────────────────────┐
│ Success: Clear error│
│ Failure: Set error  │
└─────────────────────┘
    ↓
FormState.errors updated
    ↓
ValidationError component displays error
```

### 3. Submission Flow

```
Submit Button Click
    ↓
handleSubmit()
    ↓
validateAll() - Check all fields
    ↓
┌───────────────────────┐
│ Validation Failed?    │
│ → Display errors, stop│
└───────────────────────┘
    ↓
buildPayload() - Transform values
    ↓
submitForm() - HTTP POST/PUT
    ↓
┌─────────────────────────────────┐
│ Success: Execute onSuccess      │
│   - Show message                │
│   - Redirect (optional)         │
│   - Custom actions              │
│                                 │
│ Error: Execute onError          │
│   - Show error message          │
│   - Retry prompt                │
└─────────────────────────────────┘
```

### 4. Conditional Logic Flow

```
Field Value Changes
    ↓
useConditionalFields watches formState.values
    ↓
For each field with showIf rule:
    ↓
evaluateConditionalRule(rule, formState)
    ↓
┌───────────────────────────────────────┐
│ Operators: equals, contains,         │
│ greaterThan, isEmpty, in, etc.       │
└───────────────────────────────────────┘
    ↓
Update formState.visibility[fieldName]
    ↓
FieldWrapper v-if="visible"
    ↓
Field appears/disappears with transition
```

### 5. Data Source Flow

```
Field with dataSource config
    ↓
onMounted → loadDataSource(field)
    ↓
Check cache (if enabled, ttl: 300s)
    ↓
┌────────────────────────┐
│ Cache Hit?            │
│ → Use cached data     │
└────────────────────────┘
    ↓
Resolve tokens in params (form:*, store:*, response:*)
    ↓
HTTP GET/POST to endpoint
    ↓
Extract data using 'from' path (e.g., "data.cities")
    ↓
Map to options using 'to' mapping { label: 'name', value: 'id' }
    ↓
Cache response (if cache.enabled)
    ↓
Update field options
```

## Service Layer

### Validation Service

**Purpose:** Build Zod schemas from field definitions

```typescript
buildZodSchema(fields: FieldDefinition[]): z.ZodObject
```

**Features:**
- Required field handling
- String length validation (minLength, maxLength)
- Numeric range validation (min, max)
- Pattern matching (regex)
- Email/URL validation
- Custom error messages

### API Service

**Purpose:** HTTP client with interceptors

```typescript
apiClient.get(url, config)
apiClient.post(url, data, config)
```

**Features:**
- Request/response interceptors
- Error handling
- Token resolution in requests
- Configurable headers

### Token Service

**Purpose:** Resolve dynamic values in configurations

```typescript
resolveTokens(text: string, formState: FormState): string
```

**Supported Tokens:**
- `form:fieldName` - Reference field values
- `store:key` - Reference stored values
- `response:path` - Reference API response data

### Payload Builder

**Purpose:** Transform form values into submission payload

```typescript
buildPayload(values, fields): Record<string, any>
```

**Features:**
- Nested object creation using submitField paths
- Field exclusion/inclusion
- Value transformation
- Null/undefined handling

## State Management Patterns

### 1. Centralized Form State

All form state is managed in a single reactive object:

```typescript
const formState = ref<FormState>({
  values: {},
  errors: {},
  touched: {},
  submitState: 'idle',
  currentStep: 0,
  visibility: {},
  fieldLoading: {}
})
```

**Benefits:**
- Single source of truth
- Easy debugging
- Time-travel capability
- State persistence

### 2. Computed Properties

Derived state is calculated using computed properties:

```typescript
const allFields = computed(() => 
  formConfig.value.steps.flatMap(step => step.fields)
)

const currentStepFields = computed(() => 
  formConfig.value.steps[formState.value.currentStep]?.fields || []
)

const visibleFields = computed(() => 
  currentStepFields.value.filter(f => 
    formState.value.visibility[f.name] !== false
  )
)
```

### 3. Watchers for Side Effects

Side effects are handled with watchers:

```typescript
// Dependency resolution
watch(() => formState.value.values[parentField], (newValue) => {
  if (config.resetOnChange) {
    formState.value.values[childField] = null
  }
  if (config.reloadOnParentChange && field.dataSource) {
    loadDataSource(field)
  }
})
```

## Performance Optimizations

### 1. Debounced Validation

Validation is debounced by 300ms to prevent excessive Zod execution:

```typescript
const validateField = debounce(validateFieldImmediate, 300)
```

### 2. Response Caching

API responses are cached for 5 minutes (configurable):

```typescript
cache: {
  enabled: true,
  ttl: 300  // seconds
}
```

### 3. Conditional Rendering

Fields are conditionally rendered using `v-if` to avoid unnecessary DOM updates:

```typescript
<FieldWrapper v-if="visible">
  <Component :is="fieldComponent" />
</FieldWrapper>
```

### 4. Lazy Component Loading

Route components are lazy-loaded:

```typescript
{
  path: '/demo',
  component: () => import('../views/DemoView.vue')
}
```

## Error Handling Strategy

### 1. Validation Errors

Displayed inline under each field with ARIA live regions:

```vue
<ValidationError
  v-if="error"
  :message="error"
  role="alert"
  aria-live="polite"
/>
```

### 2. Network Errors

Handled at the service layer with retry capabilities:

```typescript
try {
  const response = await apiClient.post(url, data)
  return response.data
} catch (error) {
  if (error.response?.status === 500) {
    // Server error
  } else if (error.request) {
    // Network error
  }
  throw error
}
```

### 3. Global Error Boundary

Catches unhandled errors and displays fallback UI:

```vue
<ErrorBoundary>
  <RouterView />
</ErrorBoundary>
```

## Accessibility Features

### 1. Semantic HTML

All components use semantic HTML elements:

```html
<form role="form">
  <label for="field-id">
  <input id="field-id" aria-describedby="field-help">
  <span id="field-help">Help text</span>
</form>
```

### 2. ARIA Attributes

- `role="alert"` for errors
- `aria-live="polite"` for dynamic updates
- `aria-invalid="true"` for invalid fields
- `aria-describedby` for help text
- `aria-required` for required fields

### 3. Keyboard Navigation

- Tab to navigate between fields
- Enter to submit forms
- Escape to close modals
- Focus trap in modal dialogs

### 4. Color Contrast

All text meets WCAG AA standards:
- Text: 4.5:1 contrast ratio
- UI components: 3:1 contrast ratio

## Testing Strategy

**Note:** This project follows Constitution Principle V - No automated testing. All verification is manual via browser testing.

### Manual Verification Scenarios

See [quickstart.md](specs/001-form-config-generator/quickstart.md) for complete test scenarios:

1. Basic Form Submission
2. Multi-Step Navigation
3. Conditional Field Visibility
4. Field Dependencies
5. Data Source Loading
6. Validation Errors
7. Config Validation
8. Responsive Design
9. Accessibility
10. Dark Mode Support
11. Error Handling
12. Performance Testing

## Extension Points

### Adding New Field Types

1. Create new base component in `src/components/base/`
2. Add type to `FIELD_TYPES` constant
3. Update `getFieldComponent()` in FormRenderer
4. Add to documentation

### Adding New Validation Rules

1. Extend `ValidationRule` type
2. Update `buildZodSchema()` in validation.service.ts
3. Add error message to `DEFAULT_MESSAGES`

### Adding New Conditional Operators

1. Add operator to `ConditionalOperator` type
2. Update `evaluateCondition()` in useConditionalFields.ts
3. Document in README

## Deployment

### Build for Production

```bash
npm run build
```

Output: `dist/` directory

### Environment Variables

No environment variables required - all configuration is in JSON.

### CDN Assets

All assets are bundled and optimized by Vite.

## Monitoring & Debugging

### Browser DevTools

- Vue DevTools for component inspection
- Network tab for API debugging
- Console for validation errors
- Performance tab for rendering profiling

### Logging

```typescript
console.log('Form submitted:', payload)
console.warn('Validation failed:', errors)
console.error('API error:', error)
```

## Future Enhancements

Potential features for future versions:

- [ ] File upload fields
- [ ] Rich text editor support
- [ ] Drag-and-drop form builder
- [ ] Form templates library
- [ ] Real-time collaboration
- [ ] A/B testing support
- [ ] Analytics integration
- [ ] Internationalization (i18n)
- [ ] Custom validation functions
- [ ] Webhook support

## Resources

- [Vue 3 Documentation](https://vuejs.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Zod Documentation](https://zod.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
