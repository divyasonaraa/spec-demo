#!/usr/bin/env node

/**
 * Auto-Fix Agent - Production-grade automated code fix system
 * 
 * Architecture:
 * - Dynamic file discovery (no hardcoded mappings)
 * - AI-powered file inference using repository analysis
 * - Scalable design with pluggable components
 * - Comprehensive error handling and recovery
 * 
 * Input: TriageResult from triage agent
 * Output: Commit[] with diffs, validation results, commit SHAs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { getGitHubClient } from './shared/github-client.js';
import { getAIClient } from './shared/ai-client.js';
import { AutoFixError } from './shared/error-handler.js';
import * as gitOps from './shared/git-operations.js';
import { checkSecurityFilePath, checkRiskyChangeTypes } from './shared/security-constraints.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// CONFIGURATION - Centralized & Environment-driven
// ============================================================================

const CONFIG = Object.freeze({
  // Environment
  issueNumber: process.env.ISSUE_NUMBER,
  triageResultPath: process.env.TRIAGE_RESULT_PATH || './triage-result.json',
  outputPath: process.env.OUTPUT_PATH || './commit-result.json',
  timeoutMs: parseInt(process.env.TIMEOUT_MS || '120000', 10),
  defaultBranch: process.env.DEFAULT_BRANCH || 'main',

  // Limits - Configurable thresholds
  maxFilesToFetch: parseInt(process.env.MAX_FILES || '10', 10),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '100000', 10), // 100KB per file
  maxTotalContext: parseInt(process.env.MAX_CONTEXT || '500000', 10), // 500KB total
  maxTokens: parseInt(process.env.MAX_TOKENS || '8000', 10),

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
 * Framework detector registry - easily extensible
 * Add new frameworks by appending to this array
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
    promptAdditions: `
**Vue.js Specific Requirements**:
- Use Vue 3 Composition API with <script setup> syntax
- Use TypeScript for type safety in .vue and .ts files
- Follow Vue 3 best practices (reactive refs, computed, watch patterns)
- Props should have TypeScript interfaces defined
- Emits should be explicitly declared with defineEmits<>()
- Use provide/inject for dependency injection when appropriate
- DO NOT use Options API (no data(), methods, computed as object)
- DO NOT create React components (no useState, useEffect, jsx/tsx syntax)
- Handle reactivity properly (use .value for refs, avoid losing reactivity)`,
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
    promptAdditions: `
**React Specific Requirements**:
- Use functional components with hooks (no class components)
- Follow React best practices (proper hook dependencies, memoization)
- Use TypeScript for prop types and state
- DO NOT create Vue components (no <template>, no ref(), no reactive())`,
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
    promptAdditions: `
**Angular Specific Requirements**:
- Follow Angular style guide
- Use standalone components where appropriate
- Proper dependency injection
- Use Angular signals/RxJS for state management`,
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
    promptAdditions: `
**Svelte Specific Requirements**:
- Use Svelte 4/5 syntax
- Reactive statements with $:
- Proper event handling`,
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
    promptAdditions: `
**Node.js Specific Requirements**:
- Follow Node.js best practices
- Proper error handling with try-catch
- Use async/await over callbacks`,
  }
];

// ============================================================================
// CORE CLASSES - SOLID Principles Applied
// ============================================================================

/**
 * Project context analyzer - discovers project structure dynamically
 * Single Responsibility: Only analyzes project structure
 */
class ProjectAnalyzer {
  constructor(github, owner, repo, ref) {
    this.github = github;
    this.owner = owner;
    this.repo = repo;
    this.ref = ref;
    this.cache = new Map();
  }

  /**
   * Analyze project and return comprehensive context
   */
  async analyze() {
    console.log('[ProjectAnalyzer] Analyzing project structure...');

    const [packageJson, structure] = await Promise.all([
      this.fetchPackageJson(),
      this.fetchProjectStructure()
    ]);

    const framework = this.detectFramework(packageJson);
    const language = this.detectLanguage(packageJson);

    console.log(`[ProjectAnalyzer] Detected: ${framework.name} (${language})`);
    console.log(`[ProjectAnalyzer] Found ${structure.length} files/directories`);

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
    };
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
   */
  async validateAndLimit(candidates) {
    const validFiles = [];
    let totalSize = 0;

    for (const path of candidates) {
      if (validFiles.length >= CONFIG.maxFilesToFetch) break;
      if (totalSize >= CONFIG.maxTotalContext) break;

      // Check structure cache first
      const fileInfo = this.context.structure.find(item => item.path === path);

      if (fileInfo && fileInfo.type === 'file') {
        if (fileInfo.size <= CONFIG.maxFileSize) {
          validFiles.push(path);
          totalSize += fileInfo.size;
        }
      } else {
        // File not in cache, verify via API
        try {
          const { data } = await this.github.rest.repos.getContent({
            owner: this.owner,
            repo: this.repo,
            path,
            ref: this.ref
          });

          if (data.type === 'file' && data.size <= CONFIG.maxFileSize) {
            validFiles.push(path);
            totalSize += data.size;
          }
        } catch {
          // File doesn't exist, skip
        }
      }
    }

    return validFiles;
  }
}

/**
 * Prompt builder - constructs AI prompts dynamically based on context
 */
class PromptBuilder {
  constructor(projectContext) {
    this.context = projectContext;
  }

