/**
 * Architecture Rules Module
 * 
 * Defines architectural rules and constraints that can be configured
 * per-project or detected from specification documents.
 * 
 * This module provides:
 * - Rule definitions with validation logic
 * - Rule builders for common patterns
 * - Project-specific rule loading
 * 
 * @module architecture-rules
 */

/**
 * Rule severity levels
 */
const Severity = {
    ERROR: 'ERROR',       // Blocks auto-fix
    WARNING: 'WARNING',   // Logs warning but continues
    INFO: 'INFO',         // Informational only
};

/**
 * Rule categories for organization
 */
const Category = {
    DATA_FLOW: 'data-flow',
    COMPONENT_STRUCTURE: 'component-structure',
    NAMING: 'naming',
    IMPORTS: 'imports',
    STATE_MANAGEMENT: 'state-management',
    SECURITY: 'security',
};

/**
 * Base class for architecture rules
 * Extend this to create custom rules
 */
class ArchitectureRule {
    /**
     * @param {Object} config Rule configuration
     * @param {string} config.id Unique rule identifier
     * @param {string} config.name Human-readable name
     * @param {string} config.description What this rule checks
     * @param {string} config.category Rule category
     * @param {string} config.severity Severity level
     * @param {Function} config.check Validation function (path, content) => violations[]
     * @param {string} config.suggestion How to fix violations
     */
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.description = config.description;
        this.category = config.category || Category.COMPONENT_STRUCTURE;
        this.severity = config.severity || Severity.ERROR;
        this._check = config.check;
        this.suggestion = config.suggestion || '';
        this.enabled = config.enabled !== false;
    }

    /**
     * Check if this rule applies to a file
     * @param {string} path File path
     * @returns {boolean}
     */
    appliesTo(path) {
        return true; // Override in subclasses
    }

    /**
     * Validate a file against this rule
     * @param {string} path File path
     * @param {string} content File content
     * @param {Object} context Additional context (specContext, projectContext)
     * @returns {Array<Object>} Array of violations
     */
    validate(path, content, context = {}) {
        if (!this.enabled) return [];
        if (!this.appliesTo(path)) return [];

        try {
            const violations = this._check(path, content, context);
            return violations.map(v => ({
                ruleId: this.id,
                ruleName: this.name,
                severity: this.severity,
                category: this.category,
                path,
                ...v,
                suggestion: v.suggestion || this.suggestion,
            }));
        } catch (error) {
            console.warn(`[Rule:${this.id}] Error checking ${path}:`, error.message);
            return [];
        }
    }
}

/**
 * Rule for checking file path patterns
 * Validates that certain files don't contain forbidden patterns
 */
class PathPatternRule extends ArchitectureRule {
    /**
     * @param {Object} config
     * @param {RegExp|string} config.pathPattern Pattern to match file paths
     * @param {RegExp[]} config.forbiddenPatterns Patterns that should not appear in matched files
     */
    constructor(config) {
        super(config);
        this.pathPattern = config.pathPattern instanceof RegExp
            ? config.pathPattern
            : new RegExp(config.pathPattern);
        this.forbiddenPatterns = config.forbiddenPatterns || [];
    }

    appliesTo(path) {
        return this.pathPattern.test(path);
    }

    _check(path, content) {
        const violations = [];

        for (const pattern of this.forbiddenPatterns) {
            if (pattern.test(content)) {
                violations.push({
                    message: `File contains forbidden pattern: ${pattern.source}`,
                    pattern: pattern.source,
                });
            }
        }

        return violations;
    }
}

/**
 * Rule for checking import statements
 * Validates that certain files don't import forbidden modules
 */
class ImportRule extends ArchitectureRule {
    /**
     * @param {Object} config
     * @param {RegExp|string} config.pathPattern Pattern to match file paths
     * @param {RegExp[]} config.forbiddenImports Import patterns that should not appear
     * @param {RegExp[]} config.requiredImports Import patterns that must appear (optional)
     */
    constructor(config) {
        super({
            ...config,
            category: Category.IMPORTS,
        });
        this.pathPattern = config.pathPattern instanceof RegExp
            ? config.pathPattern
            : new RegExp(config.pathPattern);
        this.forbiddenImports = config.forbiddenImports || [];
        this.requiredImports = config.requiredImports || [];
    }

    appliesTo(path) {
        return this.pathPattern.test(path);
    }

