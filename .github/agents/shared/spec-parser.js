/**
 * Specification Parser Module
 * 
 * Parses project specification documents to extract architectural rules.
 * Designed to be extensible and framework-agnostic.
 * 
 * @module spec-parser
 */

/**
 * Default specification file paths to search
 * Can be extended via configuration
 */
const DEFAULT_SPEC_PATHS = [
    // Root architecture docs
    'ARCHITECTURE.md',
    'SIMPLIFIED_ARCHITECTURE.md',
    'docs/ARCHITECTURE.md',
    'docs/architecture.md',
    // Common spec directory patterns
    'specs/*/plan.md',
    'specs/*/research.md',
    'specs/*/data-model.md',
    'spec/*/plan.md',
    'documentation/architecture.md',
];

/**
 * Rule extractors - each extracts specific types of rules from spec content
 * Add new extractors here to extend functionality
 */
const RULE_EXTRACTORS = {
    /**
     * Extract layer/tier architecture definitions
     */
    layers: {
        name: 'Layer Architecture',
        patterns: [
            // "X layer handles Y"
            /(\w+)\s+layer\s+(?:handles?|is\s+responsible\s+for|manages?)\s+([^\n.]+)/gi,
            // "X tier: description"
            /(\w+)\s+tier[:\s]+([^\n.]+)/gi,
        ],
        extract: (content, patterns) => {
            const layers = [];
            for (const pattern of patterns) {
                const matches = content.matchAll(pattern);
                for (const match of matches) {
                    layers.push({
                        name: match[1].trim(),
                        responsibility: match[2].trim(),
                    });
                }
            }
            return layers;
        }
    },

    /**
     * Extract component responsibility definitions
     */
    componentResponsibilities: {
        name: 'Component Responsibilities',
        patterns: [
            // "BaseX are/is dumb/presentational"
            /(Base\w+|base\s+components?)\s+(?:are|is)\s+(dumb|presentational|stateless|pure)[^\n]*/gi,
            // "Components in X are Y"
            /(?:components?\s+in|files?\s+in)\s+[`']?([^`'\s]+)[`']?\s+(?:are|should\s+be)\s+([^\n.]+)/gi,
            // "X components handle/are responsible for Y"
            /(\w+)\s+components?\s+(?:handle|are\s+responsible\s+for|manage)\s+([^\n.]+)/gi,
        ],
        extract: (content, patterns) => {
            const responsibilities = [];
            for (const pattern of patterns) {
                const matches = content.matchAll(pattern);
                for (const match of matches) {
                    responsibilities.push({
                        component: match[1].trim(),
                        responsibility: match[2].trim(),
                        isPresentational: /dumb|presentational|stateless|pure/i.test(match[2]),
                    });
                }
            }
            return responsibilities;
        }
    },

    /**
     * Extract data flow rules
     */
    dataFlow: {
        name: 'Data Flow Rules',
        patterns: [
            // "Data fetching happens in X"
            /(?:data\s*(?:fetching|loading)|API\s*calls?|HTTP\s+requests?)\s+(?:happens?|occurs?|should\s+(?:be|happen)|is\s+done|are\s+made)\s+(?:in|at|by|within)\s+([^\n.]+)/gi,
            // "X handles data fetching"
            /(composables?|services?|hooks?|stores?)\s+(?:handle|manage|are\s+responsible\s+for)\s+(?:data\s+)?(?:fetching|loading|API)/gi,
            // "Fetch data in X"
            /fetch\s+(?:data|options?)\s+(?:in|from|using)\s+([^\n.]+)/gi,
        ],
        extract: (content, patterns) => {
            const rules = [];
            for (const pattern of patterns) {
                const matches = content.matchAll(pattern);
                for (const match of matches) {
                    rules.push({
                        location: match[1]?.trim(),
                        fullMatch: match[0].trim(),
                    });
                }
            }
            return rules;
        }
    },

    /**
     * Extract prohibited patterns (things that should NOT be done)
     */
    prohibited: {
        name: 'Prohibited Patterns',
        patterns: [
            // "X should NOT/must NOT Y"
            /(\w+(?:\s+\w+)?)\s+(?:should|must)\s+(?:NOT|never)\s+([^\n.]+)/gi,
            // "Do NOT X"
            /(?:do\s+NOT|never|don't|avoid)\s+([^\n.!]+)/gi,
            // "X is prohibited/forbidden"
            /([^\n.]+)\s+(?:is|are)\s+(?:prohibited|forbidden|not\s+allowed)/gi,
            // "NO X" (uppercase emphasis)
            /\bNO\s+([A-Z][^\n.]+)/g,
        ],
        extract: (content, patterns) => {
            const prohibited = [];
            for (const pattern of patterns) {
                const matches = content.matchAll(pattern);
                for (const match of matches) {
                    const rule = match[1]?.trim() || match[0].trim();
                    // Filter out false positives
                    if (rule.length > 5 && rule.length < 200) {
                        prohibited.push({
                            rule,
                            context: match[0].trim(),
                        });
                    }
                }
            }
            return prohibited;
        }
    },

    /**
     * Extract required patterns (things that MUST be done)
     */
    required: {
        name: 'Required Patterns',
        patterns: [
            // "MUST/ALWAYS X"
            /(?:MUST|ALWAYS|required\s+to)\s+([^\n.]+)/gi,
            // "X is required/mandatory"
            /([^\n.]+)\s+(?:is|are)\s+(?:required|mandatory|necessary)/gi,
        ],
        extract: (content, patterns) => {
            const required = [];
            for (const pattern of patterns) {
                const matches = content.matchAll(pattern);
                for (const match of matches) {
                    const rule = match[1]?.trim() || match[0].trim();
                    if (rule.length > 5 && rule.length < 200) {
                        required.push({
                            rule,
                            context: match[0].trim(),
                        });
                    }
                }
            }
            return required;
        }
    },

    /**
     * Extract directory/file conventions
     */
    conventions: {
        name: 'Directory Conventions',
        patterns: [
            // "X files go in Y" or "X in Y directory"
            /(\w+(?:\s+\w+)?)\s+(?:files?|components?)\s+(?:go|belong|are\s+placed)\s+in\s+[`']?([^`'\s\n]+)[`']?/gi,
            // "src/X/ contains Y"
            /[`']?(src\/\w+(?:\/\w+)?)[`']?\s+(?:contains?|holds?|has)\s+([^\n.]+)/gi,
            // Directory structure in code blocks
            /(?:components|composables|services|utils|views|pages)\/\s*#?\s*([^\n]+)/gi,
        ],
        extract: (content, patterns) => {
            const conventions = [];
            for (const pattern of patterns) {
                const matches = content.matchAll(pattern);
                for (const match of matches) {
                    conventions.push({
                        directory: match[2]?.trim() || match[1]?.trim(),
                        purpose: match[1]?.trim() || match[2]?.trim(),
                    });
                }
            }
            return conventions;
        }
    },
};

/**
 * SpecificationParser class
 * Parses project specification documents and extracts architectural rules
 */
class SpecificationParser {
    /**
     * @param {Object} options Configuration options
     * @param {string[]} options.specPaths Additional spec paths to search
     * @param {Object} options.extractors Custom rule extractors
     * @param {Function} options.fetchFile Function to fetch file content
     */
    constructor(options = {}) {
        this.specPaths = [...DEFAULT_SPEC_PATHS, ...(options.specPaths || [])];
        this.extractors = { ...RULE_EXTRACTORS, ...(options.extractors || {}) };
        this.fetchFile = options.fetchFile || null;
        this.cache = new Map();
    }

    /**
     * Set the file fetcher function (for dependency injection)
     * @param {Function} fetchFn Async function that takes a path and returns content
     */
    setFileFetcher(fetchFn) {
        this.fetchFile = fetchFn;
    }

    /**
     * Parse all specification documents and extract rules
     * @param {string[]} availableFiles List of files in the repository
     * @returns {Object} Parsed specification context
     */
    async parse(availableFiles = []) {
        const specContext = {
            hasSpecs: false,
            sources: [],
            rules: {},
            summary: '',
        };

        // Find matching spec files
        const specFiles = this.findSpecFiles(availableFiles);

        if (specFiles.length === 0) {
            console.log('[SpecParser] No specification documents found');
            return specContext;
        }

        // Fetch spec contents
        const specContents = await this.fetchSpecContents(specFiles);

        if (specContents.length === 0) {
            return specContext;
        }

        specContext.hasSpecs = true;
        specContext.sources = specContents.map(s => s.path);

        // Run all extractors
        for (const [key, extractor] of Object.entries(this.extractors)) {
            const results = [];

            for (const { path, content } of specContents) {
                const extracted = extractor.extract(content, extractor.patterns);
                extracted.forEach(item => {
                    item.source = path;
                    results.push(item);
                });
            }

            // Deduplicate results
            specContext.rules[key] = this.deduplicateRules(results);
        }

        // Generate summary
        specContext.summary = this.generateSummary(specContext);

        return specContext;
    }

    /**
     * Find spec files matching configured patterns
     * @param {string[]} availableFiles Files in the repository
     * @returns {string[]} Matching spec file paths
     */
    findSpecFiles(availableFiles) {
        const matches = new Set();

        for (const pattern of this.specPaths) {
            if (pattern.includes('*')) {
                // Glob pattern - convert to regex
                const regexPattern = pattern
                    .replace(/\./g, '\\.')
                    .replace(/\*/g, '[^/]+');
                const regex = new RegExp(`^${regexPattern}$`);

                for (const file of availableFiles) {
                    if (regex.test(file)) {
                        matches.add(file);
                    }
                }
            } else {
                // Exact path
                if (availableFiles.includes(pattern)) {
                    matches.add(pattern);
                }
            }
        }

        return [...matches];
    }

    /**
     * Fetch content of spec files
     * @param {string[]} specFiles Paths to fetch
     * @returns {Array<{path: string, content: string}>}
     */
    async fetchSpecContents(specFiles) {
        if (!this.fetchFile) {
            throw new Error('File fetcher not configured. Call setFileFetcher() first.');
        }

        const contents = [];

        for (const path of specFiles) {
            try {
                const content = await this.fetchFile(path);
                if (content) {
                    contents.push({ path, content });
                    console.log(`[SpecParser] Loaded: ${path}`);
                }
            } catch (error) {
                console.warn(`[SpecParser] Failed to load ${path}: ${error.message}`);
            }
        }

        return contents;
    }

    /**
     * Deduplicate rules based on content similarity
     * @param {Array} rules Array of rule objects
     * @returns {Array} Deduplicated rules
     */
    deduplicateRules(rules) {
        const seen = new Set();
        return rules.filter(rule => {
            // Create a normalized key for comparison
            const key = JSON.stringify(rule).toLowerCase().replace(/\s+/g, ' ');
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Generate a summary of extracted rules
     * @param {Object} specContext The spec context
     * @returns {string} Human-readable summary
     */
    generateSummary(specContext) {
        const parts = [];

        for (const [key, rules] of Object.entries(specContext.rules)) {
            if (rules.length > 0) {
                const extractor = this.extractors[key];
                parts.push(`${extractor?.name || key}: ${rules.length}`);
            }
        }

        return parts.join(', ') || 'No rules extracted';
    }

    /**
     * Add a custom extractor
     * @param {string} name Extractor name/key
     * @param {Object} extractor Extractor definition
     */
    addExtractor(name, extractor) {
        if (!extractor.patterns || !extractor.extract) {
            throw new Error('Extractor must have patterns array and extract function');
        }
        this.extractors[name] = extractor;
    }

    /**
     * Add additional spec paths to search
     * @param {string[]} paths Paths to add
     */
    addSpecPaths(paths) {
        this.specPaths.push(...paths);
    }
}

/**
 * Factory function to create a configured parser
 * @param {Object} options Configuration options
 * @returns {SpecificationParser}
 */
function createSpecParser(options = {}) {
    return new SpecificationParser(options);
}

export {
    SpecificationParser,
    createSpecParser,
    RULE_EXTRACTORS,
    DEFAULT_SPEC_PATHS,
};
