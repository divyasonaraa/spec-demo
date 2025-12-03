# Component Contracts Summary

**Feature**: 001-form-config-generator  
**Date**: 2025-12-01

## Overview

All TypeScript interface definitions are documented in **data-model.md**, which serves as the complete contract specification for this feature.

## Core Contracts

See **data-model.md** for detailed TypeScript interfaces:

1. **FormConfig** - Root configuration object
2. **StepConfig** - Multi-step form definition  
3. **FieldDefinition** - Individual field specification
4. **ValidationRule** - Zod validation mapping
5. **ConditionalRule** - Visibility/conditional logic
6. **DataSourceConfig** - API-driven select options
7. **DependencyConfig** - Field dependency management
8. **SubmitConfig** - Form submission behavior
9. **FormState** - Runtime state management
10. **SubmissionPayload** - API request structure

## Component Prop Types

All Vue components accept props derived from entities in data-model.md:

- **FormRenderer**: Props = `{ config: FormConfig }`
- **BaseInput**: Props = Extract from `FieldDefinition` + native input attrs
- **BaseSelect**: Props = Extract from `FieldDefinition` + `{ options: SelectOption[] }`
- **StepIndicator**: Props = `{ steps: StepConfig[], currentStep: number }`

## Service Contracts

### ApiService
```typescript
class ApiService {
  get<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T>;
  post<T>(endpoint: string, data: any, config?: AxiosRequestConfig): Promise<T>;
}
```

### ValidationService
```typescript
class ValidationService {
  buildSchema(fields: FieldDefinition[]): ZodSchema;
  validate(values: Record<string, any>, schema: ZodSchema): ValidationResult;
}
```

### TokenResolverService
```typescript
class TokenResolver {
  resolve(value: string): any;
  resolveObject(obj: Record<string, any>): Record<string, any>;
}
```

**Full implementation details**: See research.md sections 2, 5, 6
