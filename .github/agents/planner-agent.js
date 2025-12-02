#!/usr/bin/env node

/**
 * Planner Agent - Generate implementation plan for approved auto-fix issues
 * 
 * Input: TriageResult from triage agent
 * Output: FixPlan with branch name, plan steps, file changes, validation commands
 * 
 * Contract: specs/001-github-auto-fix/contracts/planner-agent.md
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getGitHubClient } from './shared/github-client.js';
import { getAIClient } from './shared/ai-client.js';
import { AutoFixError } from './shared/error-handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Environment variables
const ISSUE_NUMBER = process.env.ISSUE_NUMBER;
const TRIAGE_RESULT_PATH = process.env.TRIAGE_RESULT_PATH || './triage-result.json';
const OUTPUT_PATH = process.env.OUTPUT_PATH || './fix-plan.json';
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '60000', 10);

/**
 * Main entry point
 */
async function main() {
    const startTime = Date.now();
    console.log(`[Planner] Starting for issue #${ISSUE_NUMBER}`);

    try {
        // Set timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new AutoFixError('TIMEOUT', 'Planner agent timeout exceeded 60s')), TIMEOUT_MS);
        });

        // Run planner with timeout
        const resultPromise = runPlanner();
        const result = await Promise.race([resultPromise, timeoutPromise]);

        // Write output
        writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[Planner] ✓ Completed in ${duration}s`);
        process.exit(0);

    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(`[Planner] ✗ Failed after ${duration}s:`, error.message);

        // Write error output
        const errorResult = {
            success: false,
            error: {
                code: error.code || 'PLANNING_FAILED',
                message: error.message,
                details: error.details || {}
            }
        };
        writeFileSync(OUTPUT_PATH, JSON.stringify(errorResult, null, 2));
        process.exit(1);
    }
}

/**
 * Run planner logic
 */
async function runPlanner() {
    // Load triage result
    const triageResult = JSON.parse(readFileSync(TRIAGE_RESULT_PATH, 'utf8'));

    if (!triageResult.success) {
        throw new AutoFixError('INVALID_INPUT', 'Triage result indicates failure');
    }

    const triage = triageResult.data;

    // Validate auto-fix decision
    if (triage.autoFixDecision !== 'AUTO_FIX') {
        throw new AutoFixError('NOT_AUTO_FIX', `Auto-fix not approved: ${triage.autoFixDecision}`);
    }

    // Ensure affectedFiles is an array
    triage.affectedFiles = triage.affectedFiles || [];

    // Get GitHub client
    const github = getGitHubClient();
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

    // Fetch issue details
    const { data: issue } = await github.rest.issues.get({
        owner,
        repo,
        issue_number: parseInt(ISSUE_NUMBER, 10)
    });

    console.log(`[Planner] Processing: ${issue.title}`);

    // Load project conventions
    const conventions = await loadProjectConventions(github, owner, repo);

    // Generate branch name
    const branchName = generateBranchName(
        issue.number,
        triage.classification,
        issue.title,
        conventions.branch_prefix
    );

    console.log(`[Planner] Branch: ${branchName}`);

    // Generate plan steps using AI
    const planSteps = await generatePlanSteps(issue, triage);
    console.log(`[Planner] Generated ${planSteps.length} plan steps`);

    // Analyze file changes
    const fileChanges = await analyzeFileChanges(triage.affectedFiles || [], planSteps);
    console.log(`[Planner] Analyzed ${fileChanges.length} file changes`);

    // Fallback: DOCS issues often target README.md; if no file changes inferred, attempt auto-detect
    if (fileChanges.length === 0 && triage.classification === 'DOCS') {
        try {
            const repoRoot = join(__dirname, '..', '..');
            const readmePath = join(repoRoot, 'README.md');
            // Only add if README exists locally (workflow checks out repository)
            const fs = await import('fs');
            if (fs.existsSync(readmePath)) {
                fileChanges.push({
                    path: 'README.md',
                    operation: 'MODIFY',
                    change_summary: 'Correct documentation typo(s) referenced in issue title/body',
                    line_range: null
                });
                console.log('[Planner] Fallback added README.md to file_changes for DOCS issue');
            } else {
                console.log('[Planner] README.md not found for DOCS fallback');
            }
        } catch (e) {
            console.log('[Planner] Fallback detection error:', e.message);
        }
    }

    // Select validation commands
    const validationCommands = selectValidationCommands(
        triage.risk,
        triage.affectedFiles,
        conventions
    ) || [];
    console.log(`[Planner] Validation: ${validationCommands.length > 0 ? validationCommands.join(', ') : 'none'}`);

    // Evaluate human review need
    const humanCheckReason = evaluateHumanReviewNeed(
        triage.risk,
        fileChanges,
        estimateComplexity(planSteps, fileChanges)
    );

    if (humanCheckReason) {
        console.log(`[Planner] Human review required: ${humanCheckReason}`);
    }

    // Estimate duration
    const complexity = estimateComplexity(planSteps, fileChanges);
    const estimatedDuration = estimateDuration(complexity);

    // Build fix plan
    const fixPlan = {
        issue_number: issue.number,
        branch_name: branchName,
        classification: triage.classification,
        plan_steps: planSteps,
        file_changes: fileChanges,
        validation_commands: validationCommands,
        human_check_reason: humanCheckReason,
        estimated_duration: estimatedDuration,
        timestamp: new Date().toISOString()
    };

    return {
        success: true,
        data: fixPlan
    };
}

/**
 * Generate branch name following convention: {prefix}/{number}-{slug}
 */
function generateBranchName(issueNumber, classification, title, branchPrefix) {
    const prefix = branchPrefix[classification] || 'fix';

    // Create slug from title
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
        .trim()
        .split(/\s+/)
        .slice(0, 5) // First 5 words
        .join('-')
        .substring(0, 50); // Max 50 chars

    return `${prefix}/${issueNumber}-${slug}`;
}

/**
 * Generate implementation plan steps using AI
 */
async function generatePlanSteps(issue, triage) {
    const ai = getAIClient();

    const prompt = `You are a software development planner. Generate a clear, ordered implementation plan to fix this GitHub issue.

