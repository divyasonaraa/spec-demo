<template>
    <div class="min-h-screen bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Header -->
            <div class="mb-8">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-3xl font-bold text-gray-900 mb-2">
                            Form Configuration Documentation
                        </h1>
                        <p class="text-gray-600">
                            Complete reference for building dynamic forms
                        </p>
                    </div>
                    <router-link to="/demo" class="text-primary-600 hover:text-primary-700 font-medium">
                        Try Live Demo →
                    </router-link>
                </div>
            </div>

            <!-- Search -->
            <div class="mb-6">
                <div class="relative">
                    <input v-model="searchQuery" type="text" placeholder="Search documentation..."
                        class="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    <svg class="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>

            <!-- Documentation Sections -->
            <div class="space-y-8">
                <section v-for="section in filteredSections" :key="section.id"
                    class="bg-white rounded-lg shadow-sm p-6">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">
                        {{ section.title }}
                    </h2>
                    <p class="text-gray-600 mb-6">{{ section.description }}</p>

                    <div class="space-y-6">
                        <div v-for="item in section.items" :key="item.id" class="border-l-4 border-primary-500 pl-4">
                            <h3 class="text-lg font-semibold text-gray-900 mb-2">
                                {{ item.title }}
                            </h3>
                            <p class="text-gray-600 mb-3">{{ item.description }}</p>

                            <div class="relative">
                                <pre
                                    class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm"><code>{{ item.example }}</code></pre>
                                <button @click="copyToClipboard(item.example)"
                                    class="absolute top-2 right-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors">
                                    Copy
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const searchQuery = ref('')

const sections = [
    {
        id: 'field-types',
        title: 'Field Types',
        description: 'All available form field types and their configurations',
        items: [
            {
                id: 'text-input',
                title: 'Text Input',
                description: 'Basic text input field with validation support',
                example: `{
  "name": "username",
  "label": "Username",
  "type": "text",
  "placeholder": "Enter username",
  "validation": {
    "required": true,
    "minLength": 3,
    "maxLength": 20
  }
}`
            },
            {
                id: 'email-input',
                title: 'Email Input',
                description: 'Email field with built-in email validation',
                example: `{
  "name": "email",
  "label": "Email Address",
  "type": "email",
  "placeholder": "you@example.com",
  "validation": {
    "required": true,
    "email": true
  }
}`
            },
            {
                id: 'select',
                title: 'Select Dropdown',
                description: 'Dropdown selection with static or dynamic options',
                example: `{
  "name": "country",
  "label": "Country",
  "type": "select",
  "props": {
    "options": [
      { "value": "us", "label": "United States" },
      { "value": "ca", "label": "Canada" }
    ]
  },
  "validation": {
    "required": true
  }
}`
            },
            {
                id: 'checkbox',
                title: 'Checkbox',
                description: 'Single checkbox for boolean values',
                example: `{
  "name": "agreeToTerms",
  "label": "I agree to the Terms of Service",
  "type": "checkbox",
  "defaultValue": false,
  "validation": {
    "required": true
  }
}`
            },
            {
                id: 'radio',
                title: 'Radio Group',
                description: 'Radio button group for single selection',
                example: `{
  "name": "subscription",
  "label": "Subscription Plan",
  "type": "radio",
  "props": {
    "options": [
      { "value": "free", "label": "Free" },
      { "value": "pro", "label": "Pro" },
      { "value": "enterprise", "label": "Enterprise" }
    ]
  },
  "validation": {
    "required": true
  }
}`
            }
        ]
    },
    {
        id: 'validation',
        title: 'Validation Rules',
        description: 'Configure field-level validation with custom error messages',
        items: [
            {
                id: 'required',
                title: 'Required Field',
                description: 'Make a field mandatory',
                example: `{
  "validation": {
    "required": true,
    "requiredMessage": "This field is required"
  }
}`
            },
            {
                id: 'length',
                title: 'Length Validation',
                description: 'Minimum and maximum length constraints',
                example: `{
  "validation": {
    "minLength": 8,
    "minLengthMessage": "Must be at least 8 characters",
    "maxLength": 100,
    "maxLengthMessage": "Cannot exceed 100 characters"
  }
}`
            },
            {
                id: 'pattern',
                title: 'Pattern Matching',
                description: 'Validate with regular expressions',
                example: `{
  "validation": {
    "pattern": "^[A-Z]{2}-\\\\d{7}$",
    "patternMessage": "Format must be XX-0000000"
  }
}`
            }
        ]
    },
    {
        id: 'conditional',
        title: 'Conditional Logic',
        description: 'Show or hide fields based on other field values',
        items: [
            {
                id: 'show-if',
                title: 'Conditional Visibility',
                description: 'Display field only when condition is met',
                example: `{
  "name": "companyName",
  "label": "Company Name",
  "type": "text",
  "showIf": {
    "field": "accountType",
    "operator": "equals",
    "value": "business"
  }
}`
            },
            {
                id: 'dependency',
                title: 'Field Dependencies',
                description: 'Create parent-child field relationships',
                example: `{
  "name": "state",
  "label": "State",
  "type": "select",
  "dependency": {
    "parent": "country",
    "resetOnChange": true,
    "disableUntilParent": true
  }
}`
            },
            {
                id: 'data-source',
                title: 'Dynamic Data Source',
                description: 'Load options from API endpoints',
                example: `{
  "name": "state",
  "label": "State",
  "type": "select",
  "dataSource": {
    "endpoint": "https://api.example.com/states",
    "method": "GET",
    "params": {
      "country": "form:country"
    },
    "from": "data.states",
    "to": {
      "label": "name",
      "value": "code"
    }
  }
}`
            }
        ]
    },
    {
        id: 'multi-step',
        title: 'Multi-Step Forms',
        description: 'Create forms with multiple steps and navigation',
        items: [
            {
                id: 'step-config',
                title: 'Step Configuration',
                description: 'Define form steps with titles and descriptions',
                example: `{
  "steps": [
    {
      "id": "personal-info",
      "title": "Personal Information",
      "description": "Tell us about yourself",
      "fields": [
        // ... fields
      ]
    },
    {
      "id": "contact-details",
      "title": "Contact Details",
      "description": "How can we reach you?",
      "fields": [
        // ... fields
      ]
    }
  ]
}`
            }
        ]
    }
]

const filteredSections = computed(() => {
    if (!searchQuery.value) {
        return sections
    }

    const query = searchQuery.value.toLowerCase()
    return sections
        .map(section => ({
            ...section,
            items: section.items.filter(item =>
                item.title.toLowerCase().includes(query) ||
                item.description.toLowerCase().includes(query) ||
                item.example.toLowerCase().includes(query)
            )
        }))
        .filter(section => section.items.length > 0)
})

function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
}
</script>
