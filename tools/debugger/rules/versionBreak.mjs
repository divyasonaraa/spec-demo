// Detects missing required config properties and structure issues
export default function versionBreak({ config }) {
    const findings = []
    
    // REAL PROBLEM: Missing required id field
    if (!config.id) {
        findings.push({
            severity: 'error',
            title: 'Config missing required "id" field',
            explanation: `Config doesn't have an "id" property. The id is required to uniquely identify this form config in the system. Without it, you can't: (1) Track form submissions, (2) Cache form configs, (3) Reference this form from other configs, (4) Debug which config caused issues. Add a unique id following pattern: "domain-purpose-version".`,
            jsonPaths: ['id'],
            reproducerState: {},
            fixGuidance: [
                `Add unique id: "id": "contact-form-001"`,
                `Use descriptive naming: "${config.metadata?.title?.toLowerCase().replace(/\s+/g, '-') || 'my-form'}-001"`,
                `Include version in id for tracking: "user-registration-v2"`,
                `Make it URL-safe: lowercase, hyphens only, no special characters`
            ]
        })
    }
    
    // REAL PROBLEM: Missing metadata
    if (!config.metadata) {
        findings.push({
            severity: 'warning',
            title: 'Config missing metadata section',
            explanation: `Config doesn't have a "metadata" object. Metadata provides important context: title (shown to users), description (for developers), version (for tracking changes), tags (for searching). Without metadata, the form is hard to identify in admin panels and search results. It's not required but strongly recommended.`,
            jsonPaths: ['metadata'],
            reproducerState: {},
            fixGuidance: [
                `Add metadata object: { "metadata": { "title": "${config.id || 'My Form'}", "description": "...", "version": "1.0.0" } }`,
                `Include version for tracking: "version": "1.0.0" (use semantic versioning)`,
                `Add tags for discoverability: "tags": ["contact", "lead-gen", "production"]`,
                `Document purpose: "description": "Collects user contact info for sales team"`
            ]
        })
    } else {
        // Check metadata completeness
        if (!config.metadata.title) {
            findings.push({
                severity: 'info',
                title: 'Metadata missing "title"',
                explanation: `Config metadata doesn't have a "title" field. The title is shown in form headers and admin UI. Users see "Untitled Form" which looks unprofessional. Add a clear, user-friendly title.`,
                jsonPaths: ['metadata.title'],
                reproducerState: {},
                fixGuidance: [
                    `Add title: "title": "Contact Information Form"`,
                    `Make it user-facing (not technical): "User Registration" not "UserReg-v2"`,
                    `Keep it concise: 2-5 words is ideal`
                ]
            })
        }
        
        if (!config.metadata.version) {
            findings.push({
                severity: 'info',
                title: 'Metadata missing "version"',
                explanation: `Config metadata doesn't have a "version" field. Versioning helps track config changes over time, debug issues with specific versions, and manage rollbacks. Add semantic version (major.minor.patch) to track breaking changes, new features, and bug fixes.`,
                jsonPaths: ['metadata.version'],
                reproducerState: {},
                fixGuidance: [
                    `Add version: "version": "1.0.0"`,
                    `Use semantic versioning: MAJOR.MINOR.PATCH (e.g., "2.1.3")`,
                    `Increment MAJOR for breaking changes (remove fields, change validation)`,
                    `Increment MINOR for new fields/features, PATCH for bug fixes`
                ]
            })
        }
    }
    
    // REAL PROBLEM: Empty or missing steps array
    if (!config.steps || !Array.isArray(config.steps)) {
        findings.push({
            severity: 'error',
            title: 'Config missing "steps" array',
            explanation: `Config doesn't have a "steps" property or it's not an array. The steps array is required - it defines all the form fields and structure. Without steps, there's no form to render. This is a critical structural error that will crash the form renderer.`,
            jsonPaths: ['steps'],
            reproducerState: {},
            fixGuidance: [
                `Add steps array: "steps": [{ "id": "step-1", "title": "...", "fields": [...] }]`,
                `Minimum structure: { "id": "step-1", "title": "Main", "fields": [] }`,
                `Each step needs: id (unique), title (shown to user), fields (array of field objects)`,
                `Start with one step and add more for multi-step forms`
            ]
        })
    } else if (config.steps.length === 0) {
        findings.push({
            severity: 'error',
            title: 'Config has empty steps array',
            explanation: `Config has "steps": [] with no steps defined. A form must have at least one step with fields. Empty forms can't be rendered or submitted. Add at least one step with fields to make this a functional form.`,
            jsonPaths: ['steps'],
            reproducerState: {},
            fixGuidance: [
                `Add a step: "steps": [{ "id": "main", "title": "Form", "description": "Fill out the form", "fields": [{ "name": "email", "type": "email", "label": "Email", "validation": { "required": true } }] }]`,
                `Copy from examples: check public/examples/basic-form.json for starter template`,
                `Start simple: add one text field, test it works, then add more fields`
            ]
        })
    }
    
    // Check each step for required properties
    config.steps?.forEach((step, index) => {
        if (!step.id) {
            findings.push({
                severity: 'error',
                title: `Step ${index + 1} missing "id" property`,
                explanation: `Step at position ${index + 1} ("${step.title || 'untitled'}") doesn't have an "id" property. Step IDs are required to: (1) Track which step user is on, (2) Reference steps in navigation, (3) Debug step-specific issues. Add a unique ID using kebab-case.`,
                jsonPaths: [`steps[${index}].id`],
                reproducerState: {},
                fixGuidance: [
                    `Add id: "id": "${step.title?.toLowerCase().replace(/\s+/g, '-') || `step-${index + 1}`}"`,
                    `Use descriptive IDs: "personal-info", "contact-details", "preferences"`,
                    `Must be unique within this config`
                ]
            })
        }
        
        if (!step.fields || !Array.isArray(step.fields)) {
            findings.push({
                severity: 'error',
                title: `Step "${step.id || index + 1}" missing "fields" array`,
                explanation: `Step "${step.title || step.id || index + 1}" doesn't have a "fields" array. Every step must have fields - even if it's just one field. Empty steps create navigation issues and confuse users. Add at least one field or remove this step.`,
                jsonPaths: [`steps[${index}].fields`],
                reproducerState: {},
                fixGuidance: [
                    `Add fields array: "fields": [{ "name": "fieldName", "type": "text", "label": "Label" }]`,
                    `If step should be empty (informational only), use a single readonly text field with helpText`,
                    `Remove step if it has no purpose`
                ]
            })
        } else if (step.fields.length === 0) {
            findings.push({
                severity: 'warning',
                title: `Step "${step.id || index + 1}" has no fields`,
                explanation: `Step "${step.title || step.id}" has an empty fields array. Empty steps create poor UX - users see a step with no content. If this is intentional (e.g., review/confirmation step), add explanatory text. Otherwise, add fields or remove the step.`,
                jsonPaths: [`steps[${index}].fields`],
                reproducerState: {},
                fixGuidance: [
                    `Add at least one field to make step functional`,
                    `If review step, add readonly summary fields`,
                    `If confirmation step, add checkbox: "I confirm the information is correct"`,
                    `Remove step if not needed`
                ]
            })
        }
    })
    
    return findings
}