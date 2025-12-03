#!/usr/bin/env node

/**
 * Auto-Fix Agent - Production-grade automated code fix system
 * 
 * Architecture:
 * - Dynamic file discovery (no hardcoded mappings)
 * - AI-powered file inference using repository analysis
 * - Scalable design with pluggable components
 * - Modular file change handling with multiple strategies
 * - Comprehensive error handling and recovery
 * 
 * Input: TriageResult from triage agent
 * Output: Commit[] with diffs, validation results, commit SHAs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { getGitHubClient } from './shared/github-client.js';
import { getAIClient } from './shared/ai-client.js';
import { AutoFixError } from './shared/error-handler.js';
import * as gitOps from './shared/git-operations.js';
import { checkSecurityFilePath, checkRiskyChangeTypes } from './shared/security-constraints.js';
// Import modular architecture validation system
import { SpecificationParser, DEFAULT_SPEC_PATHS } from './shared/spec-parser.js';
import { createValidator } from './shared/architecture-validator.js';
import { createDefaultRegistry, Severity } from './shared/architecture-rules.js';
// Import modular file change handler
import { createFileChangeHandler, FileChangeError } from './shared/file-change-handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// CONFIGURATION - Centralized & Environment-driven
// ============================================================================

// ============================================================================
// AI PROVIDER DETECTION - Determines token limits automatically
// ============================================================================

/**
 * Detect which AI provider is configured and return appropriate limits
 */
function detectAIProvider() {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGitHub = !!process.env.GITHUB_TOKEN && !hasAnthropic && !hasOpenAI;

  if (hasAnthropic) {
    return {
      provider: 'anthropic',
      name: 'Anthropic Claude',
      // Claude has 100k-200k context, but we use conservative limits for cost
      maxInputTokens: 50000,
      maxOutputTokens: 8000,
      tokensPerChar: 0.25, // ~4 chars per token for code
      reservedForPrompt: 2000, // Reserve for system prompt
      reservedForOutput: 8000, // Reserve for response
    };
  }

  if (hasOpenAI) {
    return {
      provider: 'openai',
      name: 'OpenAI GPT-4',
      // GPT-4 Turbo has 128k context
      maxInputTokens: 30000,
      maxOutputTokens: 4096,
      tokensPerChar: 0.25,
      reservedForPrompt: 1500,
      reservedForOutput: 4096,
    };
  }

  // Default: GitHub Models (most restrictive)
  return {
    provider: 'github-models',
    name: 'GitHub Models',
    maxInputTokens: 8000, // Hard limit from error
    maxOutputTokens: 2000,
    tokensPerChar: 0.30, // More conservative for safety
    reservedForPrompt: 1200, // Compact prompt
    reservedForOutput: 2000,
  };
}

const AI_PROVIDER = detectAIProvider();
console.log(`[AI Client] Using ${AI_PROVIDER.name} (${AI_PROVIDER.provider})`);
console.log(`[AI Client] Token budget: ${AI_PROVIDER.maxInputTokens} input, ${AI_PROVIDER.maxOutputTokens} output`);

const CONFIG = Object.freeze({
  // Environment
  issueNumber: process.env.ISSUE_NUMBER,
  triageResultPath: process.env.TRIAGE_RESULT_PATH || './triage-result.json',
  outputPath: process.env.OUTPUT_PATH || './commit-result.json',
  timeoutMs: parseInt(process.env.TIMEOUT_MS || '120000', 10),
  defaultBranch: process.env.DEFAULT_BRANCH || 'main',

  // Token-Aware Limits (dynamically calculated)
  maxInputTokens: AI_PROVIDER.maxInputTokens,
  maxOutputTokens: AI_PROVIDER.maxOutputTokens,
  tokensPerChar: AI_PROVIDER.tokensPerChar,
  reservedForPrompt: AI_PROVIDER.reservedForPrompt,
  reservedForOutput: AI_PROVIDER.reservedForOutput,

  // Calculated file budget (tokens available for file contents)
  fileTokenBudget: AI_PROVIDER.maxInputTokens - AI_PROVIDER.reservedForPrompt - AI_PROVIDER.reservedForOutput,

  // Legacy limits (now secondary to token budget)
  maxFilesToFetch: parseInt(process.env.MAX_FILES || '8', 10),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '50000', 10), // 50KB per file
  maxTotalContext: parseInt(process.env.MAX_CONTEXT || '200000', 10), // 200KB total

  // AI Settings
  temperature: parseFloat(process.env.AI_TEMPERATURE || '0.1'),

  // File Discovery
  searchDepth: parseInt(process.env.SEARCH_DEPTH || '4', 10),
  excludePatterns: [
    'node_modules', '.git', 'dist', 'build', 'coverage',
    '.cache', '.next', '.nuxt', '__pycache__', 'vendor',
    '.turbo', '.vercel', '.output', 'out', '.svelte-kit'
  ],
});

// ============================================================================
// FRAMEWORK DETECTION REGISTRY - Extensible Plugin Architecture
// ============================================================================

/**
 * Token manager - estimates and manages token budget
 * Critical for staying within AI provider limits
 */
class TokenManager {
  constructor() {
    this.tokensPerChar = CONFIG.tokensPerChar;
    this.budget = CONFIG.fileTokenBudget;
    this.used = 0;
  }

  /**
   * Estimate tokens for a string
   * Uses character-based estimation (conservative)
   */
  estimate(text) {
    if (!text) return 0;
    // More accurate estimation: count words and special chars
    const words = text.split(/\s+/).length;
    const chars = text.length;
    // Tokens ≈ max(words * 1.3, chars * 0.25)
    return Math.ceil(Math.max(words * 1.3, chars * this.tokensPerChar));
  }

  /**
   * Check if we can afford more tokens
   */
  canAfford(tokens) {
    return (this.used + tokens) <= this.budget;
  }

  /**
   * Get remaining budget
   */
  remaining() {
    return Math.max(0, this.budget - this.used);
  }

  /**
   * Consume tokens from budget
   */
  consume(tokens) {
    this.used += tokens;
    return this.remaining();
  }

  /**
   * Get usage summary
   */
  summary() {
    const pct = ((this.used / this.budget) * 100).toFixed(1);
    return `${this.used}/${this.budget} tokens (${pct}%)`;
  }
}

/**
 * Content compressor - intelligently reduces file content to fit token budget
 * Uses multiple strategies to preserve the most important information
 */
class ContentCompressor {
  /**
   * Compress file content to fit within token limit
   * Strategy: Extract most important parts of the code
   */
  static compress(content, filePath, maxTokens, tokenManager) {
    const estimated = tokenManager.estimate(content);

    // If it fits, return as-is
    if (estimated <= maxTokens) {
      return { content, strategy: 'full', tokens: estimated };
    }

    const ext = extname(filePath).slice(1).toLowerCase();

    // Choose compression strategy based on file type
    if (['vue', 'svelte'].includes(ext)) {
      return this.compressVueComponent(content, maxTokens, tokenManager);
    } else if (['ts', 'js', 'tsx', 'jsx'].includes(ext)) {
      return this.compressTypeScript(content, maxTokens, tokenManager);
    } else if (['css', 'scss', 'less'].includes(ext)) {
      return this.compressStyles(content, maxTokens, tokenManager);
    } else {
      return this.compressGeneric(content, maxTokens, tokenManager);
    }
  }

  /**
   * Compress Vue/Svelte components - preserve structure
   */
  static compressVueComponent(content, maxTokens, tokenManager) {
    const sections = [];

    // Extract <script setup> or <script> - most important
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (scriptMatch) {
      sections.push({ type: 'script', content: scriptMatch[0], priority: 1 });
    }

    // Extract <template> - important for structure
    const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/i);
    if (templateMatch) {
      sections.push({ type: 'template', content: templateMatch[0], priority: 2 });
    }

    // Extract <style> - lower priority
    const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    if (styleMatch) {
      sections.push({ type: 'style', content: styleMatch[0], priority: 3 });
    }

    // Sort by priority and include what fits
    sections.sort((a, b) => a.priority - b.priority);

    let result = '';
    let tokens = 0;

    for (const section of sections) {
      const sectionTokens = tokenManager.estimate(section.content);
      if (tokens + sectionTokens <= maxTokens) {
        result += section.content + '\n\n';
        tokens += sectionTokens;
      } else if (section.type === 'script') {
        // Script is critical - truncate if needed
        const truncated = this.truncateToTokens(section.content, maxTokens - tokens, tokenManager);
        result += truncated + '\n<!-- TRUNCATED -->\n';
        tokens = maxTokens;
        break;
      }
    }