    _check(path, content) {
        const violations = [];

        // Extract all import statements
        const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
        const imports = [...content.matchAll(importRegex)].map(m => m[1]);

        // Check forbidden imports
        for (const forbidden of this.forbiddenImports) {
            for (const imp of imports) {
                if (forbidden.test(imp)) {
                    violations.push({
                        message: `Forbidden import: "${imp}"`,
                        pattern: forbidden.source,
                        import: imp,
                    });
                }
            }
        }

        // Check required imports
        for (const required of this.requiredImports) {
            const hasRequired = imports.some(imp => required.test(imp));
            if (!hasRequired) {
                violations.push({
                    message: `Missing required import matching: ${required.source}`,
                    pattern: required.source,
                    severity: Severity.WARNING,
                });
            }
        }

        return violations;
    }
}

/**
 * Rule for checking naming conventions
 */
class NamingRule extends ArchitectureRule {
    /**
     * @param {Object} config
     * @param {RegExp|string} config.pathPattern Pattern to match file paths
     * @param {RegExp} config.exportPattern Pattern that exports must match
     * @param {string} config.convention Description of the naming convention
     */
    constructor(config) {
        super({
            ...config,
            category: Category.NAMING,
            severity: config.severity || Severity.WARNING,
        });
        this.pathPattern = config.pathPattern instanceof RegExp
            ? config.pathPattern
            : new RegExp(config.pathPattern);
        this.exportPattern = config.exportPattern;
        this.convention = config.convention;
    }

    appliesTo(path) {
        return this.pathPattern.test(path);
    }

    _check(path, content) {
        const violations = [];

        // Extract exports
        const exportRegex = /export\s+(?:const|function|class|default)\s+(\w+)/g;
        const exports = [...content.matchAll(exportRegex)].map(m => m[1]);

        for (const exp of exports) {
            if (!this.exportPattern.test(exp)) {
                violations.push({
                    message: `Export "${exp}" doesn't follow naming convention: ${this.convention}`,
                    export: exp,
                    convention: this.convention,
                });
            }
        }

        return violations;
    }
}

/**
 * Composite rule that combines multiple checks
 */
class CompositeRule extends ArchitectureRule {
    /**
     * @param {Object} config
     * @param {ArchitectureRule[]} config.rules Child rules to check
     * @param {string} config.combineMode 'any' (fail if any fails) or 'all' (fail only if all fail)
     */
    constructor(config) {
        super(config);
        this.rules = config.rules || [];
        this.combineMode = config.combineMode || 'any';
    }

    appliesTo(path) {
        return this.rules.some(rule => rule.appliesTo(path));
    }

    _check(path, content, context) {
        const allViolations = [];

        for (const rule of this.rules) {
            const violations = rule.validate(path, content, context);
            allViolations.push(...violations);
        }

        if (this.combineMode === 'all') {
            // Only return violations if all rules have violations
            const rulesWithViolations = this.rules.filter(rule =>
                allViolations.some(v => v.ruleId === rule.id)
            );
            if (rulesWithViolations.length === this.rules.length) {
                return allViolations;
            }
            return [];
        }

        return allViolations;
    }
}

// ============================================================================
// PRE-BUILT RULE TEMPLATES
// ============================================================================

/**
 * Rule templates for common architectural patterns
 * These can be customized or extended
 */
