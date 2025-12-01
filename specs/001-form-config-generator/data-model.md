# Data Model: Dynamic Form Config Generator

**Feature**: 001-form-config-generator  
**Date**: 2025-12-01  
**Purpose**: Define core entities, relationships, and TypeScript interfaces for the form configuration and rendering system

## Entity Relationship Diagram

```
FormConfig
  ├── metadata (FormMetadata)
  ├── steps[] (StepConfig[])
  │   └── fields[] (FieldDefinition[])
  │       ├── validation (ValidationRule)
  │       ├── showIf (ConditionalRule)
  │       ├── dataSource (DataSourceConfig)
  │       └── dependency (DependencyConfig)
  └── submitConfig (SubmitConfig)

FieldDefinition
  ├── type (FieldType enum)
  ├── component (ComponentName)
  └── props (Record<string, any>)

FormState (runtime)
  ├── values (Record<string, any>)
  ├── errors (Record<string, ZodIssue[]>)
  ├── touched (Set<string>)
  └── currentStep (number)

SubmissionPayload
  └── [dynamic structure based on submitField mappings]
```

## Core Entities

### 1. FormConfig

**Purpose**: Root configuration object defining complete form structure, behavior, and metadata

**TypeScript Interface**:

```typescript
interface FormConfig {
  /** Unique identifier for this form configuration */
  id: string;
  
  /** Form metadata (title, description, version) */
  metadata: FormMetadata;
  
  /** Array of form steps (single-step forms have one step) */
  steps: StepConfig[];
  
  /** Submission configuration (API endpoint, method, headers, success/error transitions) */
  submitConfig?: SubmitConfig;
  
  /** Global form-level validation rules (cross-field validation) */
  globalValidation?: GlobalValidationRule[];
}

interface FormMetadata {
  /** Display title for the form */
  title: string;
  
  /** Optional description/instructions */
  description?: string;
  
  /** Schema version for backward compatibility */
  version: string; // e.g., "1.0.0"
  
  /** Tags for categorization */
  tags?: string[];
}
```

**Relationships**:
- **Has many** StepConfig (1:N)
- **Has one** SubmitConfig (1:1, optional)
- **Contains** FormMetadata (1:1)

**Validation Rules**:
- `id` must be unique, non-empty string
- `metadata.version` must follow semver format
- `steps` array must have at least one step
- If multi-step, each step must have a `title`

**Example**:
```typescript
const formConfig: FormConfig = {
  id: 'user-registration',
  metadata: {
    title: 'User Registration',
    description: 'Create a new user account',
    version: '1.0.0',
    tags: ['auth', 'onboarding']
  },
  steps: [/* ... */],
  submitConfig: {
    endpoint: '/api/users/register',
    method: 'POST'
  }
};
```

---

### 2. StepConfig

**Purpose**: Defines a single step in a multi-step form, containing fields and navigation rules

**TypeScript Interface**:

```typescript
interface StepConfig {
  /** Unique identifier for this step within the form */
  id: string;
  
  /** Display title for step (shown in step indicator) */
  title: string;
  
  /** Optional description/instructions for this step */
  description?: string;
  
  /** Fields to display in this step */
  fields: FieldDefinition[];
  
  /** Conditional visibility for entire step */
  showIf?: ConditionalRule;
  
  /** Custom validation for this step (runs before allowing Next) */
  stepValidation?: StepValidationRule;
}

interface StepValidationRule {
  /** Custom validation function (async supported) */
  validator?: string; // Function name or inline code (eval'd safely)
  
  /** Error message to show if step validation fails */
  errorMessage: string;
}
```

**Relationships**:
- **Belongs to** FormConfig (N:1)
- **Has many** FieldDefinition (1:N)
- **May have** ConditionalRule (1:1, optional)

**Validation Rules**:
- `id` must be unique within form
- `fields` array must have at least one field
- If `showIf` present, must reference existing field in previous steps

**Example**:
```typescript
const step: StepConfig = {
  id: 'personal-info',
  title: 'Personal Information',
  description: 'Tell us about yourself',
  fields: [
    { name: 'firstName', type: 'text', label: 'First Name', /* ... */ },
    { name: 'lastName', type: 'text', label: 'Last Name', /* ... */ }
  ]
};
```