    return { content: result.trim(), strategy: 'vue-sections', tokens };
  }

  /**
   * Compress TypeScript/JavaScript - preserve signatures and structure
   */
  static compressTypeScript(content, maxTokens, tokenManager) {
    const lines = content.split('\n');
    const importantLines = [];
    const bodyLines = [];

    let inImports = true;
    let braceDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Always keep imports and exports
      if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
        importantLines.push(line);
        inImports = true;
        continue;
      }

      // Keep type/interface definitions
      if (trimmed.startsWith('interface ') || trimmed.startsWith('type ') ||
        trimmed.startsWith('export interface') || trimmed.startsWith('export type')) {
        importantLines.push(line);
        continue;
      }

      // Keep function/class signatures
      if (trimmed.match(/^(export\s+)?(async\s+)?function\s+\w+|^(export\s+)?class\s+\w+|^(export\s+)?const\s+\w+\s*=|^\w+\s*\([^)]*\)\s*[:{]/)) {
        importantLines.push(line);
        continue;
      }

      // Track brace depth for context
      braceDepth += (line.match(/{/g) || []).length;
      braceDepth -= (line.match(/}/g) || []).length;

      bodyLines.push(line);
    }

    // Build result: imports first, then as much body as fits
    let result = importantLines.join('\n');
    let tokens = tokenManager.estimate(result);

    // Add body lines until we hit the limit
    const remainingBudget = maxTokens - tokens;
    if (remainingBudget > 100 && bodyLines.length > 0) {
      const bodyContent = bodyLines.join('\n');
      const truncatedBody = this.truncateToTokens(bodyContent, remainingBudget, tokenManager);
      result += '\n\n// === BODY (truncated) ===\n' + truncatedBody;
      tokens = tokenManager.estimate(result);
    }

    return { content: result, strategy: 'ts-signatures', tokens };
  }

  /**
   * Compress CSS/SCSS - keep selectors, truncate values
   */
  static compressStyles(content, maxTokens, tokenManager) {
    // For styles, just truncate from the end
    return this.compressGeneric(content, maxTokens, tokenManager);
  }

  /**
   * Generic compression - smart truncation
   */
  static compressGeneric(content, maxTokens, tokenManager) {
    const truncated = this.truncateToTokens(content, maxTokens, tokenManager);
    const tokens = tokenManager.estimate(truncated);
    return {
      content: truncated + '\n\n/* ... TRUNCATED ... */',
      strategy: 'truncated',
      tokens
    };
  }

  /**
   * Truncate content to fit within token limit
   */
  static truncateToTokens(content, maxTokens, tokenManager) {
    if (tokenManager.estimate(content) <= maxTokens) {
      return content;
    }

    // Binary search for optimal length
    const lines = content.split('\n');
    let low = 0;
    let high = lines.length;

    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      const slice = lines.slice(0, mid).join('\n');
      if (tokenManager.estimate(slice) <= maxTokens) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    return lines.slice(0, low).join('\n');
  }

  /**
   * Extract function/method signatures from TypeScript
   */
  static extractSignatures(content) {
    const signatures = [];

    // Match function declarations
    const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(<[^>]+>)?\s*\(([^)]*)\)\s*(?::\s*([^{]+))?/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      signatures.push(`function ${match[1]}(${match[3]})${match[4] ? ': ' + match[4].trim() : ''}`);
    }

    // Match arrow functions
    const arrowRegex = /(?:export\s+)?const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::\s*([^=]+))?\s*=>/g;
    while ((match = arrowRegex.exec(content)) !== null) {
      signatures.push(`const ${match[1]} = (${match[2]})${match[3] ? ' => ' + match[3].trim() : ''}`);
    }

    // Match class methods
    const methodRegex = /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?(?:\s*{)/g;
    while ((match = methodRegex.exec(content)) !== null) {
      if (!['if', 'for', 'while', 'switch', 'catch', 'function'].includes(match[1])) {
        signatures.push(`${match[1]}(${match[2]})${match[3] ? ': ' + match[3].trim() : ''}`);
      }
    }

    return signatures;
  }
}

/**
 * Framework detector registry - easily extensible
 * Add new frameworks by appending to this array
 * NOTE: promptAdditions kept minimal - detailed rules in PromptBuilder.getFrameworkRules()
 */
const FRAMEWORK_DETECTORS = [
  {
    name: 'Vue.js',
    detect: (deps) => deps['vue'] || deps['@vue/cli-service'] || deps['nuxt'],
    getProjectType: (deps) => {
      if (deps['nuxt']) return 'Nuxt';
      if (deps['vite']) return 'Vite + Vue 3';
      return 'Vue CLI';
    },
    filePatterns: {
      components: /\.vue$/,
      composables: /^use[A-Z].*\.(ts|js)$/,
      stores: /store\.(ts|js)$|\.store\.(ts|js)$/,
    },
    conventions: {
      componentDir: 'src/components',
      composableDir: 'src/composables',
      viewDir: 'src/views',
      typeDir: 'src/types',
      storeDir: 'src/stores',
    },
    // Compact: detailed rules in PromptBuilder
    promptAdditions: '',
  },
  {
    name: 'React',
    detect: (deps) => deps['react'] || deps['react-dom'],
    getProjectType: (deps) => {
      if (deps['next']) return 'Next.js';
      if (deps['gatsby']) return 'Gatsby';
      if (deps['remix']) return 'Remix';
      return 'React';
    },
    filePatterns: {
      components: /\.(tsx|jsx)$/,
      hooks: /^use[A-Z].*\.(ts|js)$/,
    },
    conventions: {
      componentDir: 'src/components',
      hookDir: 'src/hooks',
      pageDir: 'src/pages',
    },
    promptAdditions: '',
  },
  {
    name: 'Angular',
    detect: (deps) => deps['@angular/core'],
    getProjectType: () => 'Angular',
    filePatterns: {
      components: /\.component\.ts$/,
      services: /\.service\.ts$/,
      modules: /\.module\.ts$/,
    },
    conventions: {
      componentDir: 'src/app',
    },
    promptAdditions: '',
  },
  {
    name: 'Svelte',
    detect: (deps) => deps['svelte'],
    getProjectType: (deps) => deps['@sveltejs/kit'] ? 'SvelteKit' : 'Svelte',
    filePatterns: {
      components: /\.svelte$/,
    },
    conventions: {
      componentDir: 'src/lib',
      routeDir: 'src/routes',
    },
    promptAdditions: '',
  },
  {
    name: 'Node.js',
    detect: () => true, // Fallback - always matches
    getProjectType: (deps) => {
      if (deps['express']) return 'Express';
      if (deps['fastify']) return 'Fastify';
      if (deps['koa']) return 'Koa';
      if (deps['nestjs'] || deps['@nestjs/core']) return 'NestJS';
      return 'Node.js';
    },
    filePatterns: {
      source: /\.(ts|js|mjs|cjs)$/,
    },
    conventions: {
      sourceDir: 'src',
    },
    promptAdditions: '',
  }
];

// ============================================================================
// CORE CLASSES - SOLID Principles Applied
// ============================================================================

/**
 * Project context analyzer - discovers project structure dynamically
 * Single Responsibility: Only analyzes project structure
 * 
 * IMPORTANT: Uses modular SpecificationParser for architectural context
 */
class ProjectAnalyzer {
  constructor(github, owner, repo, ref) {
    this.github = github;
    this.owner = owner;
    this.repo = repo;
    this.ref = ref;
    this.cache = new Map();
    // NEW: Use modular spec parser
    this.specParser = new SpecificationParser();
  }

  /**
   * Analyze project and return comprehensive context
   * Now uses modular SpecificationParser for architectural understanding
   */
  async analyze() {
    console.log('[ProjectAnalyzer] Analyzing project structure...');

    const [packageJson, structure, specContext] = await Promise.all([
      this.fetchPackageJson(),
      this.fetchProjectStructure(),
      this.fetchSpecificationContext()
    ]);

    const framework = this.detectFramework(packageJson);
    const language = this.detectLanguage(packageJson);

    console.log(`[ProjectAnalyzer] Detected: ${framework.name} (${language})`);
    console.log(`[ProjectAnalyzer] Found ${structure.length} files/directories`);
    if (specContext.hasSpecs) {
      console.log(`[ProjectAnalyzer] Loaded specification context: ${specContext.summary}`);
    }

    return {
      framework: framework.name,
      frameworkConfig: framework,
      projectType: framework.getProjectType(packageJson.dependencies || {}),
      language,
      dependencies: { ...packageJson.dependencies, ...packageJson.devDependencies },
      scripts: packageJson.scripts || {},
      structure,
      conventions: framework.conventions,
      filePatterns: framework.filePatterns,
      promptAdditions: framework.promptAdditions,
      // NEW: Specification context from modular parser
      specContext,
    };
  }

  /**
   * Fetch and parse specification documents using modular SpecificationParser
   * This prevents AI from making changes that violate architectural patterns
   */
  async fetchSpecificationContext() {
    // Collect all spec file contents
    const specContents = [];

    // Dynamic spec file discovery
    const specPaths = await this.discoverSpecFiles();

    for (const specPath of specPaths) {
      try {
        const content = await this.fetchFileContent(specPath);
        if (content) {
          specContents.push({ path: specPath, content });
          console.log(`[ProjectAnalyzer] Loaded spec: ${specPath}`);
        }
      } catch {
        // Spec file doesn't exist, continue
      }
    }

    if (specContents.length === 0) {
      return {
        hasSpecs: false,
        summary: 'No specification documents found',
        rules: {}
      };
    }

    // Use modular SpecParser
    const specContext = this.specParser.parse(specContents);
    return specContext;
  }

  /**
   * Dynamically discover specification files in the repository
   * Searches common locations and patterns
   */
  async discoverSpecFiles() {
    const paths = new Set();

    // Check root-level architecture docs
    const rootDocs = ['ARCHITECTURE.md', 'SIMPLIFIED_ARCHITECTURE.md', 'docs/ARCHITECTURE.md', 'docs/architecture.md'];
    for (const doc of rootDocs) {
      paths.add(doc);
    }

    // Dynamically find spec directories
    try {
      const specsContent = await this.fetchDirectoryContent('specs');
      if (specsContent && Array.isArray(specsContent)) {
        for (const item of specsContent) {
          if (item.type === 'dir') {
            // Add common spec files from each spec directory
            const specFiles = ['plan.md', 'research.md', 'data-model.md', 'spec.md'];
            for (const file of specFiles) {
              paths.add(`specs/${item.name}/${file}`);
            }
          }
        }
      }
    } catch {
      // specs directory doesn't exist
    }

    // Check for .specify directory (speckit pattern)
    try {
      const specifyContent = await this.fetchDirectoryContent('.specify');
      if (specifyContent && Array.isArray(specifyContent)) {
        for (const item of specifyContent) {
          if (item.type === 'file' && item.name.endsWith('.md')) {
            paths.add(`.specify/${item.name}`);
          }
        }
      }
    } catch {
      // .specify directory doesn't exist
    }

    return Array.from(paths);
  }

