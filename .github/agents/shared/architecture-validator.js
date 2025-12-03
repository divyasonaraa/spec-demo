/**
 * Architecture Validator Module
 * 
 * Validates code changes against architectural rules defined in specifications.
 * Uses a plugin-based architecture for extensibility.
 * 
 * This module provides:
 * - ValidationContext for managing validation state
 * - ArchitectureValidator for running validations
 * - Plugin interface for custom validators
 * 
 * @module architecture-validator
 */

import { ArchitectureRulesRegistry, Severity, createDefaultRegistry } from './architecture-rules.js';

/**
 * Validation result structure
 */
class ValidationResult {
    constructor() {
        /** @type {Array<Object>} All violations found */
        this.violations = [];
        /** @type {Array<Object>} Warnings (non-blocking) */
        this.warnings = [];
        /** @type {Array<Object>} Info messages */
        this.info = [];
        /** @type {boolean} Whether validation passed (no errors) */
        this.passed = true;
        /** @type {Map<string, Array>} Violations grouped by file */
        this.byFile = new Map();
        /** @type {Map<string, Array>} Violations grouped by rule */
        this.byRule = new Map();
    }

    /**
     * Add a violation to the result
     * @param {Object} violation
     */
    addViolation(violation) {
        switch (violation.severity) {
            case Severity.ERROR:
                this.violations.push(violation);
                this.passed = false;
                break;
            case Severity.WARNING:
                this.warnings.push(violation);
                break;
            case Severity.INFO:
                this.info.push(violation);
                break;
            default:
                this.violations.push(violation);
                this.passed = false;
        }

        // Group by file
        const path = violation.path || 'unknown';
        if (!this.byFile.has(path)) {
            this.byFile.set(path, []);
        }
        this.byFile.get(path).push(violation);

        // Group by rule
        const ruleId = violation.ruleId || 'unknown';
        if (!this.byRule.has(ruleId)) {
            this.byRule.set(ruleId, []);
        }
        this.byRule.get(ruleId).push(violation);
    }

    /**
     * Merge another validation result into this one
     * @param {ValidationResult} other
     */
    merge(other) {
        for (const v of other.violations) {
            this.addViolation({ ...v, severity: Severity.ERROR });
        }
        for (const w of other.warnings) {
            this.addViolation({ ...w, severity: Severity.WARNING });
        }
        for (const i of other.info) {
            this.addViolation({ ...i, severity: Severity.INFO });
        }
    }

    /**
     * Get summary statistics
     * @returns {Object}
     */
    getSummary() {
        return {
            passed: this.passed,
            errorCount: this.violations.length,
            warningCount: this.warnings.length,
            infoCount: this.info.length,
            totalCount: this.violations.length + this.warnings.length + this.info.length,
            filesAffected: this.byFile.size,
            rulesTriggered: this.byRule.size,
        };
    }

