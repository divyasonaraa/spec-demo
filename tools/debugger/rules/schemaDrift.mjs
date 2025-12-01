// Detects API endpoint and submission configuration issues
export default function schemaDrift({ config }) {
    const findings = []
    const submit = config.submitConfig
    
    if (!submit) {
        findings.push({
            severity: 'warning',
            title: 'No submitConfig defined',
            explanation: `Config is missing "submitConfig" property. Without this, the form has no submission endpoint. Users can fill the form but clicking Submit will do nothing. This is fine for demos/prototypes but production forms need a submit endpoint.`,
            jsonPaths: ['submitConfig'],
            reproducerState: {},
            fixGuidance: [
                `Add submitConfig: { "endpoint": "https://your-api.com/endpoint", "method": "POST" }`,
                `For testing, use JSONPlaceholder: "endpoint": "https://jsonplaceholder.typicode.com/posts"`,
                `Include headers if needed: "headers": { "Content-Type": "application/json", "Authorization": "Bearer ..." }`,
                `Add success/error transitions: "stateTransitions": { "onSuccess": { "action": "redirect", "target": "/success" } }`
            ]
        })
        return findings
    }
    
    // REAL PROBLEM: Invalid HTTP method
    const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    if (submit.method && !validMethods.includes(submit.method.toUpperCase())) {
        findings.push({
            severity: 'error',
            title: `Invalid HTTP method: "${submit.method}"`,
            explanation: `submitConfig.method="${submit.method}" is not a valid HTTP method. Valid methods are: ${validMethods.join(', ')}. This will cause the API call to fail. Most form submissions use POST (create new) or PUT/PATCH (update existing).`,
            jsonPaths: ['submitConfig.method'],
            reproducerState: {},
            fixGuidance: [
                `Change to POST for creating new records: "method": "POST"`,
                `Use PUT for full updates: "method": "PUT"`,
                `Use PATCH for partial updates: "method": "PATCH"`,
                `GET should not be used for form submission (use for loading data only)`
            ]
        })
    }
    
    // REAL PROBLEM: Using api.example.com placeholder in production
    if (submit.endpoint && submit.endpoint.includes('api.example.com')) {
        findings.push({
            severity: 'error',
            title: 'Placeholder API endpoint detected',
            explanation: `submitConfig.endpoint uses "api.example.com" which is a documentation placeholder, not a real API. Forms will fail to submit. This usually means the config was copied from a template and the endpoint wasn't updated. Replace with your actual API URL.`,
            jsonPaths: ['submitConfig.endpoint'],
            reproducerState: {},
            fixGuidance: [
                `Replace with your API: "endpoint": "https://your-domain.com/api/endpoint"`,
                `For testing, use free APIs: "https://jsonplaceholder.typicode.com/posts" or "https://httpbin.org/post"`,
                `Add environment variable: "endpoint": process.env.VITE_API_ENDPOINT`,
                `If intentional placeholder, add comment: // TODO: Replace with production API before deployment`
            ]
        })
    }
    
    // REAL PROBLEM: Missing Content-Type header for JSON POST
    if (submit.method === 'POST' || submit.method === 'PUT' || submit.method === 'PATCH') {
        const hasContentType = submit.headers && Object.keys(submit.headers).some(
            key => key.toLowerCase() === 'content-type'
        )
        
        if (!hasContentType) {
            findings.push({
                severity: 'warning',
                title: 'Missing Content-Type header for data submission',
                explanation: `submitConfig uses method="${submit.method}" but doesn't specify Content-Type header. Most APIs expect "Content-Type: application/json" for JSON payloads. Without this, the API may reject the request or misinterpret the data format.`,
                jsonPaths: ['submitConfig.headers', 'submitConfig.method'],
                reproducerState: {},
                fixGuidance: [
                    `Add headers: { "Content-Type": "application/json" }`,
                    `For file uploads, use: { "Content-Type": "multipart/form-data" }`,
                    `For form-encoded: { "Content-Type": "application/x-www-form-urlencoded" }`,
                    `Check your API documentation for required Content-Type`
                ]
            })
        }
    }
    
    // REAL PROBLEM: stateTransitions typo or missing success handler
    if (submit.stateTransitions && !submit.stateTransitions.onSuccess) {
        findings.push({
            severity: 'info',
            title: 'No success transition defined',
            explanation: `submitConfig has stateTransitions but no "onSuccess" handler. After successful form submission, nothing will happen - no redirect, no message, no feedback. Users won't know if their submission worked. Add success handling for better UX.`,
            jsonPaths: ['submitConfig.stateTransitions'],
            reproducerState: {},
            fixGuidance: [
                `Add success redirect: "onSuccess": { "action": "showMessage", "message": "Success!", "target": "/dashboard" }`,
                `Show success message: "onSuccess": { "action": "showMessage", "message": "Form submitted successfully!" }`,
                `Reset form: "onSuccess": { "action": "reset" }`,
                `Combine actions: "onSuccess": { "action": "showMessage", "message": "Thank you!", "delay": 2000, "target": "/home" }`
            ]
        })
    }
    
    return findings
}