  /**
   * Fetch directory content from GitHub
   */
  async fetchDirectoryContent(path) {
    try {
      const { data } = await this.github.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: this.ref
      });
      return Array.isArray(data) ? data : null;
    } catch {
      return null;
    }
  }

  async fetchFileContent(filePath) {
    const cacheKey = `content:${filePath}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    try {
      const { data } = await this.github.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: filePath,
        ref: this.ref
      });

      if (data.type !== 'file') return null;

      const content = Buffer.from(data.content, 'base64').toString('utf8');
      this.cache.set(cacheKey, content);
      return content;
    } catch {
      return null;
    }
  }

  async fetchPackageJson() {
    const cacheKey = 'package.json';
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    try {
      const { data } = await this.github.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: 'package.json',
        ref: this.ref
      });
      const result = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      this.cache.set(cacheKey, result);
      return result;
    } catch {
      return { dependencies: {}, devDependencies: {}, scripts: {} };
    }
  }

  async fetchProjectStructure(path = '', depth = 0) {
    if (depth > CONFIG.searchDepth) return [];

    const cacheKey = `structure:${path}:${depth}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    try {
      const { data } = await this.github.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: this.ref
      });

      if (!Array.isArray(data)) return [];

      const items = [];
      const subDirPromises = [];

      for (const item of data) {
        // Skip excluded patterns
        if (CONFIG.excludePatterns.some(p =>
          item.name === p || item.path.includes(`/${p}/`)
        )) {
          continue;
        }

        if (item.type === 'dir') {
          items.push({ type: 'dir', path: item.path, name: item.name });
          // Collect subdirectory fetches for parallel execution
          if (depth < CONFIG.searchDepth - 1) {
            subDirPromises.push(
              this.fetchProjectStructure(item.path, depth + 1)
            );
          }
        } else if (item.type === 'file') {
          items.push({
            type: 'file',
            path: item.path,
            name: item.name,
            size: item.size,
            extension: extname(item.name)
          });
        }
      }

      // Fetch subdirectories in parallel
      const subResults = await Promise.all(subDirPromises);
      for (const subItems of subResults) {
        items.push(...subItems);
      }

      this.cache.set(cacheKey, items);
      return items;
    } catch (error) {
      console.warn(`[ProjectAnalyzer] Failed to fetch ${path}:`, error.message);
      return [];
    }
  }

  detectFramework(packageJson) {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    for (const detector of FRAMEWORK_DETECTORS) {
      if (detector.detect(deps)) {
        return detector;
      }
    }

    // Return Node.js as fallback (last in array)
    return FRAMEWORK_DETECTORS[FRAMEWORK_DETECTORS.length - 1];
  }

  detectLanguage(packageJson) {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    return deps['typescript'] ? 'TypeScript' : 'JavaScript';
  }
}

/**
 * Intelligent file finder - discovers relevant files dynamically
 * Uses multiple strategies with scoring for best results
 */
class FileDiscovery {
  constructor(projectContext, github, owner, repo, ref) {
    this.context = projectContext;
    this.github = github;
    this.owner = owner;
    this.repo = repo;
    this.ref = ref;
  }

  /**
   * Find files relevant to an issue using multiple strategies
   * Returns files sorted by relevance score
   */
  async findRelevantFiles(issue, triage) {
    console.log('[FileDiscovery] Starting file discovery...');

    const issueText = `${issue.title} ${issue.body || ''}`;
    const candidates = new Map(); // path -> { score, reasons }

    // Strategy 1: Extract explicitly mentioned file paths (highest priority)
    const explicitFiles = this.extractExplicitPaths(issue.body || '');
    explicitFiles.forEach(f => this.addCandidate(candidates, f, 100, 'explicit mention'));
    console.log(`[FileDiscovery] Strategy 1 (explicit): ${explicitFiles.length} files`);

    // Strategy 2: Use triage affected files
    (triage.affectedFiles || []).forEach(f =>
      this.addCandidate(candidates, f, 90, 'triage analysis')
    );
    console.log(`[FileDiscovery] Strategy 2 (triage): ${(triage.affectedFiles || []).length} files`);

    // Strategy 3: Semantic keyword matching from project structure
    const keywordFiles = this.findBySemanticMatch(issueText);
    keywordFiles.forEach(({ path, score, reason }) =>
      this.addCandidate(candidates, path, score, reason)
    );
    console.log(`[FileDiscovery] Strategy 3 (semantic): ${keywordFiles.length} matches`);

    // Strategy 4: Convention-based discovery
    const conventionFiles = this.findByConventions(issueText);
    conventionFiles.forEach(({ path, score }) =>
      this.addCandidate(candidates, path, score, 'convention match')
    );
    console.log(`[FileDiscovery] Strategy 4 (conventions): ${conventionFiles.length} matches`);

    // Strategy 5: AI-assisted file discovery for complex/ambiguous issues
    if (candidates.size < 3) {
      const aiFiles = await this.aiAssistedDiscovery(issue, triage);
      aiFiles.forEach(f => this.addCandidate(candidates, f, 70, 'AI inference'));
      console.log(`[FileDiscovery] Strategy 5 (AI): ${aiFiles.length} suggestions`);
    }

    // Strategy 6: Related files discovery (imports/dependencies)
    const topCandidates = this.getTopCandidates(candidates, 5);
    const relatedFiles = await this.findRelatedFiles(topCandidates);
    relatedFiles.forEach(f =>
      this.addCandidate(candidates, f, 30, 'import dependency')
    );
    console.log(`[FileDiscovery] Strategy 6 (related): ${relatedFiles.length} files`);

    // Validate existence and apply limits
    const validatedFiles = await this.validateAndLimit(
      this.getTopCandidates(candidates, CONFIG.maxFilesToFetch * 2)
    );

    console.log(`[FileDiscovery] Final selection: ${validatedFiles.length} files`);
    return validatedFiles;
  }

  /**
   * Add candidate with score tracking
   */
  addCandidate(candidates, path, score, reason) {
    if (!path || typeof path !== 'string') return;

    const existing = candidates.get(path);
    if (existing) {
      existing.score += score;
      existing.reasons.push(reason);
    } else {
      candidates.set(path, { score, reasons: [reason] });
    }
  }

  /**
   * Get top N candidates sorted by score
   */
  getTopCandidates(candidates, limit) {
    return [...candidates.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, limit)
      .map(([path]) => path);
  }

