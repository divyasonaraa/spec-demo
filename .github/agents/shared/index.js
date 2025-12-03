/**
 * Shared Modules Index
 * 
 * This file exports all shared modules for easy importing.
 * Import like: import { SpecificationParser, createValidator } from './shared/index.js';
 * 
 * @module shared
 */

// Specification Parsing
export * from './spec-parser.js';

// Architecture Rules
export * from './architecture-rules.js';

// Architecture Validation
export * from './architecture-validator.js';

// Re-export commonly used items with simpler names for convenience
export { SpecificationParser, createSpecParser } from './spec-parser.js';
export {
    ArchitectureRulesRegistry,
    RuleTemplates,
    createDefaultRegistry
} from './architecture-rules.js';
export {
    createValidator,
    validateFile,
    validateFiles
} from './architecture-validator.js';