const RuleTemplates = {
    /**
     * Create a rule for presentational/dumb components
     * @param {Object} config
     * @param {RegExp|string} config.pathPattern Path pattern for presentational components
     * @param {string} config.componentType Name of the component type (e.g., "Base components")
     */
    presentationalComponent: (config) => new PathPatternRule({
        id: `presentational-${config.componentType?.toLowerCase().replace(/\s+/g, '-') || 'component'}`,
        name: `${config.componentType || 'Presentational Component'} - No Data Fetching`,
        description: `${config.componentType || 'Presentational components'} should not contain data fetching logic`,
        pathPattern: config.pathPattern,
        severity: Severity.ERROR,
        forbiddenPatterns: [
            /import\s+.*(?:axios|fetch|got|request|http)/i,
            /(?:await|\.then\s*\()\s*(?:fetch|axios|api\.|http)/i,
            /useDataSource|useFetch|useQuery|useApi|useSWR|useRequest/i,
            /apiClient|httpClient|restClient/i,
            /\$fetch|useLazyFetch|useAsyncData/i, // Nuxt
            /fetch\s*\(['"]/i,
        ],
        suggestion: `Move data fetching logic to a composable/hook or parent component. ${config.componentType || 'These components'} should only receive data via props.`,
    }),

    /**
     * Create a rule for service/API layer
     * @param {Object} config
     * @param {RegExp|string} config.pathPattern Path pattern for service files
     */
    serviceLayer: (config) => new PathPatternRule({
        id: 'service-layer',
        name: 'Service Layer - No UI Logic',
        description: 'Service files should not contain UI-related code',
        pathPattern: config.pathPattern || /\/services?\//,
        severity: Severity.WARNING,
        forbiddenPatterns: [
            /import\s+.*(?:vue|react|svelte|angular)/i,
            /(?:ref|reactive|computed|watch)\s*\(/i,
            /useState|useEffect|useCallback/i,
            /\$\w+\s*=/i, // Svelte stores
        ],
        suggestion: 'Services should be framework-agnostic. Move UI logic to components or composables.',
    }),

    /**
     * Create a rule for composables/hooks naming
     * @param {Object} config
     * @param {RegExp|string} config.pathPattern Path pattern for composable files
     */
    composableNaming: (config) => new NamingRule({
        id: 'composable-naming',
        name: 'Composable Naming Convention',
        description: 'Composables/hooks should be named with "use" prefix',
        pathPattern: config.pathPattern || /\/(?:composables?|hooks?)\//,
        exportPattern: /^use[A-Z]/,
        convention: 'use[FeatureName] (e.g., useFormValidation)',
        severity: Severity.WARNING,
        suggestion: 'Rename the export to follow the useXxx convention.',
    }),

    /**
     * Create a rule preventing direct store imports in components
     * @param {Object} config
     * @param {RegExp|string} config.pathPattern Path pattern for components
     * @param {RegExp} config.storePattern Pattern matching store imports
     */
    noDirectStoreImports: (config) => new ImportRule({
        id: 'no-direct-store-imports',
        name: 'No Direct Store Imports in Components',
        description: 'Components should access stores through composables',
        pathPattern: config.pathPattern || /\/components\//,
        forbiddenImports: [
            config.storePattern || /\/stores?\//,
        ],
        severity: Severity.WARNING,
        suggestion: 'Create a composable to wrap store access, or use prop drilling.',
    }),
};

// ============================================================================
// ARCHITECTURE RULES REGISTRY
// ============================================================================

/**
 * Registry for managing architecture rules
 * Supports dynamic rule registration and configuration
 */
class ArchitectureRulesRegistry {
    constructor() {
        this.rules = new Map();
        this.ruleOrder = [];
    }

    /**
     * Register a rule
     * @param {ArchitectureRule} rule
     */
    register(rule) {
        this.rules.set(rule.id, rule);
        if (!this.ruleOrder.includes(rule.id)) {
            this.ruleOrder.push(rule.id);
        }
    }

    /**
     * Register multiple rules
     * @param {ArchitectureRule[]} rules
     */
    registerAll(rules) {
        rules.forEach(rule => this.register(rule));
    }

    /**
     * Get a rule by ID
     * @param {string} id
     * @returns {ArchitectureRule|undefined}
     */
    get(id) {
        return this.rules.get(id);
    }

    /**
     * Get all enabled rules
     * @returns {ArchitectureRule[]}
     */
    getEnabled() {
        return this.ruleOrder
            .map(id => this.rules.get(id))
            .filter(rule => rule && rule.enabled);
    }

    /**
     * Enable or disable a rule
     * @param {string} id Rule ID
     * @param {boolean} enabled
     */
    setEnabled(id, enabled) {
        const rule = this.rules.get(id);
        if (rule) {
            rule.enabled = enabled;
        }
    }

    /**
     * Remove a rule
     * @param {string} id
     */
    remove(id) {
        this.rules.delete(id);
        this.ruleOrder = this.ruleOrder.filter(ruleId => ruleId !== id);
    }

    /**
     * Clear all rules
     */
    clear() {
        this.rules.clear();
        this.ruleOrder = [];
    }

    /**
     * Load rules from configuration object
     * @param {Object} config Configuration with rule definitions
     */
    loadFromConfig(config) {
        if (!config || !config.rules) return;

        for (const ruleConfig of config.rules) {
            if (ruleConfig.template && RuleTemplates[ruleConfig.template]) {
                const rule = RuleTemplates[ruleConfig.template](ruleConfig);
                this.register(rule);
            } else if (ruleConfig.type) {
                const rule = this.createRuleFromConfig(ruleConfig);
                if (rule) {
                    this.register(rule);
                }
            }
        }
    }

    /**
     * Create a rule from configuration object
     * @param {Object} config
     * @returns {ArchitectureRule|null}
     */
    createRuleFromConfig(config) {
        const RuleClass = {
            'path-pattern': PathPatternRule,
            'import': ImportRule,
            'naming': NamingRule,
            'composite': CompositeRule,
        }[config.type];

        if (!RuleClass) {
            console.warn(`Unknown rule type: ${config.type}`);
            return null;
        }

        // Convert string patterns to RegExp
        if (config.pathPattern && typeof config.pathPattern === 'string') {
            config.pathPattern = new RegExp(config.pathPattern);
        }
        if (config.forbiddenPatterns) {
            config.forbiddenPatterns = config.forbiddenPatterns.map(p =>
                typeof p === 'string' ? new RegExp(p, 'i') : p
            );
        }
        if (config.forbiddenImports) {
            config.forbiddenImports = config.forbiddenImports.map(p =>
                typeof p === 'string' ? new RegExp(p, 'i') : p
            );
        }

        return new RuleClass(config);
    }

    /**
     * Generate rules from parsed specification context
     * @param {Object} specContext Parsed spec context from SpecificationParser
     */
    generateFromSpecs(specContext) {
        if (!specContext?.hasSpecs) return;

        const rules = specContext.rules || {};

        // Generate rules from component responsibilities
        if (rules.componentResponsibilities) {
            for (const comp of rules.componentResponsibilities) {
                if (comp.isPresentational) {
                    // Create presentational component rule
                    const pathPattern = this.inferPathPattern(comp.component);
                    if (pathPattern) {
                        const rule = RuleTemplates.presentationalComponent({
                            pathPattern,
                            componentType: comp.component,
                        });
                        // Customize ID to avoid conflicts
                        rule.id = `spec-presentational-${comp.component.toLowerCase().replace(/\s+/g, '-')}`;
                        this.register(rule);
                    }
                }
            }
        }

        // Generate rules from prohibited patterns
        if (rules.prohibited) {
            for (const prohibition of rules.prohibited) {
                // Try to create a rule from the prohibition
                const rule = this.createRuleFromProhibition(prohibition);
                if (rule) {
                    this.register(rule);
                }
            }
        }
    }

    /**
     * Infer a path pattern from a component description
     * @param {string} componentDesc
     * @returns {RegExp|null}
     */
    inferPathPattern(componentDesc) {
        const patterns = {
            'base': /(?:^|\/)(?:components\/)?base\//i,
            'base component': /(?:^|\/)(?:components\/)?base\//i,
            'base components': /(?:^|\/)(?:components\/)?base\//i,
            'components/base': /\/components\/base\//i,
            'presentational': /(?:^|\/)(?:components\/)?(?:base|presentational|dumb)\//i,
            'ui': /(?:^|\/)(?:components\/)?ui\//i,
            'common': /(?:^|\/)(?:components\/)?common\//i,
        };

        const normalized = componentDesc.toLowerCase().trim();

        for (const [key, pattern] of Object.entries(patterns)) {
            if (normalized.includes(key)) {
                return pattern;
            }
        }

        // Try to create a pattern from the name itself
        if (/^Base\w+/.test(componentDesc)) {
            return new RegExp(`${componentDesc}\\.vue$`, 'i');
        }

        return null;
    }

    /**
     * Create a rule from a prohibition extracted from specs
     * @param {Object} prohibition
     * @returns {ArchitectureRule|null}
     */
    createRuleFromProhibition(prohibition) {
        const text = prohibition.rule.toLowerCase();

        // Check for data fetching prohibition
        if (/data\s*fetch|api\s*call|http|ajax/i.test(text)) {
            // Try to extract which component type this applies to
            const componentMatch = prohibition.context.match(/(\w+\s*components?)/i);
            if (componentMatch) {
                const pathPattern = this.inferPathPattern(componentMatch[1]);
                if (pathPattern) {
                    return RuleTemplates.presentationalComponent({
                        pathPattern,
                        componentType: componentMatch[1],
                    });
                }
            }
        }

        // TODO: Add more prohibition patterns as needed

        return null;
    }
}

/**
 * Create a new rules registry with default rules for common frameworks
 * @param {string} framework Detected framework name
 * @returns {ArchitectureRulesRegistry}
 */
function createDefaultRegistry(framework = 'generic') {
    const registry = new ArchitectureRulesRegistry();

    // Add framework-specific default rules
    const frameworkRules = {
        'vue': [
            RuleTemplates.presentationalComponent({
                pathPattern: /(?:^|\/)(?:components\/)?base\//i,
                componentType: 'Base components',
            }),
            RuleTemplates.composableNaming({
                pathPattern: /\/composables?\//i,
            }),
        ],
        'react': [
            RuleTemplates.presentationalComponent({
                pathPattern: /(?:^|\/)(?:components\/)?(?:ui|base|atoms)\//i,
                componentType: 'UI components',
            }),
            RuleTemplates.composableNaming({
                pathPattern: /\/hooks?\//i,
            }),
        ],
        'angular': [
            RuleTemplates.serviceLayer({
                pathPattern: /\.service\.ts$/i,
            }),
        ],
        'generic': [],
    };

    const rules = frameworkRules[framework.toLowerCase()] || frameworkRules.generic;
    registry.registerAll(rules);

    return registry;
}

export {
    // Classes
    ArchitectureRule,
    PathPatternRule,
    ImportRule,
    NamingRule,
    CompositeRule,
    ArchitectureRulesRegistry,
    // Constants
    Severity,
    Category,
    // Templates and factory
    RuleTemplates,
    createDefaultRegistry,
};
