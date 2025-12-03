# Auto-Fix System Improvements Summary

## Changes Made

### 1. ✅ Conditional Triggering System

**Problem**: Auto-fix ran automatically for every issue, without human approval.

**Solution**: Implemented two-step approval process:
1. **Triage stage** (automatic): Classifies and labels issue
2. **Auto-fix stage** (manual approval): Requires `auto-fix` or `auto-fix-approved` label

**Implementation**:
- Updated `.github/workflows/auto-fix.yml`:
  - Added `labeled` event trigger
  - Added `check-prerequisites` job that validates approval label
  - Auto-fix only runs if approval label is present
  
**Benefits**:
- Human oversight gate before any code changes
- Maintainer controls which issues get auto-fixed
- Reduces risk of unwanted automated changes
- Triage still provides instant feedback

---

### 2. ✅ Production-Quality Fix Generation

**Problem**: Fixes were quick patches without considering edge cases or best practices.

**Solution**: Enhanced AI prompt to follow senior developer standards.

**Improvements**:

#### Context Enhancement
- Increased file context limit: 5 → 8 related files
- Added dependency analysis (fetches package.json dependencies)
- Detects project framework and language automatically
- Extracts project structure for better understanding
- Infers related files based on issue keywords

#### AI Prompt Improvements (auto-fix-agent.js)
- **Senior developer persona**: "10+ years of experience"
- **Production requirements**: Edge cases, error handling, type safety
- **Framework-specific guidance**: Vue 3 Composition API, React hooks, etc.
- **Code quality checklist**: No magic numbers, descriptive names, DRY principle
- **Accessibility considerations**: ARIA labels, keyboard navigation, screen readers
- **Performance considerations**: Memoization, debouncing, large dataset handling
- **Error handling**: Try-catch blocks, validation, graceful degradation
- **Type safety**: Proper TypeScript types, no `any` abuse
- **Complete implementation**: No TODOs or half-finished features

#### Technical Improvements
- Temperature reduced: 0.2 → 0.1 (more reliable code)
- Max tokens increased: 4000 → 8000 (comprehensive fixes)
- Better file inference with expanded keyword mappings
- Detects explicitly mentioned file paths from issue body

---

### 3. ✅ Improved Triage Agent Communication

**Problem**: Triage comment didn't explain how to trigger auto-fix.

**Solution**: Updated triage-agent.js to add clear instructions.

**Changes**:
- Auto-fix eligible issues now show:
  ```
  **To proceed with auto-fix**: Add the `auto-fix` or `auto-fix-approved` label
  
  Once labeled, the system will automatically:
  1. Generate a comprehensive fix
  2. Run validation checks (lint, type-check)
  3. Create a pull request
  ```
- Clear explanation that human approval is required
- Step-by-step process description

---

### 4. ✅ Comprehensive Documentation

**Created**: `/specs/001-github-auto-fix/USAGE.md`

**Contents**:
- Workflow steps (from issue creation to PR merge)
- Decision matrix (when to use auto-fix)
- Labels reference table
- Common scenarios with examples
- Configuration options
- Troubleshooting guide
- Best practices
- Security considerations
- Metrics to track

**Updated**: `/specs/001-github-auto-fix/quickstart.md`
- Added "Key Changes" section explaining improvements
- Updated architecture diagram with approval gate
- Documented production-quality fix features

---

## Migration Guide

### For Existing Deployments

1. **Pull latest changes**:
   ```bash
   git pull origin main
   ```

2. **Create approval labels**:
   - Go to **Issues** → **Labels** → **New label**
   - Create `auto-fix` label (color: `#0e8a16`, description: "Approval to proceed with auto-fix")
   - Create `auto-fix-approved` label (alternative approval label)

3. **Update workflow** (if you have a custom workflow):
   - Add `labeled` to issue event types
   - Add `check-prerequisites` job from updated auto-fix.yml

4. **Test with existing issue**:
   - Open any triaged issue (with `auto-triage` label)
   - Add `auto-fix` label
   - Verify workflow triggers

5. **Communicate to team**:
   - Share USAGE.md with maintainers
   - Explain new two-step process
   - Set expectations for approval workflow

---

## Workflow Comparison

### Before (Automatic)

