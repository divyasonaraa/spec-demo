# Research: Dynamic Form Config Generator

**Feature**: 001-form-config-generator  
**Date**: 2025-12-01  
**Purpose**: Research form rendering patterns, validation strategies, and technical approaches to inform implementation decisions

## Research Questions

### 1. Form Rendering Architecture

**Question**: What pattern should we use for dynamically rendering forms from configuration objects?

**Decision**: **Component-based rendering with type-driven dispatch**

**Rationale**:
- Vue 3's `<component :is="componentName">` directive enables dynamic component resolution
- TypeScript discriminated unions (`type: 'text' | 'email' | 'select'`) provide type-safe field definitions
- Each field type maps to a specific base component (BaseInput, BaseSelect, etc.)
- Component registry pattern allows extensibility for custom field types

**Implementation Approach**:
```typescript
// Field type to component mapping
const FIELD_COMPONENT_MAP = {
  text: BaseInput,
  email: BaseInput,
  number: BaseInput,
  select: BaseSelect,
  checkbox: BaseCheckbox,
  // ... etc
} as const;

// In FormRenderer.vue
<component 
  :is="getFieldComponent(field.type)"
  v-bind="getFieldProps(field)"
  v-model="formValues[field.name]"
/>
```

**Alternatives Considered**:
- **Template-based rendering (v-if chains)**: Rejected - leads to 100+ line templates, poor maintainability
- **Render functions**: Rejected - loses Vue SFC benefits (scoped styles, readability), harder to debug
- **String-based HTML generation**: Rejected - XSS risks, loses Vue reactivity, no type safety

---

### 2. Validation Library Selection

**Question**: Which validation library best fits our TypeScript-first, zero-testing architecture?

**Decision**: **Zod 3.22+**

**Rationale**:
- **TypeScript-first design**: Automatically infers TypeScript types from schemas (DRY principle)
- **Zero dependencies**: 14KB gzipped, aligns with minimal dependencies principle
- **Runtime + compile-time validation**: Catches errors at both build time and runtime
- **Excellent error messages**: Built-in detailed error paths for nested objects
- **Composability**: Easy to build complex schemas from simpler primitives
- **Wide adoption**: 3M+ weekly downloads, active maintenance, excellent documentation

**Implementation Approach**:
```typescript
// Build Zod schema from config
function buildZodSchema(fields: FieldDefinition[]) {
  const shape: Record<string, z.ZodType> = {};
  
  fields.forEach(field => {
    let schema = getBaseSchema(field.type); // z.string(), z.number(), etc.
    
    if (field.validation?.required) schema = schema.min(1, field.validation.requiredMessage);
    if (field.validation?.pattern) schema = schema.regex(new RegExp(field.validation.pattern));
    // ... apply other rules
    
    shape[field.name] = field.validation?.required ? schema : schema.optional();
  });
  
  return z.object(shape);
}
```

**Alternatives Considered**:
- **Yup**: Rejected - 45KB gzipped (3x larger), less TypeScript-friendly, object-oriented API
- **Joi**: Rejected - 146KB gzipped (10x larger), designed for Node.js backend, not browser-optimized
- **Vee-Validate**: Rejected - adds 16KB + validation library, primarily template-driven (less composable)
- **Native HTML5 validation**: Rejected - cannot handle conditional validation, nested structures, or custom rules

**Bundle Impact**: +14KB gzipped (acceptable given TypeScript benefits and zero alternatives)

---

### 3. Multi-Step Form State Management

**Question**: How should we manage form state across multiple steps without a state management library?

**Decision**: **Reactive refs with provide/inject pattern**

**Rationale**:
- Vue 3 Composition API provides `reactive()` and `ref()` for state management
- `provide/inject` enables component tree sharing without prop drilling
- Single source of truth: form values stored in `FormRenderer` root component
- Step navigation logic isolated in `useMultiStep` composable
- No external library needed (Pinia/Vuex prohibited by constitution)