  /**
   * Extract file paths mentioned in issue body using multiple patterns
   */
  extractExplicitPaths(text) {
    const patterns = [
      // Full paths from src, lib, app, etc.
      /(?:^|[\s`'"])((src|lib|app|components|pages|views|hooks|composables|utils|services|types|models|store|stores|api|config)\/[\w\-\/\.]+\.\w+)/gim,
      // Vue/Svelte files
      /[\s`'"]([\w\-\/]+\.(vue|svelte))/gi,
      // TypeScript/JavaScript files
      /[\s`'"]([\w\-\/]+\.(ts|tsx|js|jsx|mjs|cjs))/gi,
      // Style files
      /[\s`'"]([\w\-\/]+\.(css|scss|sass|less|styl))/gi,
      // Config files
      /[\s`'"]([\w\-\.]+\.(json|yaml|yml|toml))/gi,
      // Markdown
      /[\s`'"]([\w\-\/]+\.md)/gi,
      // Files in backticks (common in issue descriptions)
      /`([^`]+\.\w{2,5})`/g,
    ];

    const files = new Set();
    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        let path = match[1].replace(/^[`'"]+|[`'"]+$/g, '').trim();
        // Skip invalid paths
        if (path &&
          !path.startsWith('.') &&
          !path.includes('node_modules') &&
          !path.includes('://') &&
          path.length < 200) {
          files.add(path);
        }
      }
    }
    return [...files];
  }

  /**
   * Find files based on semantic matching of keywords
   * More intelligent than simple substring matching
   */
  findBySemanticMatch(issueText) {
    const results = [];
    const structure = this.context.structure;
    const keywords = this.extractKeywords(issueText);

    for (const item of structure) {
      if (item.type !== 'file') continue;
      if (item.size > CONFIG.maxFileSize) continue;

      let score = 0;
      const reasons = [];
      const pathLower = item.path.toLowerCase();
      const nameLower = item.name.toLowerCase();
      const nameWithoutExt = nameLower.replace(/\.\w+$/, '');

      // Check if file matches framework patterns
      for (const [type, pattern] of Object.entries(this.context.filePatterns || {})) {
        if (pattern.test(item.name)) {
          score += 5;
          break;
        }
      }

      // Check keyword matches with weighted scoring
      for (const keyword of keywords) {
        // Exact name match (highest weight)
        if (nameWithoutExt === keyword) {
          score += 50;
          reasons.push(`exact name: ${keyword}`);
        }
        // Name contains keyword
        else if (nameLower.includes(keyword)) {
          score += 30;
          reasons.push(`name contains: ${keyword}`);
        }
        // Path contains keyword (lower weight)
        else if (pathLower.includes(keyword)) {
          score += 15;
          reasons.push(`path contains: ${keyword}`);
        }
      }

      // Boost for convention directories
      for (const [key, dir] of Object.entries(this.context.conventions || {})) {
        if (item.path.startsWith(dir + '/')) {
          score += 5;
          break;
        }
      }

      if (score > 0) {
        results.push({
          path: item.path,
          score,
          reason: reasons.join(', ') || 'pattern match'
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 30);
  }

  /**
   * Find files based on project conventions
   */
  findByConventions(issueText) {
    const results = [];
    const textLower = issueText.toLowerCase();
    const conventions = this.context.conventions || {};

    // Map keywords to convention directories
    const keywordToConvention = {
      'component': ['componentDir'],
      'composable': ['composableDir'],
      'hook': ['hookDir', 'composableDir'],
      'view': ['viewDir', 'pageDir'],
      'page': ['pageDir', 'viewDir'],
      'type': ['typeDir'],
      'store': ['storeDir'],
      'service': ['serviceDir', 'sourceDir'],
      'util': ['utilDir', 'sourceDir'],
      'api': ['apiDir', 'sourceDir'],
    };

    for (const [keyword, convKeys] of Object.entries(keywordToConvention)) {
      if (textLower.includes(keyword)) {
        for (const convKey of convKeys) {
          const dir = conventions[convKey];
          if (dir) {
            // Find all files in this convention directory
            const filesInDir = this.context.structure
              .filter(item =>
                item.type === 'file' &&
                item.path.startsWith(dir + '/') &&
                item.size <= CONFIG.maxFileSize
              )
              .slice(0, 5);

            filesInDir.forEach(f => {
              results.push({ path: f.path, score: 20 });
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Extract meaningful keywords from issue text
   * Filters out common words and extracts technical terms
   */
  extractKeywords(text) {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
      'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
      'during', 'before', 'after', 'above', 'below', 'between', 'under',
      'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
      'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some',
      'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
      'very', 'just', 'and', 'but', 'or', 'if', 'because', 'while', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'what', 'which', 'who', 'when', 'issue', 'bug', 'fix', 'error', 'problem',
      'please', 'add', 'update', 'change', 'make', 'work', 'working', 'broken',
      'doesn', 'don', 'won', 'isn', 'aren', 'wasn', 'weren', 'hasn', 'haven',
      'hadn', 'doesn', 'didn', 'couldn', 'shouldn', 'wouldn', 'won', 'new',
      'like', 'want', 'need', 'get', 'got', 'see', 'try', 'use', 'using',
    ]);

    // Extract regular words
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s\-_]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));

    // Extract camelCase and PascalCase terms (e.g., useValidation, FormRenderer)
    const camelCaseTerms = text.match(/[a-z]+[A-Z][a-zA-Z]*/g) || [];

    // Extract hyphenated terms (e.g., form-renderer, base-button)
    const hyphenatedTerms = text.match(/[a-z]+-[a-z]+(?:-[a-z]+)*/gi) || [];

    // Extract snake_case terms
    const snakeCaseTerms = text.match(/[a-z]+_[a-z]+(?:_[a-z]+)*/gi) || [];

    const allTerms = [
      ...words,
      ...camelCaseTerms.map(t => t.toLowerCase()),
      ...hyphenatedTerms.map(t => t.toLowerCase().replace(/-/g, '')),
      ...snakeCaseTerms.map(t => t.toLowerCase().replace(/_/g, '')),
    ];

    return [...new Set(allTerms)];
  }

  /**
   * Use AI to suggest relevant files for complex issues
   * Fallback when other strategies don't find enough files
   */
  async aiAssistedDiscovery(issue, triage) {
    try {
      const ai = getAIClient();

      // Create compact structure summary (only source files)
      const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte'];
      const fileList = this.context.structure
        .filter(item =>
          item.type === 'file' &&
          sourceExtensions.some(ext => item.name.endsWith(ext))
        )
        .map(item => item.path)
        .slice(0, 150)
        .join('\n');

      const prompt = `Analyze this GitHub issue and identify the most relevant files to fix it.

Issue Title: ${issue.title}
Issue Description: ${(issue.body || '').slice(0, 800)}
Classification: ${triage.classification}
Framework: ${this.context.framework}

Available source files:
${fileList}

Instructions:
1. Identify 3-5 files most likely to need changes
2. Consider files that might import/depend on the affected code
3. Prefer specific component/module files over generic utility files

Return ONLY a valid JSON array of file paths. Example:
["src/components/Form.vue", "src/composables/useValidation.ts"]

JSON response:`;

      const response = await ai.generateText({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300
      });

      // Parse response - handle potential markdown wrapping
      let jsonText = response.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\s*$/g, '').trim();
      }

      const files = JSON.parse(jsonText);
      return Array.isArray(files) ? files.filter(f => typeof f === 'string') : [];
    } catch (error) {
      console.warn('[FileDiscovery] AI discovery failed:', error.message);
      return [];
    }
  }

  /**
   * Find related files by analyzing imports
   * Discovers dependencies that should be included for context
   */
  async findRelatedFiles(filePaths) {
    const relatedFiles = new Set();

    for (const filePath of filePaths) {
      try {
        const content = await this.fetchFileContent(filePath);
        if (!content) continue;

        // Extract imports using multiple patterns
        const importPatterns = [
          // ES6 imports: import X from 'path'
          /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g,
          // CommonJS: require('path')
          /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
          // Dynamic imports: import('path')
          /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
          // Vue/Svelte components: defineAsyncComponent
          /defineAsyncComponent\s*\(\s*\(\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        ];

        for (const pattern of importPatterns) {
          const matches = content.matchAll(pattern);
          for (const match of matches) {
            const importPath = match[1];

            // Skip external packages
            if (!importPath.startsWith('.') &&
              !importPath.startsWith('@/') &&
              !importPath.startsWith('~/') &&
              !importPath.startsWith('#')) {
              continue;
            }

            const resolvedPath = this.resolveImportPath(filePath, importPath);
            if (resolvedPath && !filePaths.includes(resolvedPath)) {
              relatedFiles.add(resolvedPath);
            }
          }
        }
      } catch (error) {
        // Ignore errors for individual files
      }
    }

    return [...relatedFiles];
  }

  /**
   * Resolve import path to actual file path
   */
  resolveImportPath(fromFile, importPath) {
    const fromDir = dirname(fromFile);
    let resolved;

    // Handle path aliases
    if (importPath.startsWith('@/') || importPath.startsWith('~/')) {
      resolved = importPath.replace(/^[@~]\//, 'src/');
    } else if (importPath.startsWith('#/')) {
      resolved = importPath.replace(/^#\//, '');
    } else if (importPath.startsWith('.')) {
      // Relative import
      resolved = join(fromDir, importPath).replace(/\\/g, '/');
      // Clean up path (remove ./ and resolve ../)
      resolved = resolved.replace(/\/\.\//g, '/');
    } else {
      return null; // External package
    }

    // Try common extensions
    const extensions = [
      '', '.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte',
      '/index.ts', '/index.tsx', '/index.js', '/index.jsx', '/index.vue'
    ];

    for (const ext of extensions) {
      const fullPath = resolved.endsWith(ext) || ext === '' ? resolved + ext : resolved + ext;
      const cleanPath = fullPath.replace(/\/+/g, '/');
      if (this.context.structure.some(item => item.path === cleanPath)) {
        return cleanPath;
      }
    }

    return null;
  }

  async fetchFileContent(filePath) {
    try {
      const { data } = await this.github.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: filePath,
        ref: this.ref
      });
      return Buffer.from(data.content, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }

  /**
   * Validate file existence and apply limits
   * Now token-aware: selects files that fit within budget
   */
  async validateAndLimit(candidates) {
    const validFiles = [];
    const tokenManager = new TokenManager();
    let totalSize = 0;

    // Sort candidates by estimated token cost (prefer smaller files first for better coverage)
    const candidatesWithSize = [];
    for (const path of candidates) {
      const fileInfo = this.context.structure.find(item => item.path === path);
      if (fileInfo && fileInfo.type === 'file') {
        candidatesWithSize.push({ path, size: fileInfo.size });
      }
    }

    // Sort: smaller files first (more files = better context coverage)
    candidatesWithSize.sort((a, b) => a.size - b.size);

    for (const { path, size } of candidatesWithSize) {
      if (validFiles.length >= CONFIG.maxFilesToFetch) break;
      if (totalSize >= CONFIG.maxTotalContext) break;

      // Estimate tokens for this file
      const estimatedTokens = Math.ceil(size * CONFIG.tokensPerChar);

      // Check if we can afford this file (or a compressed version)
      const remainingBudget = tokenManager.remaining();
      if (remainingBudget < 200) {
        console.log(`[FileDiscovery] Token budget exhausted (${tokenManager.summary()})`);
        break;
      }

      if (size <= CONFIG.maxFileSize) {
        validFiles.push(path);
        totalSize += size;
        tokenManager.consume(estimatedTokens);
      }
    }

    console.log(`[FileDiscovery] Token usage: ${tokenManager.summary()}`);
    return validFiles;
  }
}

/**
 * Prompt builder - constructs AI prompts dynamically based on context
 * TOKEN-OPTIMIZED: Uses concise, high-signal prompts
 * NOW INCLUDES: Specification context for architectural compliance
 */
class PromptBuilder {
  constructor(projectContext) {
    this.context = projectContext;
    this.tokenManager = new TokenManager();
  }

  buildFixPrompt(issue, triage, conventions, fileContents) {
    // Use ultra-compact prompt for GitHub Models
    if (CONFIG.maxInputTokens < 10000) {
      return this.buildCompactPrompt(issue, triage, fileContents);
    }
    return this.buildStandardPrompt(issue, triage, conventions, fileContents);
  }

  /**
   * Ultra-compact prompt for GitHub Models (8k limit)
   * ~400 tokens overhead, maximizes file content space
   * NOW INCLUDES: Critical architectural rules
   * 
   * SIMPLIFIED: Returns to original working format with architecture awareness
   */
  buildCompactPrompt(issue, triage, fileContents) {
    const fw = this.context.framework;
    const lang = this.context.language;

    // Framework-specific one-liner
    const fwHint = fw === 'Vue.js'
      ? 'Vue3 Composition API + <script setup> + TypeScript. NO Options API.'
      : fw === 'React'
        ? 'React hooks + TypeScript. Functional components only.'
        : `${fw} + ${lang}`;

    // Get architectural constraints (compact)
    const archRules = this.getCompactArchitecturalRules();

    // Process files with budget (reduce if we have arch rules)
    const archTokens = this.tokenManager.estimate(archRules);
    const fileTokenBudget = CONFIG.fileTokenBudget - 400 - archTokens;
    const filesSection = this.buildCompactFiles(fileContents, fileTokenBudget);

    // Compact issue description (max 300 chars)
    const issueDesc = (issue.body || '').slice(0, 300).replace(/\n+/g, ' ');

    // Check if files were truncated (marked with [partial])
    const hasPartialFiles = filesSection.includes('[partial]');

    // For simple text fixes with no partial files, use the simple original format
    // For complex changes or partial files, use search_replace format
    if (hasPartialFiles) {
      return `Fix #${issue.number}: ${issue.title}
${issueDesc}

${fwHint}
${archRules}

${filesSection}

⚠️ Some files were truncated. You MUST use search_replace format for targeted edits.

Return JSON:
{"file_changes":[{"path":"...","search_replace":[{"search":"exact text to find","replace":"replacement text"}],"change_summary":"..."}],"commit_message":"fix: ...\\n\\nFixes #${issue.number}"}

Rules:
- search must be EXACT text from file (copy-paste)
- Include enough context to uniquely match
- Never invent content you haven't seen`;
    }

    // Simple format for complete files - this is what WORKED before
    return `Fix #${issue.number}: ${issue.title}
${issueDesc}

${fwHint}
${archRules}

${filesSection}

Return JSON:
{"file_changes":[{"path":"...","content":"FULL file","change_summary":"..."}],"commit_message":"fix: ...\\n\\nFixes #${issue.number}"}

Rules: Fix root cause. Handle nulls/errors. Match existing style. Complete code only.`;
  }

  /**
   * Get compact architectural rules for token-limited prompts
   */
  getCompactArchitecturalRules() {
    const spec = this.context.specContext;
    if (!spec?.hasSpecs) return '';

    const rules = [];

    // Add critical data flow rules
    if (spec.dataFlow?.rules?.length > 0) {
      rules.push('ARCHITECTURE:');
      // Take top 3 most important rules
      spec.dataFlow.rules.slice(0, 3).forEach(r => {
        rules.push(`- ${r}`);
      });
    }

    // Add prohibited patterns (critical)
    if (spec.prohibitedPatterns?.length > 0) {
      rules.push('PROHIBITED:');
      spec.prohibitedPatterns.slice(0, 3).forEach(p => {
        rules.push(`- ${p.pattern}`);
      });
    }

    // Add component-specific rules
    if (spec.componentRules?.length > 0) {
      const baseRules = spec.componentRules.filter(r => r.type === 'base-component');
      if (baseRules.length > 0) {
        rules.push('BASE COMPONENTS: Presentational only, NO data fetching, NO business logic');
      }

      const composableRules = spec.componentRules.filter(r => r.type === 'composable');
      if (composableRules.length > 0) {
        rules.push('COMPOSABLES: Handle data fetching, state management, business logic');
      }
    }

    return rules.join('\n');
  }

  /**
   * Build compact file section
   */
  buildCompactFiles(fileContents, tokenBudget) {
    if (!fileContents?.length) return 'NO FILES';

    const files = [];
    let budget = tokenBudget;
    const tm = new TokenManager();

    for (const fc of fileContents) {
      if (budget < 150) break;

      const tokens = tm.estimate(fc.content);
      if (tokens <= budget) {
        files.push(`### ${fc.path}\n\`\`\`\n${fc.content}\n\`\`\``);
        budget -= tokens;
      } else {
        // Compress large files
        const compressed = ContentCompressor.compress(fc.content, fc.path, budget, tm);
        if (compressed.tokens > 100) {
          files.push(`### ${fc.path} [partial]\n\`\`\`\n${compressed.content}\n\`\`\``);
          budget -= compressed.tokens;
        }
      }
    }

    return files.join('\n\n') || 'NO FILES FIT BUDGET';
  }

  /**
   * Standard prompt for larger context windows (Anthropic/OpenAI)
   * INCLUDES: Full architectural context from specification documents
   */
  buildStandardPrompt(issue, triage, conventions, fileContents) {
    // Get architectural context
    const archContext = this.buildArchitecturalContext();
    const archTokens = this.tokenManager.estimate(archContext);

    const fileTokenBudget = CONFIG.fileTokenBudget - 800 - archTokens;
    const filesSection = this.buildFileContents(fileContents, fileTokenBudget);

    return `# Fix GitHub Issue #${issue.number}

## Task
${issue.title}

${(issue.body || 'No description').slice(0, 1000)}

## Context
- **Stack**: ${this.context.framework} + ${this.context.language}
- **Type**: ${triage.classification} | **Risk**: ${triage.risk}
${this.getFrameworkRules()}

${archContext}

${filesSection}

## Output Format

Choose the appropriate format based on the fix type:

### Option 1: Full File Replacement (for new files or complete rewrites)
\`\`\`json
{
  "file_changes": [
    {
      "path": "path/to/file",
      "content": "COMPLETE file content - all lines",
      "change_summary": "What changed and why"
    }
  ],
  "commit_message": "type(scope): description\\n\\nFixes #${issue.number}"
}
\`\`\`

### Option 2: Search/Replace (PREFERRED for typos, single-line fixes, targeted edits)
\`\`\`json
{
  "file_changes": [
    {
      "path": "path/to/file",
      "search_replace": [
        {"search": "exact text to find", "replace": "replacement text"}
      ],
      "change_summary": "What changed and why"
    }
  ],
  "commit_message": "type(scope): description\\n\\nFixes #${issue.number}"
}
\`\`\`

## CRITICAL Rules
- For typo fixes, use search_replace with EXACT text from the file
- If file content was truncated/partial, you MUST use search_replace
- NEVER invent or hallucinate file content you haven't seen
- search text must match EXACTLY (including whitespace)
- Root cause fixed (not just symptoms)
- Matches existing code style
- **FOLLOWS PROJECT ARCHITECTURE** (see rules above)`;
  }

  /**
   * Build comprehensive architectural context from spec documents
   * This is the KEY improvement - AI now understands project design patterns
   */
  buildArchitecturalContext() {
    const spec = this.context.specContext;
    if (!spec?.hasSpecs) {
      return '## Project Architecture\nNo specification documents found. Follow standard patterns.';
    }

    const sections = ['## Project Architecture (from specs)\n'];
    sections.push('**⚠️ CRITICAL: Follow these architectural rules. Violations will be rejected.**\n');

    // Data Flow / Layer Architecture
    if (spec.dataFlow?.rules?.length > 0) {
      sections.push('### Data Flow & Layered Architecture');
      sections.push('This project follows a strict layered architecture:\n');
      spec.dataFlow.rules.forEach(rule => {
        sections.push(`- ${rule}`);
      });
      sections.push('');
    }

    // Component Rules
    if (spec.componentRules?.length > 0) {
      sections.push('### Component Responsibilities');

      const baseRules = spec.componentRules.filter(r => r.type === 'base-component');
      if (baseRules.length > 0) {
        sections.push('\n**Base Components** (`src/components/base/`):');
        sections.push('- Are **dumb/presentational** components');
        sections.push('- Receive ALL data via props');
        sections.push('- Emit events for parent handling');
        sections.push('- **DO NOT** fetch data or contain business logic');
        sections.push('- **DO NOT** import services or composables that fetch data');
      }

      const composableRules = spec.componentRules.filter(r => r.type === 'composable');
      if (composableRules.length > 0) {
        sections.push('\n**Composables** (`src/composables/`):');
        sections.push('- Handle data fetching (useDataSource, etc.)');
        sections.push('- Manage complex state and business logic');
        sections.push('- Are used by orchestrator components (FormRenderer)');
      }

      const orchestratorRules = spec.componentRules.filter(r => r.type === 'orchestrator');
      if (orchestratorRules.length > 0) {
        sections.push('\n**Orchestrator Components** (FormRenderer, etc.):');
        sections.push('- Coordinate between composables and base components');
        sections.push('- Pass data from composables down to base components');
        sections.push('- Handle form submission, validation coordination');
      }
      sections.push('');
    }

    // Prohibited Patterns
    if (spec.prohibitedPatterns?.length > 0) {
      sections.push('### ❌ PROHIBITED (Never Do)');
      spec.prohibitedPatterns.forEach(p => {
        sections.push(`- ${p.pattern}`);
      });
      sections.push('');
    }

    // Required Patterns
    if (spec.requiredPatterns?.length > 0) {
      sections.push('### ✓ REQUIRED (Always Do)');
      spec.requiredPatterns.forEach(p => {
        sections.push(`- ${p.pattern}`);
      });
      sections.push('');
    }

    // Add specific guidance for this project type
    sections.push('### Fix Guidelines');
    sections.push('When fixing issues in this project:');
    sections.push('1. **Identify the correct layer** - Is this a UI issue (base component) or data issue (composable/service)?');
    sections.push('2. **Base components**: Only fix styling, props handling, event emission, accessibility');
    sections.push('3. **Data issues**: Fix in composables (useDataSource, useFormValidation) or services');
    sections.push('4. **Config issues**: Fix in config files (samples/, types/)');
    sections.push('5. **Never add data fetching to base components**');
    sections.push('');

    return sections.join('\n');
  }

  /**
   * Get framework-specific rules (compact)
   */
  getFrameworkRules() {
    const { framework } = this.context;

    const rules = {
      'Vue.js': `**Vue Rules**: Composition API + \`<script setup>\`. Use \`ref()\`, \`computed()\`, \`defineProps<T>()\`, \`defineEmits<T>()\`. NO Options API.`,
      'React': `**React Rules**: Functional components + hooks. Proper deps arrays. NO class components.`,
      'Angular': `**Angular Rules**: Follow style guide. Use standalone components. Proper DI.`,
      'Svelte': `**Svelte Rules**: Svelte 4/5 syntax. Reactive \`$:\` statements.`,
      'Node.js': `**Node Rules**: async/await. Proper error handling. ES modules.`
    };

    return rules[framework] || '';
  }

  buildFileContents(fileContents, tokenBudget) {
    if (!fileContents || fileContents.length === 0) {
      return '## Files\nNo files provided';
    }

    const processedFiles = [];
    let remainingBudget = tokenBudget;
    const tempTokenManager = new TokenManager();

    for (const fc of fileContents) {
      if (remainingBudget < 200) break;

      const fullTokens = tempTokenManager.estimate(fc.content);

      if (fullTokens <= remainingBudget) {
        processedFiles.push({ path: fc.path, content: fc.content, tokens: fullTokens });
        remainingBudget -= fullTokens;
      } else {
        const allocatedBudget = Math.min(remainingBudget, Math.floor(tokenBudget / fileContents.length));
        const compressed = ContentCompressor.compress(fc.content, fc.path, allocatedBudget, tempTokenManager);

        if (compressed.tokens > 100) {
          processedFiles.push({ path: fc.path, content: compressed.content, tokens: compressed.tokens, partial: true });
          remainingBudget -= compressed.tokens;
        }
      }
    }

    const formatted = processedFiles.map(pf => {
      const ext = this.getLanguageForExtension(pf.path);
      const note = pf.partial ? ' [partial]' : '';
      return `### ${pf.path}${note}\n\`\`\`${ext}\n${pf.content}\n\`\`\``;
    }).join('\n\n');

    return `## Files (${processedFiles.length}/${fileContents.length})\n${formatted}`;
  }

  getLanguageForExtension(filePath) {
    const ext = extname(filePath).slice(1);
    return { vue: 'vue', ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx', css: 'css', scss: 'scss', json: 'json' }[ext] || ext;
  }
}

/**
 * Security validator - comprehensive security checks
 * Blocks modifications to sensitive files
 */
class SecurityValidator {
  static CRITICAL_PATTERNS = [
    { pattern: /^\.env/, reason: 'Environment configuration file' },
    { pattern: /\.env$/, reason: 'Environment configuration file' },
    { pattern: /\.env\./, reason: 'Environment configuration file' },
    { pattern: /config\/secrets\//, reason: 'Secrets directory' },
    { pattern: /secrets?\.(json|yaml|yml|ts|js)$/, reason: 'Secrets file' },
    { pattern: /\.pem$/, reason: 'Private key file' },
    { pattern: /\.key$/, reason: 'Private key file' },
    { pattern: /\.crt$/, reason: 'Certificate file' },
    { pattern: /id_rsa/, reason: 'SSH private key' },
    { pattern: /\.github\/workflows\//, reason: 'CI/CD workflow' },
    { pattern: /deployment\//, reason: 'Deployment config' },
    { pattern: /docker-compose\.prod/, reason: 'Production infrastructure' },
    { pattern: /kubernetes\//, reason: 'Kubernetes config' },
    { pattern: /k8s\//, reason: 'Kubernetes config' },
    { pattern: /terraform\//, reason: 'Infrastructure as Code' },
    { pattern: /\.tf$/, reason: 'Terraform file' },
    { pattern: /ansible\//, reason: 'Ansible config' },
    { pattern: /vault/, reason: 'Vault config' },
    { pattern: /credentials/, reason: 'Credentials file' },
    { pattern: /\.aws\//, reason: 'AWS config' },
    { pattern: /\.kube\//, reason: 'Kubernetes config' },
  ];

  static BLOCKED_CHANGE_TYPES = [
    'DATABASE_MIGRATION',
    'CI_CD_PIPELINE',
    'INFRASTRUCTURE_CONFIG'
  ];

  static validate(affectedFiles, issueTitle = '', issueBody = '') {
    const violations = [];

    for (const filePath of affectedFiles) {
      // Check shared security constraints
      const fileMatches = checkSecurityFilePath(filePath);
      if (fileMatches.length > 0) {
        violations.push({
          path: filePath,
          reason: 'Security-sensitive file path',
          patterns: fileMatches.map(m => m.pattern.source),
        });
      }

      // Check critical patterns
      for (const { pattern, reason } of this.CRITICAL_PATTERNS) {
        if (pattern.test(filePath)) {
          violations.push({ path: filePath, reason, pattern: pattern.source });
          break; // One violation per file is enough
        }
      }
    }

    // Check risky change types
    const riskyChanges = checkRiskyChangeTypes(
      `${issueTitle} ${issueBody}`,
      affectedFiles
    );

    for (const riskyChange of riskyChanges) {
      if (this.BLOCKED_CHANGE_TYPES.includes(riskyChange.type)) {
        violations.push({
          path: 'multiple',
          reason: `${riskyChange.type}: ${riskyChange.reason}`,
          type: riskyChange.type,
        });
      }
    }

    return violations;
  }
}

/**
 * Architecture validator - uses modular validation system
 * Validates code changes against architectural rules from specifications
 * 
 * This is a facade over the modular architecture-validator.js module
 * for backward compatibility with existing code.
 */
class ArchitectureValidator {
  /**
   * Validate that proposed file changes follow project architecture
   * Uses the modular validator from shared/architecture-validator.js
   * 
   * @param {Array} fileChanges Array of {path, content} objects
   * @param {Object} specContext Parsed specification context
   * @returns {Array} Array of violations
   */
  static async validate(fileChanges, specContext) {
    if (!specContext?.hasSpecs) {
      // No specs to validate against
      return [];
    }

    try {
      // Create and initialize the modular validator
      const validator = createValidator();

      // Detect framework from specContext
      const framework = specContext.techStack?.find(t => /vue|react|angular|svelte/i.test(t)) || 'generic';

      // Create rules registry from specs
      const rulesRegistry = createDefaultRegistry(framework);
      rulesRegistry.generateFromSpecs(specContext);

      // Initialize validator with context
      await validator.initialize({
        specContext,
        rulesRegistry,
        projectContext: { framework }
      });

      // Prepare files for validation
      const files = fileChanges.map(change => ({
        path: change.path,
        content: change.content || '',
      }));

      // Run validation
      const result = await validator.validateFiles(files, { specContext });

      // Convert ValidationResult to array of violations for backward compatibility
      const violations = [];

      for (const v of result.violations) {
        violations.push({
          path: v.path,
          type: 'ARCHITECTURE_VIOLATION',
          severity: 'ERROR',
          reason: v.message || v.ruleName,
          detail: v.message,
          suggestion: v.suggestion || 'Review the project architecture documentation.',
          ruleId: v.ruleId,
        });
      }

      for (const w of result.warnings) {
        violations.push({
          path: w.path,
          type: 'ARCHITECTURE_WARNING',
          severity: 'WARNING',
          reason: w.message || w.ruleName,
          detail: w.message,
          suggestion: w.suggestion,
          ruleId: w.ruleId,
        });
      }

      return violations;
    } catch (error) {
      console.warn('[ArchitectureValidator] Validation error:', error.message);
      // Return empty on error to not block the process
      return [];
    }
  }

  /**
   * Format violations for display (markdown)
   * Uses the modular ValidationResult.toMarkdown() when available
   */
  static formatViolations(violations) {
    if (violations.length === 0) return '';

    const lines = ['## ⚠️ Architecture Violations Detected\n'];
    lines.push('The proposed changes violate the project\'s architectural rules:\n');

    const errors = violations.filter(v => v.severity === 'ERROR');
    const warnings = violations.filter(v => v.severity === 'WARNING');

    if (errors.length > 0) {
      lines.push('### ❌ Errors (blocking)\n');
      for (const v of errors) {
        lines.push(`**${v.reason}**`);
        lines.push(`- **File**: \`${v.path}\``);
        if (v.detail && v.detail !== v.reason) {
          lines.push(`- **Detail**: ${v.detail}`);
        }
        lines.push(`- **Suggestion**: ${v.suggestion}`);
        lines.push('');
      }
    }

    if (warnings.length > 0) {
      lines.push('<details><summary>⚠️ Warnings (non-blocking)</summary>\n');
      for (const v of warnings) {
        lines.push(`- \`${v.path}\`: ${v.reason}`);
      }
      lines.push('\n</details>\n');
    }

    lines.push('---');
    lines.push('**Action Required**: Please modify the fix to follow the project architecture.');
    lines.push('See spec documents in `specs/` directory for architectural guidelines.');

    return lines.join('\n');
  }
}

/**
 * Validation runner - executes project validation commands
 */
class ValidationRunner {
  static selectCommands(risk, affectedFiles, conventions) {
    const commands = [];

    if (conventions.lint_command) {
      commands.push(conventions.lint_command);
    }

    const needsTypeCheck = affectedFiles.some(f =>
      f.endsWith('.ts') || f.endsWith('.vue') || f.endsWith('.tsx')
    );
    if (needsTypeCheck && conventions.type_check_command) {
      commands.push(conventions.type_check_command);
    }

    if ((risk === 'MEDIUM' || risk === 'HIGH') && conventions.build_command) {
      commands.push(conventions.build_command);
    }

    // Filter out test commands (NO TESTING policy)
    return commands.filter(c => !c.toLowerCase().includes('test'));
  }

  static async run(commands) {
    const results = [];

    for (const command of commands) {
      console.log(`[Validation] Running: ${command}`);
      const startTime = Date.now();

      try {
        const output = execSync(command, {
          stdio: 'pipe',
          encoding: 'utf8',
          timeout: 90000,
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });

        const duration = Date.now() - startTime;
        results.push({
          command,
          exit_code: 0,
          stdout: output.slice(0, 2000),
          stderr: '',
          duration_ms: duration
        });

        console.log(`[Validation] ✓ ${command} passed (${duration}ms)`);
      } catch (error) {
        const duration = Date.now() - startTime;
        results.push({
          command,
          exit_code: error.status || 1,
          stdout: error.stdout?.slice(0, 2000) || '',
          stderr: error.stderr?.slice(0, 2000) || error.message,
          duration_ms: duration
        });

        throw new AutoFixError('VALIDATION_FAILED', `Validation failed: ${command}`, {
          validation_results: results,
          output: error.stderr?.toString() || error.message
        });
      }
    }

    return results;
  }
}

// ============================================================================
// MAIN AGENT CLASS
// ============================================================================

class AutoFixAgent {
  constructor() {
    this.github = getGitHubClient();
    this.ai = getAIClient();
    this.startTime = Date.now();
  }

  async run() {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    const issueNumber = parseInt(CONFIG.issueNumber, 10);

    console.log(`[Auto-Fix] Starting for issue #${issueNumber}`);

    // Load triage result
    const triage = this.loadTriageResult();

    // Validate auto-fix decision
    if (triage.autoFixDecision !== 'AUTO_FIX' && triage.autoFixDecision !== 'DRAFT_PR') {
      throw new AutoFixError('NOT_AUTO_FIX', `Auto-fix not approved: ${triage.autoFixDecision}`);
    }

    // Fetch issue details
    const { data: issue } = await this.github.rest.issues.get({
      owner, repo, issue_number: issueNumber
    });

    console.log(`[Auto-Fix] Processing: ${issue.title}`);
    console.log(`[Auto-Fix] Classification: ${triage.classification}, Risk: ${triage.risk}`);

    // Security pre-check
    const violations = SecurityValidator.validate(
      triage.affectedFiles || [],
      issue.title,
      issue.body || ''
    );

    if (violations.length > 0) {
      console.error('[Auto-Fix] ⛔ Security violations:');
      violations.forEach(v => console.error(`  - ${v.path}: ${v.reason}`));
      throw new AutoFixError('SECURITY_VIOLATION',
        `Blocked: ${violations.length} security violation(s)`,
        { violations }
      );
    }

    // Change to repo root
    const repoRoot = join(__dirname, '..', '..');
    process.chdir(repoRoot);
    console.log('[Auto-Fix] Working directory: repo root');

    // Analyze project (dynamic discovery)
    const analyzer = new ProjectAnalyzer(this.github, owner, repo, CONFIG.defaultBranch);
    const projectContext = await analyzer.analyze();
    console.log(`[Auto-Fix] Project: ${projectContext.framework} (${projectContext.language})`);

    // Discover relevant files (dynamic, no hardcoded mappings)
    const discovery = new FileDiscovery(projectContext, this.github, owner, repo, CONFIG.defaultBranch);
    const filesToFetch = await discovery.findRelevantFiles(issue, triage);

    if (filesToFetch.length === 0) {
      throw new AutoFixError('NO_FILES_FOUND', 'Could not identify files to modify');
    }

    console.log(`[Auto-Fix] Files: ${filesToFetch.join(', ')}`);

    // Fetch file contents
    const fileContents = await this.fetchFiles(owner, repo, filesToFetch);
    console.log(`[Auto-Fix] Fetched ${fileContents.length} files`);

    // Generate branch name
    const branchName = this.generateBranchName(issue.number, triage.classification, issue.title);
    console.log(`[Auto-Fix] Branch: ${branchName}`);

    // Create branch
    await this.createBranch(branchName);

    // Load conventions
    const conventions = await this.loadConventions(owner, repo);

    // Build prompt and generate fix
    const promptBuilder = new PromptBuilder(projectContext);
    const prompt = promptBuilder.buildFixPrompt(issue, triage, conventions, fileContents);

    console.log('[Auto-Fix] Generating fix with AI...');
    const { fileChanges, commitMessage } = await this.generateFix(prompt);
    console.log(`[Auto-Fix] Generated ${fileChanges.length} file changes`);

    // NEW: Validate changes against project architecture using modular validator
    console.log('[Auto-Fix] Validating against project architecture...');
    const archViolations = await ArchitectureValidator.validate(fileChanges, projectContext.specContext);

    if (archViolations.length > 0) {
      const errorViolations = archViolations.filter(v => v.severity === 'ERROR');

      if (errorViolations.length > 0) {
        console.error('[Auto-Fix] ⛔ Architecture violations detected:');
        errorViolations.forEach(v => console.error(`  - ${v.path}: ${v.reason}`));

        throw new AutoFixError('ARCHITECTURE_VIOLATION',
          `Fix violates project architecture: ${errorViolations[0].reason}`,
          {
            violations: archViolations,
            formattedMessage: ArchitectureValidator.formatViolations(archViolations)
          }
        );
      } else {
        // Warnings only - log but continue
        console.warn('[Auto-Fix] ⚠️ Architecture warnings (non-blocking):');
        archViolations.forEach(v => console.warn(`  - ${v.path}: ${v.reason}`));
      }
    } else {
      console.log('[Auto-Fix] ✓ Architecture validation passed');
    }

    // Apply changes using modular handler
    console.log(`[Auto-Fix] Applying ${fileChanges.length} file changes...`);
    const changeResults = await this.applyFileChanges(fileChanges);
    console.log(`[Auto-Fix] ✓ Applied ${changeResults.successful} changes`);

    // Run validation
    const validationCommands = ValidationRunner.selectCommands(
      triage.risk,
      fileChanges.map(fc => fc.path),
      conventions
    );

    let validationResults = [];
    if (validationCommands.length > 0) {
      validationResults = await ValidationRunner.run(validationCommands);
      console.log('[Auto-Fix] ✓ All validations passed');
    } else {
      console.log('[Auto-Fix] No validation commands configured');
    }

    // Commit and push
    const commitSha = await this.commitAndPush(
      fileChanges.map(fc => fc.path),
      commitMessage,
      branchName
    );

    return {
      success: true,
      data: [{
        issue_number: issue.number,
        branch_name: branchName,
        message: commitMessage,
        files_changed: fileChanges.map(fc => fc.path),
        change_summaries: fileChanges.map(fc => ({
          path: fc.path,
          summary: fc.change_summary || 'Updated'
        })),
        timestamp: new Date().toISOString(),
        validation_results: validationResults,
        sha: commitSha
      }]
    };
  }

  loadTriageResult() {
    const triageResultPath = join(__dirname, CONFIG.triageResultPath);
    const triageResult = JSON.parse(readFileSync(triageResultPath, 'utf8'));

    if (!triageResult.success) {
      throw new AutoFixError('INVALID_INPUT', 'Triage result indicates failure');
    }

    return triageResult.data;
  }

  async fetchFiles(owner, repo, filePaths) {
    const results = [];

    // Fetch files in parallel for efficiency
    const fetchPromises = filePaths.map(async (path) => {
      try {
        const { data } = await this.github.rest.repos.getContent({
          owner, repo, path, ref: CONFIG.defaultBranch
        });

        if (data.type === 'file') {
          return {
            path,
            content: Buffer.from(data.content, 'base64').toString('utf8')
          };
        }
        return null;
      } catch (error) {
        if (error.status === 404) {
          return { path, content: '' }; // New file
        }
        console.warn(`[Auto-Fix] Failed to fetch ${path}:`, error.message);
        return null;
      }
    });

    const fetchResults = await Promise.all(fetchPromises);
    return fetchResults.filter(r => r !== null);
  }

  generateBranchName(issueNumber, classification, title) {
    const prefixMap = {
      BUG: 'fix', FEATURE: 'feature', DOCS: 'docs', CHORE: 'chore', OTHER: 'fix'
    };

    const prefix = prefixMap[classification] || 'fix';
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join('-')
      .substring(0, 50);

    return `${prefix}/${issueNumber}-${slug}`;
  }

  async createBranch(branchName) {
    try {
      gitOps.checkoutBranch(process.cwd(), branchName);
      console.log(`[Auto-Fix] Branch exists, checked out: ${branchName}`);
    } catch {
      console.log(`[Auto-Fix] Creating branch: ${branchName}`);
      gitOps.createBranch(process.cwd(), branchName, CONFIG.defaultBranch);
    }
  }

  async loadConventions(owner, repo) {
    const conventions = {
      indent_style: 'space',
      indent_size: 2,
      end_of_line: 'lf',
      insert_final_newline: true,
      lint_command: null,
      type_check_command: null,
      build_command: null
    };

    try {
      const { data } = await this.github.rest.repos.getContent({
        owner, repo, path: 'package.json'
      });
      const pkg = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));

      if (pkg.scripts) {
        if (pkg.scripts.lint) conventions.lint_command = 'npm run lint';
        if (pkg.scripts['lint:fix']) conventions.lint_command = 'npm run lint:fix';
        if (pkg.scripts['type-check']) conventions.type_check_command = 'npm run type-check';
        if (pkg.scripts.typecheck) conventions.type_check_command = 'npm run typecheck';
        if (pkg.scripts.build) conventions.build_command = 'npm run build';
      }
    } catch {
      console.log('[Auto-Fix] Using default conventions');
    }

    try {
      const { data } = await this.github.rest.repos.getContent({
        owner, repo, path: '.editorconfig'
      });
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      if (content.includes('indent_style = tab')) conventions.indent_style = 'tab';
      const sizeMatch = content.match(/indent_size\s*=\s*(\d+)/);
      if (sizeMatch) conventions.indent_size = parseInt(sizeMatch[1], 10);
    } catch {
      // Use defaults
    }

    return conventions;
  }

  async generateFix(prompt) {
    const response = await this.ai.generateText({
      messages: [{ role: 'user', content: prompt }],
      temperature: CONFIG.temperature,
      max_tokens: CONFIG.maxOutputTokens // Use provider-specific output limit
    });

    // Clean up response
    let jsonText = response.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\s*$/g, '').trim();
    }

    let result;
    try {
      result = JSON.parse(jsonText);
    } catch (error) {
      throw new AutoFixError('INVALID_AI_OUTPUT', 'Failed to parse AI response', {
        response: response.slice(0, 500)
      });
    }

    if (!Array.isArray(result.file_changes) || result.file_changes.length === 0) {
      throw new AutoFixError('INVALID_AI_OUTPUT', 'Missing file_changes array');
    }

    if (!result.commit_message) {
      throw new AutoFixError('INVALID_AI_OUTPUT', 'Missing commit_message');
    }

    return {
      fileChanges: result.file_changes,
      commitMessage: result.commit_message
    };
  }

  /**
   * Apply file changes using the modular FileChangeHandler
   * Supports multiple change strategies: search_replace, full content, insert, patch
   * 
   * @param {Array} fileChanges Array of change objects
   * @returns {Object} Summary of applied changes
   */
  async applyFileChanges(fileChanges) {
    const handler = createFileChangeHandler({
      validateBeforeApply: true,
      allowHallucination: false,
    });

    const summary = await handler.applyChanges(fileChanges);

    // Check for failures
    if (summary.failed > 0) {
      const failedResults = summary.results.filter(r => !r.success);
      const firstError = failedResults[0];

      throw new AutoFixError(
        firstError.errorCode || 'FILE_CHANGE_FAILED',
        `Failed to apply ${summary.failed} file change(s): ${firstError.errors.join(', ')}`,
        {
          failed: failedResults.map(r => ({ path: r.path, errors: r.errors })),
          successful: summary.successful,
          total: summary.total,
        }
      );
    }

    return summary;
  }

  /**
   * Legacy method for backward compatibility
   * Delegates to the modular handler
   */
  async applyFileChange(change) {
    const handler = createFileChangeHandler({
      validateBeforeApply: true,
      allowHallucination: false,
    });

    const result = await handler.applyChange(change);

    if (!result.success) {
      throw new AutoFixError(
        result.errorCode || 'FILE_CHANGE_FAILED',
        result.errors.join(', '),
        result.errorDetails
      );
    }

    return result;
  }

  async commitAndPush(filePaths, message, branchName) {
    gitOps.stageFiles(process.cwd(), filePaths);
    const sha = gitOps.createCommit(process.cwd(), message);
    console.log(`[Auto-Fix] Commit: ${sha}`);

    gitOps.pushBranch(process.cwd(), branchName);
    console.log(`[Auto-Fix] ✓ Pushed: ${branchName}`);

    return sha;
  }

  async rollback() {
    console.log('[Auto-Fix] Rolling back...');
    try {
      execSync('git reset --hard HEAD', { stdio: 'pipe' });
      execSync(`git checkout ${CONFIG.defaultBranch}`, { stdio: 'pipe' });
      console.log('[Auto-Fix] ✓ Rollback complete');
    } catch (error) {
      console.error('[Auto-Fix] Rollback failed:', error.message);
    }
  }

  async postErrorComment(error) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    const issueNumber = parseInt(CONFIG.issueNumber, 10);

    let comment = `## ❌ Auto-Fix Failed\n\n**Error**: ${error.message}\n\n`;

    if (error.code === 'VALIDATION_FAILED') {
      comment += `### Validation Failure\n\n`;
      comment += `The fix failed validation checks:\n\n`;
      if (error.details?.output) {
        comment += `\`\`\`\n${error.details.output.slice(0, 1500)}\n\`\`\`\n\n`;
      }
      comment += `**Next Steps**: Review error and implement manually.\n`;
    } else if (error.code === 'SECURITY_VIOLATION') {
      comment += `### Security Block\n\n`;
      comment += `This issue affects security-sensitive files.\n\n`;
      if (error.details?.violations) {
        comment += `**Violations**:\n`;
        error.details.violations.slice(0, 5).forEach(v => {
          comment += `- \`${v.path}\`: ${v.reason}\n`;
        });
      }
      comment += `\n**Action Required**: Manual implementation needed.\n`;
    } else if (error.code === 'ARCHITECTURE_VIOLATION') {
      // NEW: Handle architecture violations with detailed explanation
      comment += `### ⚠️ Architecture Violation\n\n`;
      comment += `The generated fix violates this project's architectural rules.\n\n`;

      if (error.details?.formattedMessage) {
        comment += error.details.formattedMessage + '\n\n';
      } else if (error.details?.violations) {
        comment += `**Violations Found**:\n`;
        error.details.violations.slice(0, 5).forEach(v => {
          comment += `\n**${v.severity}**: ${v.reason}\n`;
          comment += `- File: \`${v.path}\`\n`;
          comment += `- Detail: ${v.detail}\n`;
          comment += `- Suggestion: ${v.suggestion}\n`;
        });
      }

      comment += `\n### Project Architecture Rules\n\n`;
      comment += `This project follows a layered architecture:\n`;
      comment += `- **Base Components** (\`src/components/base/\`): Presentational only, NO data fetching\n`;
      comment += `- **Composables** (\`src/composables/\`): Handle data fetching, state management\n`;
      comment += `- **Orchestrators** (FormRenderer): Coordinate between layers\n\n`;
      comment += `**Action Required**: Fix must be implemented manually following the architecture.\n`;
      comment += `See \`specs/001-form-config-generator/plan.md\` for full architecture details.\n`;
    } else if (error.code === 'NO_FILES_FOUND') {
      comment += `### No Files Identified\n\n`;
      comment += `Could not determine which files to modify.\n\n`;
      comment += `**Tip**: Mention specific file paths in the issue description.\n`;
    } else {
      comment += `**Error Code**: \`${error.code || 'UNKNOWN'}\`\n\n`;
      comment += `Manual intervention required.\n`;
    }

    await this.github.rest.issues.createComment({
      owner, repo, issue_number: issueNumber, body: comment
    });

    // Add appropriate labels
    const labels = ['automation-failed'];
    if (error.code === 'ARCHITECTURE_VIOLATION') {
      labels.push('architecture-review');
    }

    await this.github.rest.issues.addLabels({
      owner, repo, issue_number: issueNumber, labels
    });
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

async function main() {
  const startTime = Date.now();
  const outputPath = join(__dirname, CONFIG.outputPath);
  const agent = new AutoFixAgent();

  try {
    // Set timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new AutoFixError('TIMEOUT', 'Auto-fix timeout exceeded')), CONFIG.timeoutMs);
    });

    const result = await Promise.race([agent.run(), timeoutPromise]);

    writeFileSync(outputPath, JSON.stringify(result, null, 2));

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Auto-Fix] ✓ Completed in ${duration}s`);
    process.exit(0);

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[Auto-Fix] ✗ Failed after ${duration}s:`, error.message);

    try {
      await agent.rollback();
    } catch (rollbackError) {
      console.error('[Auto-Fix] Rollback failed:', rollbackError.message);
    }

    try {
      await agent.postErrorComment(error);
    } catch (commentError) {
      console.error('[Auto-Fix] Failed to post error:', commentError.message);
    }

    const errorResult = {
      success: false,
      error: {
        code: error.code || 'AUTO_FIX_FAILED',
        message: error.message,
        details: error.details || {},
        recoverable: false
      }
    };

    writeFileSync(outputPath, JSON.stringify(errorResult, null, 2));
    process.exit(1);
  }
}

main().catch(error => {
  console.error('[Auto-Fix] Unhandled error:', error);
  process.exit(1);
});