```
Issue Created
  ↓
Triage + Auto-Fix (runs immediately)
  ↓
PR Created (no human oversight)
```

**Risk**: Unwanted automated changes, no control

### After (Manual Approval)

```
Issue Created
  ↓
Triage (runs immediately)
  ↓
[Human reviews triage results]
  ↓
Human adds auto-fix label (approval gate)
  ↓
Auto-Fix runs (comprehensive, production-quality)
  ↓
PR Created (ready for review)
```

**Benefits**: Human oversight, better fix quality, controlled automation

---

## Key Files Modified

| File | Changes | Impact |
|------|---------|--------|
| `.github/workflows/auto-fix.yml` | Added `labeled` trigger, prerequisites check | Conditional triggering |
| `.github/agents/triage-agent.js` | Updated comment to explain approval process | User communication |
| `.github/agents/auto-fix-agent.js` | Enhanced AI prompt, better context gathering | Fix quality |
| `specs/001-github-auto-fix/USAGE.md` | NEW: Comprehensive usage guide | Documentation |
| `specs/001-github-auto-fix/quickstart.md` | Updated with key changes, new workflow | Documentation |

---

## Testing Checklist

Before deploying to production:

- [ ] Triage agent runs on issue creation
- [ ] Triage comment includes approval instructions
- [ ] Auto-fix does NOT run without approval label
- [ ] Auto-fix runs when `auto-fix` label is added
- [ ] Auto-fix runs when `auto-fix-approved` label is added
- [ ] Prerequisites job blocks if wrong label is added
- [ ] Generated fixes are comprehensive (not quick patches)
- [ ] Validation runs before PR creation
- [ ] PR description is detailed with validation results
- [ ] Security-sensitive issues are blocked (no auto-fix)

---

## Expected Behavior Examples

### Example 1: Documentation Typo

**Issue**: "Fix typo in README.md: 'teh' → 'the'"

**Timeline**:
1. **0s**: Issue created
2. **15s**: Triage complete, labeled `docs`, `low-risk`, comment posted
3. **[Human decision]**: Review triage, add `auto-fix` label
4. **30s**: Prerequisites check passes
5. **90s**: Auto-fix generates comprehensive fix
6. **120s**: PR created with full context

**Result**: Professional PR with complete file content, validation results, descriptive commit message

---

### Example 2: Component Bug

**Issue**: "BaseButton doesn't show loading spinner when isLoading=true"

**Timeline**:
1. **0s**: Issue created
2. **20s**: Triage complete, labeled `bug`, `medium-risk`, comment posted
3. **[Human decision]**: Review triage, confirm bug is real, add `auto-fix` label
4. **30s**: Prerequisites check passes
5. **150s**: Auto-fix loads BaseButton.vue + related files, generates fix with proper Vue 3 patterns
6. **180s**: Draft PR created (medium risk = requires approval)

**Result**: Draft PR with comprehensive fix including:
- Proper reactive state handling
- Error handling
- TypeScript types
- Accessibility (ARIA labels)
- Matches existing code patterns

---

### Example 3: Security Issue (Blocked)

**Issue**: "Update API key in .env file"

**Timeline**:
1. **0s**: Issue created
2. **15s**: Triage complete, labeled `security`, `high-risk`, `human-review-required`
3. **No auto-fix option**: Comment explains why auto-fix is blocked

**Result**: No PR created, maintainer implements manually

---

## Performance Impact

### Triage Agent
- **Before**: 10-30s (keyword-based classification)
- **After**: 10-30s (no change)

### Auto-Fix Agent
- **Before**: 60-90s (quick patches)
- **After**: 90-150s (comprehensive fixes with more context)
- **Trade-off**: +60s execution time for significantly better code quality

### API Costs
- **Before**: ~500 tokens per fix
- **After**: ~1500 tokens per fix (more context, better prompt)
- **Trade-off**: 3x token cost for production-quality fixes

---

## Rollback Procedure

If you need to revert to automatic behavior:

1. **Remove prerequisites check**:
   ```yaml
   # In .github/workflows/auto-fix.yml
   # Delete the check-prerequisites job
   # Remove needs: check-prerequisites from triage job
   ```