  buildFixPrompt(issue, triage, conventions, fileContents) {
    const sections = [
      this.buildSystemContext(),
      this.buildProjectContext(),
      this.buildIssueContext(issue, triage),
      this.buildFileContents(fileContents),
      this.buildCodingStandards(conventions),
      this.buildRequirements(),
      this.buildOutputFormat(issue.number),
    ];

    return sections.join('\n\n');
  }

  buildSystemContext() {
    return `You are a SENIOR SOFTWARE ENGINEER with 10+ years of experience. You write production-quality code that is:
- Maintainable and follows best practices
- Thoroughly considers edge cases and error handling
- Consistent with existing codebase patterns
- Well-structured with proper separation of concerns
- Robust and handles all scenarios mentioned in the issue`;
  }

  buildProjectContext() {
    const { framework, language, projectType, dependencies, promptAdditions } = this.context;

    const depsPreview = Object.keys(dependencies || {})
      .filter(d => !d.startsWith('@types/'))
      .slice(0, 12)
      .join(', ');

    return `## Project Context
- **Framework**: ${framework}
- **Language**: ${language}
- **Project Type**: ${projectType}
- **Key Dependencies**: ${depsPreview}
${promptAdditions || ''}`;
  }

  buildIssueContext(issue, triage) {
    return `## Issue Context - READ CAREFULLY
- **Issue #${issue.number}**: ${issue.title}
- **Full Description**: 
${issue.body || 'No additional details provided'}

- **Classification**: ${triage.classification}
- **Risk Level**: ${triage.risk}
- **Affected Files**: ${(triage.affectedFiles || []).join(', ') || 'Inferred from context'}`;
  }

  buildFileContents(fileContents) {
    if (!fileContents || fileContents.length === 0) {
      return '## Current File Contents\nERROR: No files provided - cannot proceed';
    }

    const formattedFiles = fileContents.map(fc => {
      const ext = this.getLanguageForExtension(fc.path);
      return `### File: ${fc.path}\n\`\`\`${ext}\n${fc.content}\n\`\`\``;
    }).join('\n\n');

    return `## Current File Contents (THESE ARE YOUR WORKING FILES)\n${formattedFiles}`;
  }

  buildCodingStandards(conventions) {
    return `## Coding Standards (FOLLOW EXACTLY)
- Indentation: ${conventions.indent_style === 'space' ? `${conventions.indent_size} spaces` : 'tabs'}
- Line endings: ${conventions.end_of_line?.toUpperCase() || 'LF'}
- Final newline: ${conventions.insert_final_newline !== false ? 'required' : 'optional'}
- Code style: Match the existing style in each file exactly
- Comments: Preserve existing comments, add new ones only for complex logic`;
  }

  buildRequirements() {
    return `## REQUIREMENTS - CRITICAL
1. **Understand the Root Cause**: Don't just patch symptoms. Understand WHY the issue exists.

2. **Consider Edge Cases**:
   - Null/undefined values
   - Empty arrays/objects
   - Invalid inputs (wrong types, out of bounds)
   - Async timing issues and race conditions

3. **Error Handling**: Add proper error handling:
   - Try-catch blocks for risky operations
   - Validation before processing
   - Graceful degradation with informative messages

4. **Type Safety** (TypeScript):
   - Use proper types (avoid 'any')
   - Define interfaces for complex objects
   - Use union types appropriately

5. **Code Quality**:
   - No magic numbers (use named constants)
   - Descriptive variable/function names
   - Single responsibility principle
   - DRY (Don't Repeat Yourself)

6. **Complete the Fix**:
   - Address ALL aspects mentioned in the issue
   - No TODOs or half-implemented features
   - Production-ready code

7. **Consistency**:
   - Match existing code patterns
   - Same naming conventions
   - Same import/export style`;
  }

  buildOutputFormat(issueNumber) {
    return `## Output Format (JSON only, no markdown wrapper)
{
  "file_changes": [
    {
      "path": "path/to/file.ext",
      "content": "COMPLETE FILE CONTENT - include ALL lines, not just changes",
      "change_summary": "What changed, why, and edge cases considered"
    }
  ],
  "commit_message": "type(scope): description\\n\\nDetailed explanation\\n\\nFixes #${issueNumber}"
}

**VALIDATIONS BEFORE RESPONDING**:
✓ Does your fix address the ROOT CAUSE?
✓ Have you considered edge cases?
✓ Is error handling appropriate?
✓ Does code match existing patterns?
✓ Is the fix complete (no TODOs)?
✓ Included ALL lines of each file?

Generate the COMPLETE, PRODUCTION-READY fix:`;
  }

  getLanguageForExtension(filePath) {
    const ext = extname(filePath).slice(1);
    const langMap = {
      vue: 'vue', ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
      json: 'json', md: 'markdown', css: 'css', scss: 'scss', sass: 'sass',
      less: 'less', html: 'html', svelte: 'svelte', py: 'python', rb: 'ruby',
      go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', swift: 'swift',
      yaml: 'yaml', yml: 'yaml', toml: 'toml', xml: 'xml', sql: 'sql',
    };
    return langMap[ext] || ext;
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

    // Apply changes
    for (const change of fileChanges) {
      await this.applyFileChange(change);
    }

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
      max_tokens: CONFIG.maxTokens
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

  async applyFileChange(change) {
    // Create directory if needed
    const dir = dirname(change.path);
    if (dir && dir !== '.' && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(change.path, change.content, 'utf8');
    console.log(`[Auto-Fix] ✓ Updated: ${change.path}`);
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

    await this.github.rest.issues.addLabels({
      owner, repo, issue_number: issueNumber, labels: ['automation-failed']
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
