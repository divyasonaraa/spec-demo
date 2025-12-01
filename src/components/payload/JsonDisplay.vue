<template>
    <div class="relative">
        <pre
            class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono"><code>{{ formattedJson }}</code></pre>

        <button type="button" @click="copyToClipboard"
            class="absolute top-2 right-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
            :class="{ 'bg-success-600 hover:bg-success-700': copied }">
            {{ copied ? 'Copied!' : 'Copy' }}
        </button>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface JsonDisplayProps {
    data: any
    indent?: number
}

const props = withDefaults(defineProps<JsonDisplayProps>(), {
    indent: 2,
})

const copied = ref(false)

const formattedJson = computed(() => {
    try {
        return JSON.stringify(props.data, null, props.indent)
    } catch (error) {
        return 'Invalid JSON data'
    }
})

async function copyToClipboard() {
    try {
        await navigator.clipboard.writeText(formattedJson.value)
        copied.value = true
        setTimeout(() => {
            copied.value = false
        }, 2000)
    } catch (error) {
        console.error('Failed to copy to clipboard:', error)
    }
}
</script>