2. **Remove labeled trigger**:
   ```yaml
   on:
     issues:
       types: [opened]  # Remove 'labeled'
   ```

3. **Redeploy workflow**:
   ```bash
   git add .github/workflows/auto-fix.yml
   git commit -m "Revert to automatic auto-fix"
   git push
   ```

---

### 5. ✅ Token-Aware Architecture (2025-12-03)

**Problem**: GitHub Models API has a strict 8,000 token limit, causing "Request body too large" errors when sending multiple files for context.

**Solution**: Implemented comprehensive token management system that adapts to different AI providers.

**Implementation**:

#### AI Provider Auto-Detection
- **GitHub Models**: 8,000 input tokens, 2,000 output tokens (most restrictive)
- **OpenAI GPT-4**: 30,000 input tokens, 4,096 output tokens
- **Anthropic Claude**: 50,000 input tokens, 8,000 output tokens

```javascript
// Auto-detection based on available API keys
function detectAIProvider() {
  if (process.env.ANTHROPIC_API_KEY) return { maxInputTokens: 50000, ... };
  if (process.env.OPENAI_API_KEY) return { maxInputTokens: 30000, ... };
  return { maxInputTokens: 8000, ... }; // GitHub Models default
}
```

#### TokenManager Class
- Estimates tokens using character + word-based calculation
- Tracks budget consumption across file processing
- Prevents exceeding AI provider limits

#### ContentCompressor Class
- **Vue/Svelte files**: Extracts `<script>`, `<template>`, `<style>` by priority
- **TypeScript/JavaScript**: Preserves imports, types, signatures; truncates body
- **Generic files**: Binary search for optimal truncation point

#### Two-Tier Prompt System
| Provider | Prompt Style | Overhead | Features |
|----------|-------------|----------|----------|
| GitHub Models (< 10k) | Compact | ~400 tokens | Minimal structure, essential rules |
| OpenAI/Anthropic (≥ 10k) | Standard | ~800 tokens | Full sections, detailed requirements |

**Token Budget Allocation (GitHub Models)**:
```
Total Budget:        8,000 tokens
├─ Reserved Output: -2,000 tokens  
├─ Prompt Overhead:   -400 tokens (compact mode)
└─ Available Files:  5,600 tokens (~22KB of code)
```

**Token Savings**:
| Component | Before | After | Savings |
|-----------|--------|-------|---------|
| System Context | ~80 | ~20 | 75% |
| Project Context | ~150 | ~30 | 80% |
| Requirements | ~120 | ~50 | 58% |
| Framework Rules | ~200 | ~30 | 85% |
| **Total Overhead** | ~830 | ~270 | **67%** |

**Key Files Modified**:
- `.github/agents/auto-fix-agent.js`: Complete rewrite with token-aware classes

---

### 6. ✅ Architecture-Aware Fix Generation (2025-12-03)

**Problem**: AI was generating fixes that violated project architecture (e.g., adding data fetching code to presentational base components).

**Root Cause**: The auto-fix agent analyzed `package.json` and file structure but never read the project's **specification documents** that define architectural rules.

**Solution**: Implemented comprehensive specification document parsing and architecture validation.

**Implementation**:

#### ProjectAnalyzer Enhancements
Now fetches and parses specification documents:
- `ARCHITECTURE.md`, `SIMPLIFIED_ARCHITECTURE.md`
- `specs/*/plan.md`, `specs/*/research.md`, `specs/*/data-model.md`

```javascript
// NEW: Specification context parsing
async fetchSpecificationContext() {
  const specPaths = [
    'ARCHITECTURE.md',
    'specs/001-form-config-generator/plan.md',
    'specs/001-form-config-generator/research.md',
    // ... more spec files
  ];
  
  // Parse architectural rules from spec documents
  specContext.architecture = this.parseArchitecturalRules(specContents);
  specContext.componentRules = this.parseComponentRules(specContents);
  specContext.dataFlow = this.parseDataFlowRules(specContents);
  specContext.prohibitedPatterns = this.parseProhibitedPatterns(specContents);
}
```

#### ArchitectureValidator Class (NEW)
Validates AI-generated changes against project architecture:

