# Vue3 Composition API + <script setup> + TypeScript. NO Options API.

This project demonstrates the use of Vue 3's Composition API with `<script setup>` syntax and TypeScript. It avoids the Options API entirely for a more modern and streamlined approach.

## Features

- **TypeScript**: Strongly typed components and props.
- **Composition API**: Simplified logic and reusability.
- **`<script setup>`**: Minimal boilerplate and improved readability.

## Getting Started

1. Clone the repository.
2. Install dependencies using `npm install` or `yarn install`.
3. Run the development server with `npm run dev` or `yarn dev`.

## Components

### Base Components

The project includes reusable base components such as:

- **BaseInput**: A customizable input field.
- **BaseTextarea**: A textarea with built-in validation.
- **BaseCheckbox**: A checkbox with accessibility features.
- **BaseRadio**: A radio button group.
- **BaseButton**: A button with multiple variants and sizes.

### Example Usage

```vue
<template>
  <BaseInput
    id="example"
    v-model="inputValue"
    placeholder="Enter text here"
    :required="true"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';

const inputValue = ref('');
</script>
```

## Contributing

Contributions are welcome! Please follow the guidelines outlined in `CONTRIBUTING.md`.

## License

This project is licensed under the MIT License. See `LICENSE` for details.
