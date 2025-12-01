# Dynamic Form Generator

A powerful, type-safe form configuration engine built with Vue 3, TypeScript, and Tailwind CSS. Generate complex, multi-step forms with conditional logic, field dependencies, and API-driven data sources from simple JSON configurations.

## ✨ Features

### Core Capabilities
- **📝 JSON-Driven Forms** - Define entire forms using declarative JSON configurations
- **🎯 Type-Safe** - Full TypeScript support with Zod validation
- **🎨 Tailwind Styling** - Beautiful, responsive UI with Tailwind CSS
- **♿ Accessible** - WCAG AA compliant with ARIA labels and keyboard navigation
- **📱 Responsive** - Mobile-first design that works on all screen sizes

### Advanced Features
- **🔀 Multi-Step Forms** - Break complex forms into manageable steps with navigation
- **🔍 Conditional Logic** - Show/hide fields based on user input with 12 operators
- **🔗 Field Dependencies** - Create parent-child relationships between fields
- **🌐 API Data Sources** - Load select options dynamically from REST APIs
- **⚡ Performance** - Debounced validation, response caching, and optimized rendering
- **🎭 State Management** - Track form state, errors, and submission status

### Developer Experience
- **📚 Comprehensive Documentation** - Searchable docs with copy-paste examples
- **✅ Config Validation** - Real-time validation with detailed error messages
- **🔄 Live Preview** - See changes instantly in the demo playground
- **📦 Sample Configs** - Pre-built examples for common use cases

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

Visit `http://localhost:5173` to see the demo.

## 📖 Documentation

- **[Live Demo](/demo)** - Interactive playground with sample forms
- **[Full Documentation](/docs)** - Complete API reference and examples
- **[Quickstart Guide](specs/001-form-config-generator/quickstart.md)** - Step-by-step integration guide
- **[Architecture](ARCHITECTURE.md)** - System design and component hierarchy

## 🎯 Basic Usage

### 1. Define Your Form Configuration

```typescript
import type { FormConfig } from '@/types/formConfig'

const myForm: FormConfig = {
  id: 'contact-form',
  metadata: {
    title: 'Contact Us',
    version: '1.0.0'
  },
  steps: [
    {
      id: 'contact-info',
      title: 'Contact Information',
      fields: [
        {
          name: 'email',
          type: 'email',
          label: 'Email Address',
          validation: {
            required: true,
            email: true
          }
        },
        {
          name: 'message',
          type: 'textarea',
          label: 'Message',
          validation: {
            required: true,
            minLength: 10
          }
        }
      ]
    }
  ],
  submitConfig: {
    endpoint: 'https://api.example.com/contact',
    method: 'POST'
  }
}
```

### 2. Render the Form

```vue
<template>
  <FormRenderer
    :config="myForm"
    @submit="handleSubmit"
  />
</template>

<script setup lang="ts">
import FormRenderer from '@/components/form/FormRenderer.vue'
import { myForm } from '@/config/myForm'

function handleSubmit(payload: any) {
  console.log('Form submitted:', payload)
}
</script>
```

## 🎨 Supported Field Types

| Type | Description | Props |
|------|-------------|-------|
| `text` | Single-line text input | placeholder, maxLength |
| `email` | Email input with validation | placeholder |
| `number` | Numeric input | min, max, step |
| `tel` | Telephone number | placeholder, pattern |
| `url` | URL input | placeholder |
| `password` | Password input | placeholder, minLength |
| `textarea` | Multi-line text | rows, maxLength |
| `select` | Dropdown selection | options, multiple |
| `checkbox` | Boolean checkbox | defaultValue |
| `radio` | Single selection from list | options |

## 🔍 Conditional Logic

Show/hide fields based on other field values:

```typescript
{
  name: 'companyName',
  type: 'text',
  label: 'Company Name',
  showIf: {
    field: 'accountType',
    operator: 'equals',
    value: 'business'
  }
}
```

### Available Operators
- `equals`, `notEquals`
- `contains`, `notContains`
- `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`
- `isEmpty`, `isNotEmpty`
- `in`, `notIn`

## 🔗 Field Dependencies

Create parent-child field relationships:

```typescript
{
  name: 'state',
  type: 'select',
  label: 'State',
  dependency: {
    parent: 'country',
    resetOnChange: true,
    disableUntilParent: true
  }
}
```

## 🌐 API Data Sources

Load options dynamically from APIs:

```typescript
{
  name: 'city',
  type: 'select',
  label: 'City',
  dataSource: {
    endpoint: 'https://api.example.com/cities',
    method: 'GET',
    params: {
      country: 'form:country'  // Token resolution
    },
    from: 'data.cities',
    to: {
      label: 'name',
      value: 'id'
    },
    cache: {
      enabled: true,
      ttl: 300  // 5 minutes
    }
  }
}
```

## ✅ Validation Rules

Powered by Zod for type-safe validation:

```typescript
validation: {
  required: true,
  minLength: 3,
  maxLength: 100,
  pattern: '^[A-Z]{2}-\\d{7}$',
  email: true,
  url: true,
  min: 18,
  max: 120,
  requiredMessage: 'Custom error message',
  patternMessage: 'Format must be XX-0000000'
}
```

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     FormRenderer                        │
│  (Orchestrates all composables and components)          │
└────────────┬────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌─────────┐     ┌──────────────┐
│  Steps  │     │  Validation  │
│ Manager │     │   Service    │
└─────────┘     └──────────────┘
    │                 │
    ▼                 ▼
┌─────────────────────────────────────┐
│      Field Components Layer         │
│  (BaseInput, BaseSelect, etc.)      │
└─────────────────────────────────────┘
```

### Key Components

- **FormRenderer** - Main orchestrator component
- **FieldWrapper** - Handles labels, help text, and error messages
- **Base Components** - Reusable input primitives (BaseInput, BaseSelect, etc.)
- **Composables** - Business logic (validation, submission, conditional logic)
- **Services** - Core utilities (validation, API client, token resolution)

## 🧪 Development

### Project Structure

```
src/
├── components/
│   ├── base/          # Reusable input components
│   ├── form/          # Form-specific components
│   ├── demo/          # Demo playground components
│   ├── common/        # Shared utilities
│   └── payload/       # Payload preview components
├── composables/       # Vue composables
├── services/          # Business logic services
├── types/             # TypeScript definitions
├── utils/             # Helper functions
├── config/            # Form configurations
│   └── samples/       # Example forms
└── views/             # Page components
```

### Tech Stack

- **Vue 3.5.13** - Progressive framework
- **TypeScript 5.7.2** - Type safety
- **Vite 5.4.21** - Fast build tool
- **Tailwind CSS 3.4.17** - Utility-first CSS
- **Zod 3.24.1** - Schema validation
- **Axios 1.7.9** - HTTP client
- **Vue Router 4.5.0** - Routing

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please read the [Quickstart Guide](specs/001-form-config-generator/quickstart.md) for development setup and architecture details.

## 🔗 Related Documentation

- [Constitution](specs/001-form-config-generator/constitution.md) - Project principles and constraints
- [Specification](specs/001-form-config-generator/spec.md) - Detailed requirements
- [Data Model](specs/001-form-config-generator/data-model.md) - Type definitions and schemas
- [Plan](specs/001-form-config-generator/plan.md) - Technical architecture
- [Tasks](specs/001-form-config-generator/tasks.md) - Implementation roadmap