**Implementation Approach**:
```typescript
// In FormRenderer.vue
const formState = reactive({
  currentStep: 0,
  values: {} as Record<string, any>,
  errors: {} as Record<string, string[]>,
  touched: new Set<string>()
});

provide('formState', formState);
provide('formActions', {
  nextStep: () => { /* validate and increment */ },
  prevStep: () => { /* decrement */ },
  setValue: (name: string, value: any) => { /* update */ },
  validateStep: async () => { /* run Zod validation */ }
});

// In child components
const { formState, formActions } = inject('formContext');
```

**State Structure**:
- `currentStep`: number (0-indexed)
- `values`: flat object with all field values (indexed by field.name)
- `errors`: validation errors per field
- `touched`: Set of field names that user has interacted with
- `submitState`: { loading: boolean, success: boolean, error: string | null }

**Alternatives Considered**:
- **Pinia/Vuex**: Rejected - prohibited by constitution (Principle IV)
- **Props/emit only**: Rejected - requires 5+ levels of prop drilling, becomes unmaintainable
- **URL query parameters**: Rejected - exposes form data in URL, not suitable for sensitive data
- **LocalStorage per step**: Rejected - over-engineering for in-memory state, adds complexity

---

### 4. Conditional Field Logic

**Question**: What pattern should we use for conditional field visibility based on other field values?

**Decision**: **Computed properties with dependency graph**

**Rationale**:
- Vue's `computed()` automatically tracks dependencies and re-evaluates when they change
- Dependency graph ensures parent fields are evaluated before children
- Simple condition syntax in config: `showIf: { field: 'country', equals: 'USA' }`
- Circular dependency detection during config parsing (fail fast)

**Implementation Approach**:
```typescript
// In useConditionalFields.ts
export function useConditionalFields(fields: FieldDefinition[], formValues: Record<string, any>) {
  const visibilityMap = computed(() => {
    const result: Record<string, boolean> = {};
    
    fields.forEach(field => {
      if (!field.showIf) {
        result[field.name] = true;
        return;
      }
      
      const { field: parentField, operator, value } = field.showIf;
      const parentValue = formValues[parentField];
      
      result[field.name] = evaluateCondition(parentValue, operator, value);
    });
    
    return result;
  });
  
  return { isFieldVisible: (name: string) => visibilityMap.value[name] ?? true };
}
```

**Supported Operators**:
- `equals`: Strict equality (===)
- `notEquals`: Strict inequality (!==)
- `contains`: String includes or array includes
- `greaterThan`, `lessThan`: Numeric comparisons
- `isEmpty`, `isNotEmpty`: Null/undefined/empty string checks

**Alternatives Considered**:
- **Watchers**: Rejected - requires manual dependency tracking, imperative code
- **Template-based v-if**: Rejected - cannot be driven by config, duplicates logic
- **External rules engine**: Rejected - adds dependencies, over-engineered for simple conditions

---

### 5. Field Dependency & Data Sources

**Question**: How should we handle fields that load options from APIs and depend on other field values?

**Decision**: **Composable-based async data fetching with reactive dependencies**

**Rationale**:
- `useDataSource` composable encapsulates API call logic
- Watches parent field values and refetches when dependencies change
- Loading states managed locally per field
- Error handling with retry capability
- Uses Axios for consistent API integration

**Implementation Approach**:
```typescript
// In useDataSource.ts
export function useDataSource(
  field: FieldDefinition,
  formValues: Ref<Record<string, any>>
) {
  const options = ref<SelectOption[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  const fetchOptions = async () => {
    if (!field.dataSource) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      const response = await apiService.get(field.dataSource.endpoint, {
        params: buildParams(field.dataSource.params, formValues.value)
      });
      
      options.value = mapResponseToOptions(
        response.data,
        field.dataSource.from,
        field.dataSource.to
      );
    } catch (err) {
      error.value = 'Failed to load options';
    } finally {
      loading.value = false;
    }
  };
  
  // Watch dependencies and refetch
  if (field.dependency) {
    watch(
      () => formValues.value[field.dependency!.parent],
      (newValue, oldValue) => {
        if (newValue !== oldValue) {
          if (field.dependency!.resetOnChange) {
            formValues.value[field.name] = null;
          }
          fetchOptions();
        }
      }
    );
  }
  
  onMounted(() => {
    if (!field.dependency) {
      fetchOptions(); // Load immediately if no dependencies
    }
  });
  
  return { options, loading, error, refetch: fetchOptions };
}
```

