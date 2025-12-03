/**
 * File Change Handler Module
 * 
 * Modular, scalable system for applying code changes.
 * Supports multiple change strategies with validation and rollback.
 * 
 * @module file-change-handler
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Change types supported by the handler
 */
const CHANGE_TYPES = {
    FULL_REPLACE: 'full_replace',
    SEARCH_REPLACE: 'search_replace',
    PATCH: 'patch',
    INSERT: 'insert',
    DELETE: 'delete',
};

/**
 * Base class for change strategies (Strategy Pattern)
 */
class ChangeStrategy {
    constructor(name) {
        this.name = name;
    }

    /**
     * Validate if this strategy can handle the change
     * @param {Object} change The change object
     * @returns {boolean}
     */
    canHandle(change) {
        throw new Error('Subclass must implement canHandle()');
    }

    /**
     * Apply the change to the file
     * @param {Object} change The change object
     * @param {string} originalContent Original file content (null if new file)
     * @returns {string} New file content
     */
    apply(change, originalContent) {
        throw new Error('Subclass must implement apply()');
    }

    /**
     * Validate the change before applying
     * @param {Object} change The change object
     * @param {string} originalContent Original file content
     * @returns {{valid: boolean, errors: string[]}}
     */
    validate(change, originalContent) {
        return { valid: true, errors: [] };
    }
}

/**
 * Strategy for full file replacement
 */
class FullReplaceStrategy extends ChangeStrategy {
    constructor() {
        super('full_replace');
    }

    canHandle(change) {
        return change.content !== undefined && !change.search_replace && !change.patch;
    }

    apply(change, originalContent) {
        return change.content;
    }

    validate(change, originalContent) {
        const errors = [];

        if (typeof change.content !== 'string') {
            errors.push('content must be a string');
            return { valid: false, errors };
        }

        // Hallucination detection for existing files
        if (originalContent) {
            const detection = this.detectHallucination(change.content, originalContent, change.path);
            if (detection.isHallucination) {
                errors.push(detection.reason);
                return { valid: false, errors };
            }
            if (detection.warnings.length > 0) {
                // Warnings don't fail validation but should be logged
                console.warn(`[FullReplaceStrategy] Warnings for ${change.path}:`);
                detection.warnings.forEach(w => console.warn(`  - ${w}`));
            }
        }

        return { valid: true, errors };
    }