---

### 3. FieldDefinition

**Purpose**: Defines a single form field with type, validation, conditional logic, and data binding

**TypeScript Interface**:

```typescript
type FieldType = 
  | 'text' | 'email' | 'password' | 'number' | 'tel' | 'url'
  | 'textarea' | 'select' | 'multi-select' | 'checkbox' | 'radio'
  | 'date' | 'time' | 'datetime' | 'toggle' | 'file';

interface FieldDefinition {
  /** Unique field name (used as key in form values and payload) */
  name: string;
  
  /** Field type determines which component renders it */
  type: FieldType;
  
  /** Display label */
  label: string;
  
  /** Placeholder text */
  placeholder?: string;
  
  /** Help text displayed below field */
  helpText?: string;
  
  /** Default value */
  defaultValue?: any;
  
  /** Validation rules */
  validation?: ValidationRule;
  
  /** Conditional visibility based on other fields */
  showIf?: ConditionalRule;
  
  /** Data source configuration for select/radio options */
  dataSource?: DataSourceConfig;
  
  /** Field dependency configuration */
  dependency?: DependencyConfig;
  
  /** Custom properties passed to field component */
  props?: Record<string, any>;
  
  /** Mapping to different key in submission payload */
  submitField?: string; // Supports dot notation: "user.profile.name"
  
  /** Disable field (computed or static) */
  disabled?: boolean;
  
  /** CSS classes for custom styling */
  className?: string;
}
```

**Relationships**:
- **Belongs to** StepConfig (N:1)
- **Has one** ValidationRule (1:1, optional)
- **Has one** ConditionalRule (1:1, optional)
- **Has one** DataSourceConfig (1:1, optional)
- **Has one** DependencyConfig (1:1, optional)

**Validation Rules**:
- `name` must be unique within form, valid identifier (alphanumeric + underscore)
- `type` must be one of supported FieldType values
- `submitField` if present, must be valid dot-notation path
- If `dataSource` present, type must be 'select', 'multi-select', or 'radio'
- If `dependency` present, `dependency.parent` must reference existing field

**Example**:
```typescript
const field: FieldDefinition = {
  name: 'email',
  type: 'email',
  label: 'Email Address',
  placeholder: 'you@example.com',
  helpText: 'We\'ll never share your email',
  validation: {
    required: true,
    requiredMessage: 'Email is required',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    patternMessage: 'Invalid email format'
  },
  submitField: 'user.contact.email'
};
```

---

### 4. ValidationRule

**Purpose**: Defines validation constraints for a field

**TypeScript Interface**:

```typescript
interface ValidationRule {
  /** Field is required */
  required?: boolean;
  requiredMessage?: string;
  
  /** Minimum length (for strings) */
  minLength?: number;
  minLengthMessage?: string;
  
  /** Maximum length (for strings) */
  maxLength?: number;
  maxLengthMessage?: string;
  
  /** Minimum value (for numbers) */
  min?: number;
  minMessage?: string;
  
  /** Maximum value (for numbers) */
  max?: number;
  maxMessage?: string;
  
  /** Regex pattern */
  pattern?: string | RegExp;
  patternMessage?: string;
  
  /** Email validation */
  email?: boolean;
  emailMessage?: string;
  
  /** URL validation */
  url?: boolean;
  urlMessage?: string;
  
  /** Custom validator function */
  custom?: {
    validator: string; // Function name or code
    message: string;
    async?: boolean;
  };
  
  /** Conditional validation (only validate if condition met) */
  validateIf?: ConditionalRule;
}
```

**Zod Schema Mapping**:
- `required: true` → `z.string().min(1)` or type-appropriate non-optional
- `minLength` → `z.string().min(n)`
- `pattern` → `z.string().regex(pattern)`
- `email: true` → `z.string().email()`
- `url: true` → `z.string().url()`
- `custom` → `z.string().refine(fn, { message })`