**Data Source Configuration**:
```typescript
{
  dataSource: {
    endpoint: '/api/states',
    params: { countryId: 'form:country' }, // Resolved from form values
    from: 'data.states', // Path in response
    to: { label: 'name', value: 'id' } // Mapping
  },
  dependency: {
    parent: 'country',
    resetOnChange: true // Clear value when country changes
  }
}
```

**Alternatives Considered**:
- **Single bulk API call**: Rejected - inefficient for large datasets, couples unrelated data
- **Static options in config**: Rejected - doesn't support dynamic scenarios (country → states)
- **Manual fetch in components**: Rejected - duplicates logic across components, no error handling

---

### 6. Token Resolution for API Integration

**Question**: How should we resolve dynamic tokens (store:*, form:*, response:*) in API requests?

**Decision**: **Token resolver service with Axios interceptors**

**Rationale**:
- Centralized token resolution logic
- Axios request interceptor resolves tokens before sending
- Supports: `form:fieldName` (current form values), `store:key` (app state), `response:path` (previous response)
- Type-safe with TypeScript

**Implementation Approach**:
```typescript
// In token.service.ts
export class TokenResolver {
  constructor(
    private formValues: Ref<Record<string, any>>,
    private appStore: Record<string, any>,
    private responseCache: Record<string, any>
  ) {}
  
  resolve(value: string): any {
    if (typeof value !== 'string') return value;
    
    const formMatch = value.match(/^form:(.+)$/);
    if (formMatch) {
      return this.formValues.value[formMatch[1]];
    }
    
    const storeMatch = value.match(/^store:(.+)$/);
    if (storeMatch) {
      return this.appStore[storeMatch[1]];
    }
    
    const responseMatch = value.match(/^response:(.+)$/);
    if (responseMatch) {
      return get(this.responseCache, responseMatch[1]); // lodash.get or custom
    }
    
    return value; // No token, return as-is
  }
  
  resolveObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    Object.entries(obj).forEach(([key, value]) => {
      result[key] = this.resolve(value);
    });
    return result;
  }
}

// In Axios interceptor
axiosInstance.interceptors.request.use(config => {
  if (config.params) {
    config.params = tokenResolver.resolveObject(config.params);
  }
  if (config.data) {
    config.data = tokenResolver.resolveObject(config.data);
  }
  return config;
});
```

**Alternatives Considered**:
- **Template literals**: Rejected - not type-safe, requires eval-like parsing
- **Manual resolution per API call**: Rejected - duplicates logic, error-prone
- **No token support**: Rejected - doesn't meet functional requirements

---

### 7. Payload Mapping & Submission

**Question**: How should we transform form values into the final submission payload?

**Decision**: **Payload builder with submitField mapping rules**

**Rationale**:
- Config defines `submitField` mappings to rename/restructure fields
- Supports nested object creation (dot notation: `user.profile.name`)
- Type conversion based on field types (string → number, string → boolean)
- Filters out conditional fields that are hidden

**Implementation Approach**:
```typescript
// In payloadBuilder.ts
export function buildSubmissionPayload(
  formValues: Record<string, any>,
  fields: FieldDefinition[]
): Record<string, any> {
  const payload: Record<string, any> = {};
  
  fields.forEach(field => {
    // Skip hidden conditional fields
    if (field.showIf && !isFieldVisible(field, formValues)) {
      return;
    }
    
    const value = formValues[field.name];
    const targetPath = field.submitField || field.name;
    
    // Convert type
    const typedValue = convertType(value, field.type);
    
    // Set value at path (supports nested: user.profile.name)
    set(payload, targetPath, typedValue);
  });
  
  return payload;
}

function convertType(value: any, fieldType: string): any {
  switch (fieldType) {
    case 'number':
      return typeof value === 'string' ? parseFloat(value) : value;
    case 'checkbox':
      return Boolean(value);
    case 'multi-select':
      return Array.isArray(value) ? value : [value];
    default:
      return value;
  }
}
```