```javascript
class ArchitectureValidator {
  // Patterns that should NOT appear in base components
  static DATA_FETCHING_PATTERNS = [
    /import\s+.*(?:axios|fetch|api|http)/i,
    /useDataSource|useFetch|useQuery|useApi/i,
    /apiClient|httpClient/i,
    // ...
  ];

  static validate(fileChanges, specContext) {
    // Check if base components contain data fetching
    // Check if services are imported in presentational components
    // Ensure composables follow naming conventions
  }
}
```

#### Enhanced AI Prompts
Now include architectural context:

```markdown
## Project Architecture (from specs)

**⚠️ CRITICAL: Follow these architectural rules. Violations will be rejected.**

### Data Flow & Layered Architecture
- Data fetching: composables (useDataSource, etc.)
- Base components: Presentational only, NO data fetching

### Component Responsibilities
**Base Components** (`src/components/base/`):
- Are **dumb/presentational** components
- Receive ALL data via props
- **DO NOT** fetch data or contain business logic

**Composables** (`src/composables/`):
- Handle data fetching (useDataSource, etc.)
- Manage complex state and business logic

### ❌ PROHIBITED (Never Do)
- Adding data fetching to base components
- Importing services in presentational components
```

#### Validation Flow
```
AI generates fix
    ↓
ArchitectureValidator.validate(fileChanges, specContext)
    ↓
├─ ERROR violations → Reject fix, post detailed comment
├─ WARNING violations → Log warning, continue
└─ No violations → Apply changes
```

#### Error Comment for Architecture Violations
When the AI generates code that violates architecture:

```markdown
## ❌ Auto-Fix Failed

**Error**: Fix violates project architecture

### ⚠️ Architecture Violation

**ERROR**: Base component "src/components/base/BaseSelect.vue" contains data fetching code
- File: `src/components/base/BaseSelect.vue`
- Detail: Base components should be presentational only...
- Suggestion: Move data fetching logic to a composable...

### Project Architecture Rules
- **Base Components**: Presentational only, NO data fetching
- **Composables**: Handle data fetching, state management
- **Orchestrators** (FormRenderer): Coordinate between layers

See `specs/001-form-config-generator/plan.md` for full architecture details.
```

**Benefits**:
- AI now understands WHERE code should go, not just WHAT to write
- Prevents architectural drift from automated changes
- Clear error messages guide manual fixes when automation fails
- Specification documents become "living" architecture enforcement

**Key Files Modified**:
- `.github/agents/auto-fix-agent.js`:
  - Added `fetchSpecificationContext()` method
  - Added spec parsing methods (parseArchitecturalRules, parseComponentRules, etc.)
  - Added `ArchitectureValidator` class
  - Added architecture validation step before applying changes
  - Enhanced error comments for architecture violations
  - Added `architecture-review` label for violations

---

### 7. ✅ Modular Architecture System (2025-12-04)

**Problem**: The initial architecture-aware implementation was embedded directly in `auto-fix-agent.js` with hardcoded patterns - not scalable or maintainable.

**User Feedback**: "It seems like it's greedy and quick fix. I want scalable and more robust modular solution."

**Solution**: Refactored architecture validation into a **plugin-based modular system** with separate, reusable modules.

#### New Module Structure

```
.github/agents/shared/
├── spec-parser.js          # Modular specification document parser
├── architecture-rules.js   # Configurable rule definitions & registry
├── architecture-validator.js # Plugin-based validation engine
└── index.js                # Module exports
```

#### Module 1: SpecParser (`spec-parser.js`)

**Purpose**: Parse specification documents to extract architectural rules.

**Features**:
- **Plugin-based extractors**: Add custom rule extractors without modifying core code
- **Configurable spec paths**: Define where to look for specs per project
- **Multiple rule types**: ARCHITECTURE, COMPONENT, PROHIBITED, REQUIRED, DATA_FLOW

```javascript
import { SpecParser } from './shared/spec-parser.js';

const parser = new SpecParser();

// Add custom rule extractor
parser.addExtractor('custom', (content, path) => {
  // Extract project-specific rules
  return [{ type: 'CUSTOM', rule: '...', source: path }];
});

// Parse spec contents
const context = parser.parse(specContents);
// Returns: { hasSpecs, summary, rules: { architecture, component, prohibited, ... } }
```