**Example**:
```typescript
const validation: ValidationRule = {
  required: true,
  requiredMessage: 'Password is required',
  minLength: 8,
  minLengthMessage: 'Password must be at least 8 characters',
  pattern: /^(?=.*[A-Z])(?=.*[0-9])/,
  patternMessage: 'Password must contain uppercase and number'
};
```

---

### 5. ConditionalRule

**Purpose**: Defines when a field or step should be visible based on other field values

**TypeScript Interface**:

```typescript
type ConditionalOperator =
  | 'equals' | 'notEquals'
  | 'contains' | 'notContains'
  | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual'
  | 'isEmpty' | 'isNotEmpty'
  | 'in' | 'notIn';

interface ConditionalRule {
  /** Field name to check */
  field: string;
  
  /** Comparison operator */
  operator: ConditionalOperator;
  
  /** Value to compare against (not needed for isEmpty/isNotEmpty) */
  value?: any;
  
  /** Multiple conditions with AND/OR logic */
  and?: ConditionalRule[];
  or?: ConditionalRule[];
}
```

**Evaluation Logic**:
```typescript
function evaluateCondition(
  condition: ConditionalRule,
  formValues: Record<string, any>
): boolean {
  const fieldValue = formValues[condition.field];
  
  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;
    case 'notEquals':
      return fieldValue !== condition.value;
    case 'contains':
      return String(fieldValue).includes(String(condition.value));
    case 'greaterThan':
      return Number(fieldValue) > Number(condition.value);
    case 'isEmpty':
      return fieldValue == null || fieldValue === '';
    case 'isNotEmpty':
      return fieldValue != null && fieldValue !== '';
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    // ... other operators
  }
  
  // Handle AND/OR
  if (condition.and) {
    return condition.and.every(c => evaluateCondition(c, formValues));
  }
  if (condition.or) {
    return condition.or.some(c => evaluateCondition(c, formValues));
  }
  
  return true;
}
```

**Example**:
```typescript
const conditionalRule: ConditionalRule = {
  field: 'country',
  operator: 'equals',
  value: 'USA',
  and: [
    { field: 'age', operator: 'greaterThanOrEqual', value: 18 }
  ]
};
// Shows field only if country is USA AND age >= 18
```

---

### 6. DataSourceConfig

**Purpose**: Defines how to fetch options for select/radio fields from APIs

**TypeScript Interface**:

```typescript
interface DataSourceConfig {
  /** API endpoint to fetch options from */
  endpoint: string;
  
  /** HTTP method */
  method?: 'GET' | 'POST';
  
  /** Query parameters (supports token resolution) */
  params?: Record<string, any>;
  
  /** Request body for POST requests */
  body?: Record<string, any>;
  
  /** Path to options array in response (dot notation) */
  from: string; // e.g., "data.states"
  
  /** Mapping from response objects to select options */
  to: {
    label: string; // Key for option label
    value: string; // Key for option value
  };
  
  /** Headers to include in request */
  headers?: Record<string, string>;
  
  /** Cache options (prevent redundant API calls) */
  cache?: {
    enabled: boolean;
    ttl?: number; // Time to live in seconds
  };
}
```

**Token Resolution**:
- `form:fieldName` → Current value of field in form
- `store:key` → Value from application store
- `response:path` → Value from previous API response

**Example**:
```typescript
const dataSource: DataSourceConfig = {
  endpoint: '/api/states',
  method: 'GET',
  params: {
    countryId: 'form:country' // Resolved to formValues.country
  },
  from: 'data',
  to: {
    label: 'name',
    value: 'id'
  },
  cache: {
    enabled: true,
    ttl: 300 // 5 minutes
  }
};
```

---

### 7. DependencyConfig

**Purpose**: Defines field dependencies where child field behavior depends on parent field value

**TypeScript Interface**:

```typescript
interface DependencyConfig {
  /** Parent field name that this field depends on */
  parent: string;
  
  /** Reset this field's value when parent changes */
  resetOnChange?: boolean; // Default: true
  
  /** Disable this field until parent has a value */
  disableUntilParent?: boolean; // Default: true
  
  /** Reload dataSource when parent changes */
  reloadOnParentChange?: boolean; // Default: true
}
```