**Alternatives Considered**:
- **Direct form values**: Rejected - doesn't support renaming or restructuring
- **Manual mapping per form**: Rejected - duplicates logic, not config-driven
- **GraphQL-style queries**: Rejected - over-engineered, adds complexity

---

### 8. Accessibility Implementation

**Question**: What accessibility features are essential for WCAG 2.1 AA compliance?

**Decision**: **Built-in accessibility in base components**

**Rationale**:
- Each base component implements ARIA attributes
- Keyboard navigation handled at FormRenderer level
- Focus management for step transitions
- Screen reader announcements for errors and state changes

**Required Features**:
1. **Semantic HTML**: `<form>`, `<label>`, `<button>`, proper input types
2. **ARIA labels**: `aria-label`, `aria-describedby` for help text
3. **ARIA live regions**: `aria-live="polite"` for validation errors
4. **Focus management**: Auto-focus first field on step change
5. **Keyboard shortcuts**:
   - Tab: Navigate between fields
   - Enter: Submit form (when on input)
   - Escape: Close modal/cancel action
   - Arrow keys: Navigate radio/checkbox groups
6. **Color contrast**: 4.5:1 for text, 3:1 for UI components
7. **Touch targets**: Minimum 44×44px (enforced in Tailwind config)

**Implementation Approach**:
```vue
<!-- BaseInput.vue -->
<template>
  <div class="field-wrapper">
    <label :for="id" class="field-label">
      {{ label }}
      <span v-if="required" class="text-red-500" aria-label="required">*</span>
    </label>
    
    <input
      :id="id"
      :type="type"
      :aria-describedby="helpText ? `${id}-help` : undefined"
      :aria-invalid="hasError"
      :aria-errormessage="hasError ? `${id}-error` : undefined"
      class="field-input"
      v-bind="$attrs"
    />
    
    <p v-if="helpText" :id="`${id}-help`" class="field-help">{{ helpText }}</p>
    
    <div 
      v-if="hasError" 
      :id="`${id}-error`" 
      role="alert" 
      aria-live="polite"
      class="field-error"
    >
      {{ errorMessage }}
    </div>
  </div>
</template>
```

**Alternatives Considered**:
- **Third-party a11y library**: Rejected - adds dependencies, base components sufficient
- **Post-render ARIA injection**: Rejected - fragile, hard to maintain
- **Accessibility as optional**: Rejected - violates constitution (Principle III)

---

## Summary of Key Decisions

| Decision Area | Chosen Approach | Primary Benefit |
|---------------|-----------------|-----------------|
| **Form Rendering** | Component-based with type dispatch | Type safety, extensibility, maintainability |
| **Validation** | Zod | TypeScript inference, 14KB, excellent errors |
| **State Management** | Reactive refs + provide/inject | No external lib, simple, Vue 3 native |
| **Conditional Logic** | Computed properties | Reactive, automatic dependency tracking |
| **Data Sources** | Composable + Axios | Reusable, error handling, loading states |
| **Token Resolution** | Service + Axios interceptors | Centralized, type-safe, DRY |
| **Payload Building** | Mapper with dot notation | Flexible restructuring, type conversion |
| **Accessibility** | Built-in base components | WCAG AA compliance, zero external deps |

**Total Dependencies Added**: 2 (Zod 14KB + Axios 13KB = 27KB gzipped)  
**Estimated Implementation Time**: 40-50 hours for MVP (User Story 1)  
**Key Risks Mitigated**: Circular dependencies (detected early), XSS (Vue escaping), bundle size (audited), type safety (strict TS mode)

---

## Next Steps

1. **Phase 1 - Design**: Create data-model.md with detailed TypeScript interfaces for all entities
2. **Phase 1 - Contracts**: Define component prop types and API contracts in contracts/ directory
3. **Phase 1 - Quickstart**: Document demo setup and 15 manual verification scenarios
4. **Phase 2 - Tasks**: Generate actionable task list organized by user story (via /speckit.tasks)
5. **Phase 3 - Implementation**: Execute tasks in priority order (P1 MVP first)