    /**
     * Detect if the new content might be hallucinated/fabricated
     */
    detectHallucination(newContent, originalContent, filePath) {
        const result = {
            isHallucination: false,
            reason: '',
            warnings: [],
        };

        const originalLines = originalContent.split('\n').length;
        const newLines = newContent.split('\n').length;
        const sizeRatio = newLines / originalLines;

        // Pattern 1: Boilerplate/demo content indicators
        const boilerplatePatterns = [
            /^#\s*(Demo|Example|Sample|Test|Hello|Welcome)/im,
            /<!DOCTYPE html>[\s\S]*<h1>.*(?:Demo|Example|Sample)/i,
            /export default \{\s*name:\s*['"](?:App|Demo|Example|HelloWorld)['"]/m,
            /^\/\/\s*(?:Demo|Example|Sample|TODO|Placeholder)/m,
            /<template>\s*<div>\s*<h1>.*Demo/i,
            /console\.log\s*\(\s*['"]Hello/i,
        ];

        const looksLikeBoilerplate = boilerplatePatterns.some(p => p.test(newContent));

        // Pattern 2: Missing key original content
        // Extract significant identifiers from original (function names, class names, etc.)
        const significantPatterns = [
            /(?:function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
            /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
            /export\s+(?:default\s+)?(?:function|class|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
        ];

        const originalIdentifiers = new Set();
        for (const pattern of significantPatterns) {
            let match;
            const regex = new RegExp(pattern.source, pattern.flags);
            while ((match = regex.exec(originalContent)) !== null) {
                if (match[1] && match[1].length > 3) {
                    originalIdentifiers.add(match[1]);
                }
            }
        }

        // Check how many original identifiers are preserved
        let preservedCount = 0;
        for (const id of originalIdentifiers) {
            if (newContent.includes(id)) {
                preservedCount++;
            }
        }

        const preservationRatio = originalIdentifiers.size > 0
            ? preservedCount / originalIdentifiers.size
            : 1;

        // Decision logic
        if (originalLines > 20 && looksLikeBoilerplate && sizeRatio < 0.5) {
            result.isHallucination = true;
            result.reason = `Suspicious replacement: Original has ${originalLines} lines, new content has ${newLines} lines ` +
                `(${(sizeRatio * 100).toFixed(0)}%) and looks like boilerplate/demo code. ` +
                `Use search_replace for targeted edits instead.`;
            return result;
        }

        if (originalLines > 30 && preservationRatio < 0.3 && sizeRatio < 0.5) {
            result.isHallucination = true;
            result.reason = `Suspicious replacement: Only ${(preservationRatio * 100).toFixed(0)}% of original identifiers preserved. ` +
                `This suggests fabricated content. Use search_replace for targeted edits.`;
            return result;
        }

        // Warnings (non-blocking)
        if (originalLines > 50 && sizeRatio < 0.3) {
            result.warnings.push(
                `Large file reduction: ${originalLines} → ${newLines} lines (${(sizeRatio * 100).toFixed(0)}%)`
            );
        }

        if (preservationRatio < 0.5 && originalIdentifiers.size > 5) {
            result.warnings.push(
                `Low identifier preservation: ${preservedCount}/${originalIdentifiers.size} original identifiers found`
            );
        }

        return result;
    }
}

/**
 * Strategy for search and replace operations
 */
class SearchReplaceStrategy extends ChangeStrategy {
    constructor() {
        super('search_replace');
    }

    canHandle(change) {
        return Array.isArray(change.search_replace) && change.search_replace.length > 0;
    }

    apply(change, originalContent) {
        if (!originalContent) {
            throw new FileChangeError('SEARCH_REPLACE_NO_FILE',
                `Cannot use search_replace on non-existent file: ${change.path}`);
        }

        let content = originalContent;

        for (const op of change.search_replace) {
            if (!op.search || op.replace === undefined) {
                console.warn('[SearchReplaceStrategy] Invalid operation, skipping:', op);
                continue;
            }

            // Support both string and regex search
            if (op.regex) {
                const regex = new RegExp(op.search, op.flags || 'g');
                content = content.replace(regex, op.replace);
            } else {
                // Exact string replacement
                if (!content.includes(op.search)) {
                    throw new FileChangeError('SEARCH_NOT_FOUND',
                        `Search text not found in ${change.path}`,
                        { search: op.search.slice(0, 100), file: change.path }
                    );
                }
                content = content.replace(op.search, op.replace);
            }
        }

        return content;
    }

    validate(change, originalContent) {
        const errors = [];

        if (!Array.isArray(change.search_replace)) {
            errors.push('search_replace must be an array');
            return { valid: false, errors };
        }

        if (!originalContent && change.search_replace.length > 0) {
            errors.push('Cannot use search_replace on a new file');
            return { valid: false, errors };
        }

        for (let i = 0; i < change.search_replace.length; i++) {
            const op = change.search_replace[i];

            if (!op.search) {
                errors.push(`Operation ${i}: missing 'search' field`);
                continue;
            }

            if (op.replace === undefined) {
                errors.push(`Operation ${i}: missing 'replace' field`);
                continue;
            }

            // Validate search exists in content (for non-regex)
            if (!op.regex && originalContent && !originalContent.includes(op.search)) {
                errors.push(`Operation ${i}: search text not found in file`);
            }
        }

        return { valid: errors.length === 0, errors };
    }
}

/**
 * Strategy for line-based insertions
 */
class InsertStrategy extends ChangeStrategy {
    constructor() {
        super('insert');
    }

    canHandle(change) {
        return change.insert !== undefined && (change.after_line !== undefined || change.before_line !== undefined);
    }

    apply(change, originalContent) {
        const lines = (originalContent || '').split('\n');
        const insertContent = change.insert;

        if (change.after_line !== undefined) {
            const lineIndex = change.after_line; // 0-indexed
            if (lineIndex < 0 || lineIndex > lines.length) {
                throw new FileChangeError('INVALID_LINE', `Invalid line number: ${lineIndex}`);
            }
            lines.splice(lineIndex + 1, 0, insertContent);
        } else if (change.before_line !== undefined) {
            const lineIndex = change.before_line;
            if (lineIndex < 0 || lineIndex > lines.length) {
                throw new FileChangeError('INVALID_LINE', `Invalid line number: ${lineIndex}`);
            }
            lines.splice(lineIndex, 0, insertContent);
        }

        return lines.join('\n');
    }

    validate(change, originalContent) {
        const errors = [];

        if (typeof change.insert !== 'string') {
            errors.push('insert must be a string');
        }

        if (change.after_line === undefined && change.before_line === undefined) {
            errors.push('Must specify either after_line or before_line');
        }

        return { valid: errors.length === 0, errors };
    }
}

/**
 * Strategy for unified diff patches
 */
class PatchStrategy extends ChangeStrategy {
    constructor() {
        super('patch');
    }

    canHandle(change) {
        return typeof change.patch === 'string' && change.patch.includes('@@');
    }

    apply(change, originalContent) {
        // Parse and apply unified diff
        // This is a simplified implementation - for production, use a proper diff library
        const lines = (originalContent || '').split('\n');
        const patchLines = change.patch.split('\n');

        let currentLine = 0;
        let result = [...lines];
        let offset = 0;

        for (let i = 0; i < patchLines.length; i++) {
            const line = patchLines[i];

            // Parse hunk header: @@ -start,count +start,count @@
            const hunkMatch = line.match(/^@@\s*-(\d+)(?:,(\d+))?\s*\+(\d+)(?:,(\d+))?\s*@@/);
            if (hunkMatch) {
                currentLine = parseInt(hunkMatch[1], 10) - 1 + offset;
                continue;
            }

            if (line.startsWith('-')) {
                // Remove line
                if (result[currentLine] !== undefined) {
                    result.splice(currentLine, 1);
                    offset--;
                }
            } else if (line.startsWith('+')) {
                // Add line
                result.splice(currentLine, 0, line.slice(1));
                currentLine++;
                offset++;
            } else if (line.startsWith(' ') || line === '') {
                // Context line
                currentLine++;
            }
        }

        return result.join('\n');
    }

    validate(change, originalContent) {
        const errors = [];

        if (typeof change.patch !== 'string') {
            errors.push('patch must be a string');
            return { valid: false, errors };
        }

        if (!change.patch.includes('@@')) {
            errors.push('patch must be in unified diff format (contain @@ markers)');
        }

        return { valid: errors.length === 0, errors };
    }
}

/**
 * Custom error class for file change operations
 */
class FileChangeError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'FileChangeError';
        this.code = code;
        this.details = details;
    }
}

/**
 * Main File Change Handler class
 * Uses Strategy Pattern for extensible change handling
 */
class FileChangeHandler {
    constructor(options = {}) {
        this.strategies = [];
        this.options = {
            dryRun: options.dryRun || false,
            validateBeforeApply: options.validateBeforeApply !== false,
            allowHallucination: options.allowHallucination || false,
            backupOriginal: options.backupOriginal || false,
            ...options,
        };

        // Register default strategies (order matters - first match wins)
        this.registerStrategy(new SearchReplaceStrategy());
        this.registerStrategy(new InsertStrategy());
        this.registerStrategy(new PatchStrategy());
        this.registerStrategy(new FullReplaceStrategy()); // Last resort
    }

    /**
     * Register a change strategy
     * @param {ChangeStrategy} strategy 
     */
    registerStrategy(strategy) {
        if (!(strategy instanceof ChangeStrategy)) {
            throw new Error('Strategy must extend ChangeStrategy');
        }
        this.strategies.push(strategy);
    }

    /**
     * Find the appropriate strategy for a change
     * @param {Object} change 
     * @returns {ChangeStrategy|null}
     */
    findStrategy(change) {
        for (const strategy of this.strategies) {
            if (strategy.canHandle(change)) {
                return strategy;
            }
        }
        return null;
    }

    /**
     * Apply a single file change
     * @param {Object} change Change object with path and change data
     * @returns {Object} Result of the change
     */
    async applyChange(change) {
        const result = {
            path: change.path,
            success: false,
            strategy: null,
            originalContent: null,
            newContent: null,
            errors: [],
            warnings: [],
        };

        try {
            // Ensure directory exists
            const dir = dirname(change.path);
            if (dir && dir !== '.' && !existsSync(dir)) {
                if (!this.options.dryRun) {
                    mkdirSync(dir, { recursive: true });
                }
            }

            // Read original content if file exists
            if (existsSync(change.path)) {
                result.originalContent = readFileSync(change.path, 'utf8');
            }

            // Find appropriate strategy
            const strategy = this.findStrategy(change);
            if (!strategy) {
                throw new FileChangeError('NO_STRATEGY',
                    `No strategy found for change to ${change.path}. ` +
                    `Provide either 'content', 'search_replace', 'insert', or 'patch'.`);
            }

            result.strategy = strategy.name;
            console.log(`[FileChangeHandler] Using strategy: ${strategy.name} for ${change.path}`);

            // Validate before applying
            if (this.options.validateBeforeApply) {
                const validation = strategy.validate(change, result.originalContent);
                if (!validation.valid) {
                    throw new FileChangeError('VALIDATION_FAILED',
                        `Validation failed for ${change.path}: ${validation.errors.join(', ')}`,
                        { errors: validation.errors }
                    );
                }
            }

            // Apply the change
            result.newContent = strategy.apply(change, result.originalContent);

            // Write file (unless dry run)
            if (!this.options.dryRun) {
                if (this.options.backupOriginal && result.originalContent) {
                    writeFileSync(`${change.path}.backup`, result.originalContent, 'utf8');
                }
                writeFileSync(change.path, result.newContent, 'utf8');
            }

            result.success = true;
            console.log(`[FileChangeHandler] ✓ ${this.options.dryRun ? '[DRY RUN] ' : ''}Applied ${strategy.name} to ${change.path}`);

        } catch (error) {
            result.success = false;
            result.errors.push(error.message);

            if (error instanceof FileChangeError) {
                result.errorCode = error.code;
                result.errorDetails = error.details;
            }

            console.error(`[FileChangeHandler] ✗ Failed to apply change to ${change.path}: ${error.message}`);
        }

        return result;
    }

    /**
     * Apply multiple file changes
     * @param {Array} changes Array of change objects
     * @returns {Object} Summary of all changes
     */
    async applyChanges(changes) {
        const summary = {
            total: changes.length,
            successful: 0,
            failed: 0,
            results: [],
        };

        for (const change of changes) {
            const result = await this.applyChange(change);
            summary.results.push(result);

            if (result.success) {
                summary.successful++;
            } else {
                summary.failed++;
            }
        }

        console.log(`[FileChangeHandler] Summary: ${summary.successful}/${summary.total} changes applied successfully`);

        return summary;
    }

    /**
     * Rollback changes using stored backups
     * @param {Array} results Array of change results with originalContent
     */
    async rollback(results) {
        console.log('[FileChangeHandler] Rolling back changes...');

        for (const result of results) {
            if (result.success && result.originalContent !== null) {
                try {
                    writeFileSync(result.path, result.originalContent, 'utf8');
                    console.log(`[FileChangeHandler] ✓ Rolled back: ${result.path}`);
                } catch (error) {
                    console.error(`[FileChangeHandler] ✗ Failed to rollback ${result.path}: ${error.message}`);
                }
            }
        }
    }
}

/**
 * Factory function to create a configured handler
 */
function createFileChangeHandler(options = {}) {
    return new FileChangeHandler(options);
}

export {
    FileChangeHandler,
    createFileChangeHandler,
    FileChangeError,
    ChangeStrategy,
    FullReplaceStrategy,
    SearchReplaceStrategy,
    InsertStrategy,
    PatchStrategy,
    CHANGE_TYPES,
};
