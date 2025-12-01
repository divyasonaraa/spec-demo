export function evalShowIf(showIf, values) {
    if (!showIf) return true
    const { field, operator, value } = showIf
    const v = values[field]
    switch (operator) {
        case 'equals': return v === value
        case 'in': return Array.isArray(value) && value.includes(v)
        default: return true
    }
}

export function simulate(config, baseValues) {
    const values = { ...(baseValues || {}) }
    const visibility = {}
    for (const step of config.steps) {
        for (const field of step.fields) {
            visibility[field.name] = evalShowIf(field.showIf, values)
            if (field.defaultValue !== undefined && values[field.name] === undefined) {
                values[field.name] = field.defaultValue
            }
        }
    }
    return { values, visibility }
}