**Behavior**:
1. Child field is disabled until parent has a value
2. When parent value changes:
   - Child value is reset (if `resetOnChange: true`)
   - Child dataSource is reloaded (if `reloadOnParentChange: true` and has dataSource)
3. Child field's dataSource can reference parent value via `form:parentName` token

**Example**:
```typescript
// State field depends on Country field
const stateField: FieldDefinition = {
  name: 'state',
  type: 'select',
  label: 'State',
  dataSource: {
    endpoint: '/api/states',
    params: { countryId: 'form:country' }
    from: 'data',
    to: { label: 'name', value: 'id' }
  },
  dependency: {
    parent: 'country',
    resetOnChange: true,
    disableUntilParent: true,
    reloadOnParentChange: true
  }
};
```

---

### 8. SubmitConfig

**Purpose**: Defines form submission behavior, API endpoint, and state transitions

**TypeScript Interface**:

```typescript
interface SubmitConfig {
  /** API endpoint for form submission */
  endpoint: string;
  
  /** HTTP method */
  method: 'POST' | 'PUT' | 'PATCH';
  
  /** Request headers (supports token resolution) */
  headers?: Record<string, string>;
  
  /** State transitions based on API response */
  stateTransitions?: {
    onSuccess?: StateTransition;
    onError?: StateTransition;
  };
  
  /** Transform payload before submission */
  transformPayload?: {
    include?: string[]; // Only include these fields
    exclude?: string[]; // Exclude these fields
    rename?: Record<string, string>; // Rename fields
  };
}

interface StateTransition {
  /** Action to perform */
  action: 'navigate' | 'nextStep' | 'showMessage' | 'callApi';
  
  /** Target for action (URL for navigate, message for showMessage, endpoint for callApi) */
  target?: string;
  
  /** Success/error message */
  message?: string;
  
  /** Delay before action (milliseconds) */
  delay?: number;
}
```

**Example**:
```typescript
const submitConfig: SubmitConfig = {
  endpoint: '/api/users',
  method: 'POST',
  headers: {
    'Authorization': 'store:authToken'
  },
  stateTransitions: {
    onSuccess: {
      action: 'showMessage',
      message: 'Registration successful! Redirecting...',
      delay: 2000,
      // Then: { action: 'navigate', target: '/dashboard' }
    },
    onError: {
      action: 'showMessage',
      message: 'Registration failed. Please try again.'
    }
  },
  transformPayload: {
    exclude: ['confirmPassword'],
    rename: {
      'email': 'emailAddress',
      'phone': 'phoneNumber'
    }
  }
};
```

---

### 9. FormState (Runtime)

**Purpose**: Runtime state management for form values, validation errors, and UI state

**TypeScript Interface**:

```typescript
interface FormState {
  /** Current form values (flat structure with field names as keys) */
  values: Record<string, any>;
  
  /** Validation errors per field (from Zod) */
  errors: Record<string, ZodIssue[]>;
  
  /** Fields that user has interacted with (for showing errors) */
  touched: Set<string>;
  
  /** Current step index (0-based) */
  currentStep: number;
  
  /** Submission state */
  submitState: {
    loading: boolean;
    success: boolean;
    error: string | null;
  };
  
  /** Field visibility map (computed from conditional rules) */
  visibility: Record<string, boolean>;
  
  /** Field loading states (for dataSource fetches) */
  fieldLoading: Record<string, boolean>;
}
```

**State Updates**:
- `values`: Updated on field change (v-model)
- `errors`: Updated on validation (debounced 300ms)
- `touched`: Updated on field blur
- `currentStep`: Updated on Next/Previous navigation
- `submitState`: Updated during submission lifecycle
- `visibility`: Computed reactively from conditional rules
- `fieldLoading`: Updated during async data source fetches

---

### 10. SubmissionPayload (Output)

**Purpose**: Final structured payload sent to API, transformed from form values

**TypeScript Interface**:

```typescript
type SubmissionPayload = Record<string, any>; // Dynamic structure

// Example: Nested structure based on submitField mappings
interface UserRegistrationPayload {
  user: {
    profile: {
      firstName: string;
      lastName: string;
    };
    contact: {
      email: string;
      phone: string;
    };
  };
  preferences: {
    newsletter: boolean;
    notifications: boolean;
  };
}
```