Issue #${issue.number}: ${issue.title}
Details: ${issue.body || 'No additional details provided'}
Classification: ${triage.classification}
Affected Files: ${(triage.affectedFiles || []).join(', ') || 'None specified'}

Generate 3-7 implementation steps. For each step, provide:
1. order: Sequential number (1, 2, 3, ...)
2. description: Clear action to take (be specific)
3. command: Shell command to run (or null if not applicable)
4. files_involved: Array of file paths affected by this step

IMPORTANT: Keep steps minimal and focused. Avoid unnecessary refactoring.

Respond with ONLY a valid JSON array of step objects. No explanation, no markdown formatting.

Example format:
[
  {
    "order": 1,
    "description": "Read README.md and locate the typo on line 15",
    "command": null,
    "files_involved": ["README.md"]
  },
  {
    "order": 2,
    "description": "Replace 'teh' with 'the' in the installation instructions",
    "command": null,
    "files_involved": ["README.md"]
  },
  {
    "order": 3,
    "description": "Verify markdown formatting is valid",
    "command": "npm run lint",
    "files_involved": ["README.md"]
  }
]`;

    const response = await ai.generateText({
        messages: [
            { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
    });

    // Parse JSON response
    let steps;
    try {
        // Extract JSON from response (handle markdown code blocks)
        let jsonText = response.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\s*$/g, '').trim();
        }
        steps = JSON.parse(jsonText);
    } catch (error) {
        throw new AutoFixError('INVALID_LLM_OUTPUT', 'Failed to parse plan steps JSON', { response });
    }

    // Validate and normalize steps
    if (!Array.isArray(steps) || steps.length === 0) {
        throw new AutoFixError('INVALID_LLM_OUTPUT', 'Plan steps must be a non-empty array');
    }

    return steps.map((step, idx) => ({
        order: idx + 1,
        description: step.description || 'Unknown step',
        command: step.command || null,
        files_involved: step.files_involved || []
    }));
}

/**
 * Analyze file changes to determine operations and summaries
 */
async function analyzeFileChanges(affectedFiles, planSteps) {
    // Ensure affectedFiles is an array
    affectedFiles = affectedFiles || [];

    // If no affected files, return empty array
    if (affectedFiles.length === 0) {
        return [];
    }

    return affectedFiles.map(path => {
        // Determine operation based on plan step descriptions
        const operation = determineOperation(path, planSteps);

        // Summarize change
        const changeSummary = summarizeChange(path, planSteps);

        // Estimate line range (null for CREATE/DELETE)
        const lineRange = operation === 'MODIFY' ? estimateLineRange(path, planSteps) : null;

        return {
            path,
            operation,
            change_summary: changeSummary,
            line_range: lineRange
        };
    });
}

/**
 * Determine file operation type (CREATE/MODIFY/DELETE)
 */
function determineOperation(path, steps) {
    const mentions = steps.filter(s =>
        s.files_involved.includes(path) || s.description.toLowerCase().includes(path.toLowerCase())
    );

    const descriptions = mentions.map(m => m.description.toLowerCase()).join(' ');

    if (descriptions.includes('create') || descriptions.includes('add new')) {
        return 'CREATE';
    }
    if (descriptions.includes('delete') || descriptions.includes('remove file')) {
        return 'DELETE';
    }
    return 'MODIFY';
}

/**
 * Generate summary of changes for a file
 */
function summarizeChange(path, steps) {
    const relevantSteps = steps.filter(s =>
        s.files_involved.includes(path) || s.description.toLowerCase().includes(path.toLowerCase())
    );

    if (relevantSteps.length === 0) {
        return `Update ${path}`;
    }

    // Combine descriptions
    const descriptions = relevantSteps.map(s => s.description);
    if (descriptions.length === 1) {
        return descriptions[0];
    }

    return descriptions.join('; ');
}

/**
 * Estimate line range for modifications (rough heuristic)
 */
function estimateLineRange(path, steps) {
    // Look for line numbers in descriptions
    const relevantSteps = steps.filter(s =>
        s.files_involved.includes(path) || s.description.toLowerCase().includes(path.toLowerCase())
    );

    for (const step of relevantSteps) {
        const match = step.description.match(/line\s+(\d+)/i);
        if (match) {
            const line = parseInt(match[1], 10);
            return [line, line];
        }
    }

    // No specific line mentioned, return null (will be determined by code agent)
    return null;
}

/**
 * Select appropriate validation commands based on risk and file types
 */
function selectValidationCommands(risk, affectedFiles, conventions) {
    const commands = [];

    // Ensure affectedFiles is an array
    affectedFiles = affectedFiles || [];

    // Always lint
    if (conventions.lint_command) {
        commands.push(conventions.lint_command);
    }

    // Type-check if TypeScript/Vue files affected
    const needsTypeCheck = affectedFiles.some(f =>
        f.endsWith('.ts') || f.endsWith('.vue') || f.endsWith('.tsx')
    );
    if (needsTypeCheck && conventions.type_check_command) {
        commands.push(conventions.type_check_command);
    }

    // Build for MEDIUM+ risk
    if ((risk === 'MEDIUM' || risk === 'HIGH') && conventions.build_command) {
        commands.push(conventions.build_command);
    }

    // Filter out test commands (Constitution Principle V: NO TESTING)
    return commands.filter(c => !c.toLowerCase().includes('test'));
}

/**
 * Evaluate if human review is needed
 */
function evaluateHumanReviewNeed(risk, fileChanges, complexity) {
    if (risk === 'HIGH') {
        return 'HIGH risk issue requires full human review before any code changes.';
    }

    if (risk === 'MEDIUM') {
        return `MEDIUM risk: ${fileChanges.length} file(s) affected. Draft PR will require maintainer approval.`;
    }

    if (fileChanges.length > 5) {
        return `Large scope: ${fileChanges.length} files affected (> 5 file limit). Requires review.`;
    }

    if (complexity === 'COMPLEX') {
        return 'Complex implementation detected. Human verification recommended.';
    }

    return null; // Auto-fix can proceed
}

/**
 * Estimate complexity based on plan steps and file changes
 */
function estimateComplexity(planSteps, fileChanges) {
    const stepCount = planSteps.length;
    const fileCount = fileChanges.length;

    if (stepCount <= 3 && fileCount === 1) return 'TRIVIAL';
    if (stepCount <= 5 && fileCount <= 2) return 'SIMPLE';
    if (stepCount <= 10 && fileCount <= 5) return 'MODERATE';
    return 'COMPLEX';
}

/**
 * Estimate duration in minutes based on complexity
 */
function estimateDuration(complexity) {
    switch (complexity) {
        case 'TRIVIAL': return 2;
        case 'SIMPLE': return 5;
        case 'MODERATE': return 15;
        case 'COMPLEX': return 30;
        default: return 10;
    }
}

/**
 * Load project conventions from package.json and configuration files
 */
async function loadProjectConventions(github, owner, repo) {
    const defaults = {
        branch_prefix: {
            'BUG': 'fix',
            'FEATURE': 'feature',
            'DOCS': 'docs',
            'CHORE': 'chore',
            'OTHER': 'fix'
        },
        // Commands will be populated only if scripts exist
        lint_command: null,
        type_check_command: null,
        build_command: null,
        style_guide: 'standard'
    };

    try {
        // Try to fetch package.json
        const { data: packageJson } = await github.rest.repos.getContent({
            owner,
            repo,
            path: 'package.json'
        });

        const pkg = JSON.parse(Buffer.from(packageJson.content, 'base64').toString('utf8'));

        // Extract commands from scripts
        if (pkg.scripts) {
            if (pkg.scripts.lint) defaults.lint_command = 'npm run lint';
            if (pkg.scripts['type-check']) defaults.type_check_command = 'npm run type-check';
            if (pkg.scripts.build) defaults.build_command = 'npm run build';
        }
    } catch (error) {
        // package.json not found or inaccessible, use defaults
        console.log('[Planner] Using default conventions (package.json not found)');
    }

    return defaults;
}

// Run main function
main().catch(error => {
    console.error('[Planner] Unhandled error:', error);
    process.exit(1);
});