    /**
     * Format violations for display
     * @param {Object} options Formatting options
     * @returns {string}
     */
    format(options = {}) {
        const { includeWarnings = true, includeInfo = false, groupBy = 'file' } = options;
        const lines = [];

        if (this.passed && this.warnings.length === 0) {
            lines.push('✅ All architecture checks passed');
            return lines.join('\n');
        }

        // Format errors
        if (this.violations.length > 0) {
            lines.push(`\n❌ ${this.violations.length} architecture violation(s) found:\n`);

            if (groupBy === 'file') {
                for (const [path, violations] of this.byFile) {
                    const errors = violations.filter(v => v.severity === Severity.ERROR);
                    if (errors.length > 0) {
                        lines.push(`  📁 ${path}`);
                        for (const v of errors) {
                            lines.push(`    • [${v.ruleId}] ${v.message}`);
                            if (v.suggestion) {
                                lines.push(`      💡 ${v.suggestion}`);
                            }
                        }
                        lines.push('');
                    }
                }
            } else {
                for (const [ruleId, violations] of this.byRule) {
                    const errors = violations.filter(v => v.severity === Severity.ERROR);
                    if (errors.length > 0) {
                        lines.push(`  📋 ${ruleId}: ${errors[0].ruleName || ruleId}`);
                        for (const v of errors) {
                            lines.push(`    • ${v.path}: ${v.message}`);
                        }
                        if (errors[0].suggestion) {
                            lines.push(`    💡 ${errors[0].suggestion}`);
                        }
                        lines.push('');
                    }
                }
            }
        }

        // Format warnings
        if (includeWarnings && this.warnings.length > 0) {
            lines.push(`\n⚠️ ${this.warnings.length} warning(s):\n`);
            for (const w of this.warnings) {
                lines.push(`  • [${w.ruleId}] ${w.path}: ${w.message}`);
            }
        }

        // Format info
        if (includeInfo && this.info.length > 0) {
            lines.push(`\nℹ️ ${this.info.length} info message(s):\n`);
            for (const i of this.info) {
                lines.push(`  • ${i.message}`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Convert to GitHub-compatible markdown
     * @returns {string}
     */
    toMarkdown() {
        const lines = [];
        const summary = this.getSummary();

        if (this.passed) {
            lines.push('## ✅ Architecture Validation Passed\n');
            if (this.warnings.length > 0) {
                lines.push(`> ⚠️ ${this.warnings.length} warning(s) found (non-blocking)\n`);
            }
        } else {
            lines.push('## ❌ Architecture Validation Failed\n');
            lines.push(`> ${summary.errorCount} error(s), ${summary.warningCount} warning(s)\n`);
        }

        // Errors table
        if (this.violations.length > 0) {
            lines.push('### Errors\n');
            lines.push('| File | Rule | Message |');
            lines.push('|------|------|---------|');
            for (const v of this.violations) {
                const file = v.path ? `\`${v.path.split('/').pop()}\`` : 'Unknown';
                lines.push(`| ${file} | ${v.ruleId} | ${v.message} |`);
            }
            lines.push('');

            // Suggestions
            lines.push('### Suggested Fixes\n');
            const seenSuggestions = new Set();
            for (const v of this.violations) {
                if (v.suggestion && !seenSuggestions.has(v.suggestion)) {
                    seenSuggestions.add(v.suggestion);
                    lines.push(`- **${v.ruleName || v.ruleId}**: ${v.suggestion}`);
                }
            }
            lines.push('');
        }

        // Warnings section
        if (this.warnings.length > 0) {
            lines.push('<details><summary>⚠️ Warnings (click to expand)</summary>\n');
            for (const w of this.warnings) {
                lines.push(`- \`${w.path?.split('/').pop() || 'unknown'}\`: ${w.message}`);
            }
            lines.push('\n</details>');
        }

        return lines.join('\n');
    }
}

/**
 * Plugin interface for custom validators
 * Implement this interface to create custom validation plugins
 */
class ValidatorPlugin {
    /**
     * @param {string} name Plugin name
     */
    constructor(name) {
        this.name = name;
        this.enabled = true;
    }

    /**
     * Initialize the plugin with context
     * @param {Object} context Validation context
     */
    async initialize(context) { }

    /**
     * Validate a single file
     * @param {string} path File path
     * @param {string} content File content
     * @param {Object} context Validation context
     * @returns {Promise<Array<Object>>} Array of violations
     */
    async validate(path, content, context) {
        return [];
    }

    /**
     * Called after all files have been validated
     * @param {ValidationResult} result Current validation result
     * @param {Object} context Validation context
     */
    async finalize(result, context) { }
}

/**
 * Built-in plugin for rule-based validation
 */
class RuleBasedValidatorPlugin extends ValidatorPlugin {
    constructor() {
        super('rule-based');
        /** @type {ArchitectureRulesRegistry} */
        this.registry = null;
    }

    async initialize(context) {
        // Use provided registry or create from specs
        if (context.rulesRegistry) {
            this.registry = context.rulesRegistry;
        } else {
            // Detect framework and create default registry
            const framework = this.detectFramework(context);
            this.registry = createDefaultRegistry(framework);

            // Enhance with spec-derived rules
            if (context.specContext) {
                this.registry.generateFromSpecs(context.specContext);
            }
        }
    }

    detectFramework(context) {
        // Check for framework indicators
        const { projectContext = {}, specContext = {} } = context;

        // Check tech stack from specs
        const techStack = specContext.techStack || [];
        if (techStack.some(t => /vue/i.test(t))) return 'vue';
        if (techStack.some(t => /react/i.test(t))) return 'react';
        if (techStack.some(t => /angular/i.test(t))) return 'angular';

        // Check project structure
        if (projectContext.hasVueFiles) return 'vue';
        if (projectContext.hasReactFiles) return 'react';
        if (projectContext.hasAngularFiles) return 'angular';

        return 'generic';
    }

    async validate(path, content, context) {
        if (!this.registry) return [];

        const violations = [];
        for (const rule of this.registry.getEnabled()) {
            const ruleViolations = rule.validate(path, content, context);
            violations.push(...ruleViolations);
        }

        return violations;
    }
}

/**
 * Built-in plugin for detecting data flow violations
 */
class DataFlowValidatorPlugin extends ValidatorPlugin {
    constructor() {
        super('data-flow');
        this.dataFlowRules = [];
    }

    async initialize(context) {
        // Extract data flow rules from spec context
        if (context.specContext?.rules?.dataFlow) {
            this.dataFlowRules = context.specContext.rules.dataFlow;
        }
    }

    async validate(path, content, context) {
        if (this.dataFlowRules.length === 0) return [];

        const violations = [];

        for (const rule of this.dataFlowRules) {
            // Check if this file is a source that should not flow to targets
            if (rule.source && this.matchesPattern(path, rule.source)) {
                // This file is a source - it shouldn't import from restricted targets
                if (rule.blockedTargets) {
                    const imports = this.extractImports(content);
                    for (const imp of imports) {
                        if (rule.blockedTargets.some(t => this.matchesPattern(imp, t))) {
                            violations.push({
                                ruleId: 'data-flow',
                                ruleName: 'Data Flow Violation',
                                severity: Severity.ERROR,
                                path,
                                message: `Data flow violation: "${path.split('/').pop()}" should not import from "${imp}"`,
                                suggestion: rule.suggestion || 'Check the architecture documentation for correct data flow patterns.',
                            });
                        }
                    }
                }
            }
        }

        return violations;
    }

    matchesPattern(path, pattern) {
        if (typeof pattern === 'string') {
            return path.includes(pattern) || new RegExp(pattern, 'i').test(path);
        }
        return pattern.test(path);
    }

    extractImports(content) {
        const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
        return [...content.matchAll(importRegex)].map(m => m[1]);
    }
}

/**
 * Built-in plugin for detecting changes that might break existing contracts
 */
class ContractValidatorPlugin extends ValidatorPlugin {
    constructor() {
        super('contract');
        this.contracts = [];
    }

    async initialize(context) {
        // Load contracts from spec context
        if (context.specContext?.contracts) {
            this.contracts = context.specContext.contracts;
        }
    }

    async validate(path, content, context) {
        // Contract validation typically needs the original file content
        // to detect breaking changes
        if (!context.originalContent) return [];

        const violations = [];

        // Check for removed exports that might be used by other modules
        const originalExports = this.extractExports(context.originalContent);
        const newExports = this.extractExports(content);

        const removedExports = originalExports.filter(e => !newExports.includes(e));

        if (removedExports.length > 0) {
            violations.push({
                ruleId: 'contract-breaking',
                ruleName: 'Breaking Change Detection',
                severity: Severity.WARNING,
                path,
                message: `Potentially breaking change: removed exports: ${removedExports.join(', ')}`,
                suggestion: 'Ensure no other modules depend on these exports, or provide a migration path.',
                removedExports,
            });
        }

        return violations;
    }

    extractExports(content) {
        const exports = [];

        // Named exports
        const namedExportRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
        for (const match of content.matchAll(namedExportRegex)) {
            exports.push(match[1]);
        }

        // Export list
        const exportListRegex = /export\s*\{([^}]+)\}/g;
        for (const match of content.matchAll(exportListRegex)) {
            const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim());
            exports.push(...names);
        }

        return [...new Set(exports)];
    }
}

// ============================================================================
// MAIN VALIDATOR CLASS
// ============================================================================

/**
 * Main architecture validator
 * Orchestrates validation across multiple plugins
 */
class ArchitectureValidator {
    constructor(options = {}) {
        /** @type {ValidatorPlugin[]} */
        this.plugins = [];
        this.options = {
            stopOnFirstError: false,
            includeWarnings: true,
            ...options,
        };
        this.initialized = false;
    }

    /**
     * Add a validation plugin
     * @param {ValidatorPlugin} plugin
     * @returns {ArchitectureValidator} this for chaining
     */
    use(plugin) {
        this.plugins.push(plugin);
        return this;
    }

    /**
     * Initialize all plugins with context
     * @param {Object} context Validation context
     */
    async initialize(context) {
        for (const plugin of this.plugins) {
            await plugin.initialize(context);
        }
        this.initialized = true;
    }

    /**
     * Validate a single file
     * @param {string} path File path
     * @param {string} content File content
     * @param {Object} context Additional context
     * @returns {Promise<ValidationResult>}
     */
    async validateFile(path, content, context = {}) {
        const result = new ValidationResult();

        for (const plugin of this.plugins) {
            if (!plugin.enabled) continue;

            try {
                const violations = await plugin.validate(path, content, context);
                for (const v of violations) {
                    result.addViolation(v);
                }

                if (this.options.stopOnFirstError && !result.passed) {
                    break;
                }
            } catch (error) {
                console.warn(`[${plugin.name}] Plugin error validating ${path}:`, error.message);
            }
        }

        return result;
    }

    /**
     * Validate multiple files
     * @param {Array<{path: string, content: string}>} files Files to validate
     * @param {Object} context Additional context
     * @returns {Promise<ValidationResult>}
     */
    async validateFiles(files, context = {}) {
        const result = new ValidationResult();

        for (const { path, content, originalContent } of files) {
            const fileContext = { ...context, originalContent };
            const fileResult = await this.validateFile(path, content, fileContext);
            result.merge(fileResult);

            if (this.options.stopOnFirstError && !result.passed) {
                break;
            }
        }

        // Run finalize on all plugins
        for (const plugin of this.plugins) {
            if (plugin.enabled) {
                await plugin.finalize(result, context);
            }
        }

        return result;
    }

    /**
     * Validate proposed changes (diff-based)
     * @param {Array<{path: string, oldContent: string, newContent: string}>} changes
     * @param {Object} context
     * @returns {Promise<ValidationResult>}
     */
    async validateChanges(changes, context = {}) {
        const files = changes.map(change => ({
            path: change.path,
            content: change.newContent,
            originalContent: change.oldContent,
        }));

        return this.validateFiles(files, context);
    }
}

/**
 * Create a pre-configured validator with standard plugins
 * @param {Object} options
 * @returns {ArchitectureValidator}
 */
function createValidator(options = {}) {
    const validator = new ArchitectureValidator(options);

    // Add standard plugins
    validator.use(new RuleBasedValidatorPlugin());
    validator.use(new DataFlowValidatorPlugin());
    validator.use(new ContractValidatorPlugin());

    return validator;
}

/**
 * Quick validation helper for single file
 * @param {string} path File path
 * @param {string} content File content
 * @param {Object} context Context with specContext and/or rulesRegistry
 * @returns {Promise<ValidationResult>}
 */
async function validateFile(path, content, context = {}) {
    const validator = createValidator();
    await validator.initialize(context);
    return validator.validateFile(path, content, context);
}

/**
 * Quick validation helper for multiple files
 * @param {Array<{path: string, content: string}>} files
 * @param {Object} context
 * @returns {Promise<ValidationResult>}
 */
async function validateFiles(files, context = {}) {
    const validator = createValidator();
    await validator.initialize(context);
    return validator.validateFiles(files, context);
}

export {
    // Classes
    ValidationResult,
    ValidatorPlugin,
    RuleBasedValidatorPlugin,
    DataFlowValidatorPlugin,
    ContractValidatorPlugin,
    ArchitectureValidator,
    // Factory functions
    createValidator,
    // Quick helpers
    validateFile,
    validateFiles,
};