**Transformation Process**:
1. Extract values from `FormState.values`
2. Filter out hidden conditional fields (from `visibility` map)
3. Apply `submitField` mappings (rename with dot notation)
4. Convert types based on `FieldDefinition.type` (string → number, etc.)
5. Apply `SubmitConfig.transformPayload` (include, exclude, rename)
6. Resolve tokens in payload values (if any)

**Example Transformation**:
```typescript
// Form values (flat)
const formValues = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '555-1234',
  newsletter: true
};

// Field definitions with submitField mappings
const fields = [
  { name: 'firstName', submitField: 'user.profile.firstName' },
  { name: 'lastName', submitField: 'user.profile.lastName' },
  { name: 'email', submitField: 'user.contact.email' },
  { name: 'phone', submitField: 'user.contact.phone' },
  { name: 'newsletter', submitField: 'preferences.newsletter' }
];

// Transformed payload (nested)
const payload = {
  user: {
    profile: { firstName: 'John', lastName: 'Doe' },
    contact: { email: 'john@example.com', phone: '555-1234' }
  },
  preferences: { newsletter: true }
};
```

---

## Entity Summary

| Entity | Purpose | Key Properties | Relationships |
|--------|---------|----------------|---------------|
| **FormConfig** | Root config object | id, metadata, steps, submitConfig | Has many StepConfig |
| **StepConfig** | Multi-step definition | id, title, fields, showIf | Belongs to FormConfig, Has many FieldDefinition |
| **FieldDefinition** | Individual field spec | name, type, label, validation, showIf | Belongs to StepConfig |
| **ValidationRule** | Validation constraints | required, pattern, min/max, custom | Belongs to FieldDefinition |
| **ConditionalRule** | Visibility logic | field, operator, value, and/or | Used by FieldDefinition, StepConfig |
| **DataSourceConfig** | API-driven options | endpoint, params, from, to | Belongs to FieldDefinition |
| **DependencyConfig** | Field dependencies | parent, resetOnChange, disableUntilParent | Belongs to FieldDefinition |
| **SubmitConfig** | Submission behavior | endpoint, method, headers, transitions | Belongs to FormConfig |
| **FormState** | Runtime state | values, errors, touched, currentStep | Managed by FormRenderer |
| **SubmissionPayload** | API request body | Dynamic nested structure | Generated from FormState |

---

## Type Guards and Utilities

```typescript
// Type guard for multi-step forms
export function isMultiStepForm(config: FormConfig): boolean {
  return config.steps.length > 1;
}

// Type guard for field with data source
export function hasDataSource(field: FieldDefinition): field is FieldDefinition & { dataSource: DataSourceConfig } {
  return field.dataSource !== undefined;
}

// Type guard for conditional field
export function isConditional(field: FieldDefinition): field is FieldDefinition & { showIf: ConditionalRule } {
  return field.showIf !== undefined;
}

// Get all field names in form
export function getAllFieldNames(config: FormConfig): string[] {
  return config.steps.flatMap(step => step.fields.map(f => f.name));
}

// Detect circular dependencies
export function detectCircularDependencies(fields: FieldDefinition[]): string[] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const circular: string[] = [];
  
  function dfs(fieldName: string) {
    visited.add(fieldName);
    recursionStack.add(fieldName);
    
    const field = fields.find(f => f.name === fieldName);
    if (field?.showIf) {
      if (recursionStack.has(field.showIf.field)) {
        circular.push(`${fieldName} → ${field.showIf.field}`);
      } else if (!visited.has(field.showIf.field)) {
        dfs(field.showIf.field);
      }
    }
    
    recursionStack.delete(fieldName);
  }
  
  fields.forEach(f => {
    if (!visited.has(f.name)) {
      dfs(f.name);
    }
  });
  
  return circular;
}
```

---

## Next Phase

**Phase 1 Remaining**:
1. ✅ data-model.md (this document)
2. ⏳ contracts/ (TypeScript interfaces for components)
3. ⏳ quickstart.md (demo setup and manual verification)
4. ⏳ Update agent context

**Ready for**: Component contract definitions in `contracts/` directory
