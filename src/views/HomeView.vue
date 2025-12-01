<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="max-w-4xl w-full">
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">
          Dynamic Form Config Generator
        </h1>
        <p class="text-lg text-gray-600 mb-8">
          Generate interactive forms from configuration objects
        </p>
      </div>

      <div class="bg-white rounded-lg shadow-lg p-8">
        <div class="grid md:grid-cols-2 gap-6">
          <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
            <h2 class="text-xl font-semibold text-gray-900 mb-2">
              Try the Demo
            </h2>
            <p class="text-gray-600 mb-4">
              Explore form generation with live examples
            </p>
            <router-link
              to="/demo"
              class="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Go to Demo →
            </router-link>
          </div>

          <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <h2 class="text-xl font-semibold text-gray-900 mb-2">
              Documentation
            </h2>
            <p class="text-gray-600 mb-4">
              Learn how to create form configurations
            </p>
            <button
              class="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors cursor-not-allowed opacity-50"
              disabled
            >
              Coming Soon
            </button>
          </div>
        </div>

        <div class="mt-8 pt-8 border-t border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Features</h3>
          <ul class="grid md:grid-cols-2 gap-3 text-gray-600">
            <li class="flex items-start">
              <span class="text-success-500 mr-2">✓</span>
              <span>Dynamic form generation from config</span>
            </li>
            <li class="flex items-start">
              <span class="text-success-500 mr-2">✓</span>
              <span>Real-time validation with Zod</span>
            </li>
            <li class="flex items-start">
              <span class="text-success-500 mr-2">✓</span>
              <span>Multi-step form support</span>
            </li>
            <li class="flex items-start">
              <span class="text-success-500 mr-2">✓</span>
              <span>Conditional field visibility</span>
            </li>
            <li class="flex items-start">
              <span class="text-success-500 mr-2">✓</span>
              <span>Mobile-responsive design</span>
            </li>
            <li class="flex items-start">
              <span class="text-success-500 mr-2">✓</span>
              <span>TypeScript type safety</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="mt-8 text-center text-gray-500 text-sm">
        <p>Built with Vue 3 + TypeScript + Tailwind CSS</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Home view - landing page
</script>