**Built-in Extractors**:
| Extractor | Detects |
|-----------|---------|
| architecture | Layer definitions, responsibilities, constraints |
| component | Base component rules, composable patterns |
| prohibited | "DO NOT", "NEVER", "MUST NOT" patterns |
| required | "MUST", "ALWAYS", "REQUIRED" patterns |
| dataFlow | Data fetching layer, presentation layer rules |

#### Module 2: ArchitectureRules (`architecture-rules.js`)

**Purpose**: Define, register, and manage architectural validation rules.

**Features**:
- **Rule classes**: Extensible base classes for different rule types
- **Rule templates**: Pre-built rules for common patterns
- **Rules registry**: Dynamic rule management with enable/disable

**Rule Types**:
```javascript
import { 
  PathPatternRule,   // Check patterns in files matching path
  ImportRule,        // Check import statements
  NamingRule,        // Check naming conventions
  CompositeRule,     // Combine multiple rules
  RuleTemplates      // Pre-built rule templates
} from './shared/architecture-rules.js';

// Use a template for presentational components
const rule = RuleTemplates.presentationalComponent({
  pathPattern: /\/components\/base\//,
  componentType: 'Base components'
});

// Create custom rule
const customRule = new PathPatternRule({
  id: 'no-console-log',
  name: 'No Console.log in Production',
  pathPattern: /\.ts$/,
  forbiddenPatterns: [/console\.log/],
  severity: Severity.WARNING,
  suggestion: 'Use a logger instead of console.log'
});
```

**Built-in Templates**:
| Template | Purpose |
|----------|---------|
| `presentationalComponent` | Ensure no data fetching in presentational components |
| `serviceLayer` | Ensure no UI logic in services |
| `composableNaming` | Ensure `use` prefix for composables/hooks |
| `noDirectStoreImports` | Prevent components from importing stores directly |

**Severity Levels**:
- `ERROR`: Blocks auto-fix, requires human intervention
- `WARNING`: Logs warning, continues processing
- `INFO`: Informational only

#### Module 3: ArchitectureValidator (`architecture-validator.js`)

**Purpose**: Plugin-based validation engine for code changes.

**Features**:
- **Plugin architecture**: Add custom validators without modifying core
- **Parallel validation**: Validate multiple files efficiently
- **Rich results**: Grouped by file, rule, with suggestions

```javascript
import { createValidator, validateFiles } from './shared/architecture-validator.js';

// Quick validation
const result = await validateFiles(files, { specContext });

// Custom validator with plugins
const validator = createValidator();
validator.use(new CustomValidatorPlugin());
await validator.initialize(context);
const result = await validator.validateChanges(changes, context);

// Result has rich information
console.log(result.passed);           // boolean
console.log(result.violations);       // ERROR violations
console.log(result.warnings);         // WARNING violations
console.log(result.format());         // Formatted text output
console.log(result.toMarkdown());     // GitHub-compatible markdown
```

**Built-in Plugins**:
| Plugin | Validates |
|--------|-----------|
| `RuleBasedValidatorPlugin` | Validates against registered rules |
| `DataFlowValidatorPlugin` | Validates data flow patterns |
| `ContractValidatorPlugin` | Detects breaking changes to exports |

#### Integration with auto-fix-agent.js

```javascript
// OLD: Inline, hardcoded validation
class ArchitectureValidator {
  static DATA_FETCHING_PATTERNS = [...]; // Hardcoded
  static validate(changes, context) { ... } // Embedded logic
}

// NEW: Modular, extensible validation
import { SpecParser } from './shared/spec-parser.js';
import { createValidator } from './shared/architecture-validator.js';
import { createDefaultRegistry } from './shared/architecture-rules.js';

class ProjectAnalyzer {
  constructor() {
    this.specParser = new SpecParser(); // Modular parser
  }
  
  async fetchSpecificationContext() {
    const specContents = await this.discoverSpecFiles();
    return this.specParser.parse(specContents); // Delegation
  }
}

class ArchitectureValidator {
  static async validate(fileChanges, specContext) {
    const validator = createValidator();
    const registry = createDefaultRegistry(framework);
    registry.generateFromSpecs(specContext); // Dynamic rules
    
    await validator.initialize({ specContext, rulesRegistry: registry });
    return validator.validateFiles(files, { specContext });
  }
}
```

#### Scalability Features

| Feature | Benefit |
|---------|---------|
| **Plugin extractors** | Add custom spec parsing without modifying core |
| **Rule templates** | Reuse common patterns across projects |
| **Dynamic registry** | Load rules from config files or specs |
| **Validator plugins** | Add custom validation logic as plugins |
| **Framework detection** | Auto-configure rules based on detected framework |
| **Configurable paths** | Project-specific spec file locations |

#### Adding Custom Rules

```javascript
// In project root: .github/architecture-rules.json
{
  "rules": [
    {
      "template": "presentationalComponent",
      "pathPattern": "/components/atoms/",
      "componentType": "Atomic components"
    },
    {
      "type": "path-pattern",
      "id": "no-direct-api",
      "pathPattern": "/components/",
      "forbiddenPatterns": ["axios\\.get", "fetch\\("],
      "suggestion": "Use composables for data fetching"
    }
  ]
}
```

```javascript
// Load custom rules
const config = JSON.parse(readFileSync('.github/architecture-rules.json'));
registry.loadFromConfig(config);
```

**Benefits of Modular Architecture**:
- ✅ **Separation of Concerns**: Each module has single responsibility
- ✅ **Extensibility**: Add new rules/extractors without modifying core
- ✅ **Testability**: Modules can be tested independently
- ✅ **Reusability**: Modules can be used in other projects
- ✅ **Configurability**: Project-specific rules via config files
- ✅ **Maintainability**: Changes isolated to specific modules

**Key Files Created**:
- `.github/agents/shared/spec-parser.js`: 403 lines
- `.github/agents/shared/architecture-rules.js`: 500+ lines
- `.github/agents/shared/architecture-validator.js`: 400+ lines
- `.github/agents/shared/index.js`: Module exports

---

### 8. ✅ Dynamic File Discovery System

**Problem**: Static file mappings couldn't adapt to different project structures.

**Solution**: Implemented multi-strategy file discovery with scoring system.

**Strategies**:
1. **Explicit paths** (100 points): Parse file paths from issue body
2. **Triage analysis** (90 points): Use affected files from triage
3. **Semantic matching** (variable): Match keywords to file names/paths
4. **Convention-based** (20 points): Use framework conventions (src/components, etc.)
5. **AI-assisted** (70 points): LLM suggests relevant files
6. **Import analysis** (30 points): Find files that import the affected code

**Implementation Classes**:
- `ProjectAnalyzer`: Discovers framework, language, conventions
- `FileDiscovery`: Multi-strategy file finding with scoring
- Token-aware file selection: Stops when budget exhausted

---

## Future Enhancements

Potential improvements for future iterations:

1. ~~**AI Model Selection**~~: ✅ Now auto-detects provider and adapts
2. **Custom Approval Workflows**: Support for PR-based approval instead of labels
3. **Learning from Feedback**: Track which auto-fixes get approved/rejected to improve prompts
4. **Multi-file Refactoring**: Support for larger-scope changes with architectural analysis
5. **Integration Tests**: Auto-generate and run integration tests before PR creation (when testing is enabled)
6. ~~**Cost Tracking**~~: ✅ Token usage now logged and managed
7. **Custom Conventions**: Repository-specific coding standards configuration
8. **Rollback Automation**: Auto-revert if PR fails CI/CD checks
9. **Streaming Responses**: Support for streaming AI responses for better UX
10. **Caching**: Cache project structure and file contents for faster subsequent runs

---

## Support & Feedback

**Documentation**:
- Usage guide: `/specs/001-github-auto-fix/USAGE.md`
- Quick start: `/specs/001-github-auto-fix/quickstart.md`
- Technical details: `/specs/001-github-auto-fix/plan.md`

**Getting Help**:
1. Check Actions logs for workflow errors
2. Review triage/error comments on issues
3. Consult USAGE.md troubleshooting section
4. Check security constraints in `shared/security-constraints.js`

**Providing Feedback**:
- Report issues with auto-fix quality
- Suggest improvements to AI prompts
- Document edge cases that need handling
- Share success stories and metrics
