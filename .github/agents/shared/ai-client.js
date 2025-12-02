/**
 * AI Provider Abstraction
 * 
 * Provides unified interface for AI operations (Anthropic Claude or GitHub Models)
 * with structured prompting and response parsing.
 */

import Anthropic from '@anthropic-ai/sdk';
import { retryWithBackoff } from './retry.js';
import { AutoFixError, ErrorCodes } from './error-handler.js';

/**
 * Determine which AI provider to use based on environment
 * @returns {string} - 'anthropic', 'openai', or 'github'
 */
function getAIProvider() {
  // PRIORITY 1: GitHub Models (free) - use if GITHUB_TOKEN is available
  // This is the default for GitHub Actions (always available)
  if (process.env.GITHUB_TOKEN) {
    console.error('[AI Client] Using GitHub Models (free via GITHUB_TOKEN)');
    return 'github';
  }
  
  // PRIORITY 2: Anthropic (paid, but most reliable)
  if (process.env.ANTHROPIC_API_KEY) {
    console.error('[AI Client] Using Anthropic Claude');
    return 'anthropic';
  }
  
  // PRIORITY 3: OpenAI (paid)
  if (process.env.OPENAI_API_KEY) {
    console.error('[AI Client] Using OpenAI GPT-4');
    return 'openai';
  }
  
  throw new AutoFixError(
    'No AI provider configured. GITHUB_TOKEN should be automatically available in GitHub Actions. If not, set ANTHROPIC_API_KEY or OPENAI_API_KEY.',
    ErrorCodes.CONFIG_ERROR
  );
}

/**
 * Initialize AI client
 * @returns {Object} - AI client instance
 */
export function createAIClient() {
  const provider = getAIProvider();
  
  if (provider === 'anthropic') {
    return new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  
  if (provider === 'openai') {
    return {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
    };
  }
  
  // GitHub Models uses OpenAI-compatible API
  if (provider === 'github') {
    return {
      provider: 'github',
      token: process.env.GITHUB_TOKEN,
    };
  }
}

/**
 * Get AI client instance (alias for createAIClient for compatibility)
 * @returns {Object} - AI client instance with helper methods
 */
export function getAIClient() {
  const client = createAIClient();
  
  // Add generateText helper method
  client.generateText = async function({ messages, temperature = 0.3, max_tokens = 2048 }) {
    // Extract system and user messages
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const userMessage = messages.find(m => m.role === 'user')?.content || '';
    
    return await callAI(client, systemMessage, userMessage, max_tokens, temperature);
  };
  
  return client;
}

/**
 * Call AI model with structured prompt
 * @param {Object} client - AI client
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - User message
 * @param {number} maxTokens - Maximum tokens to generate
 * @param {number} temperature - Temperature for generation
 * @returns {Promise<string>} - AI response text
 */
export async function callAI(client, systemPrompt, userPrompt, maxTokens = 2048, temperature = 0.3) {
  return retryWithBackoff(async () => {
    const provider = client.provider || 'anthropic';
    
    if (provider === 'anthropic' || client.messages) {
      // Anthropic Claude API
      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: maxTokens,
        temperature: temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });
      
      return response.content[0].text;
    }
    
    if (provider === 'openai') {
      // OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${client.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Cost-effective model
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: temperature,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new AutoFixError(
          `OpenAI API error: ${error.error?.message || response.statusText}`,
          ErrorCodes.AI_ERROR,
          { status: response.status, error }
        );
      }
      
      const data = await response.json();
      return data.choices[0].message.content;
    }
    
    // GitHub Models (free) - uses Anthropic Claude via GitHub's proxy
    if (provider === 'github') {
      // GitHub Models endpoint for Anthropic Claude
      const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${client.token}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',  // Use gpt-4o instead of gpt-4o-mini for better results
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: temperature,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new AutoFixError(
          `GitHub Models API error: ${error.error?.message || response.statusText}`,
          ErrorCodes.AI_ERROR,
          { status: response.status, error }
        );
      }
      
      const data = await response.json();
      return data.choices[0].message.content;
    }
    
    throw new AutoFixError(
      'Unknown AI provider',
      ErrorCodes.CONFIG_ERROR
    );
  }, {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 30000,
  });
}

/**
 * Classify issue using AI
 * @param {Object} client - AI client
 * @param {string} title - Issue title
 * @param {string} body - Issue body
 * @returns {Promise<Object>} - Classification result
 */
export async function classifyIssue(client, title, body) {
  const systemPrompt = `You are a GitHub issue classification assistant. Your task is to classify issues into one of these categories:
- BUG: Something is broken or not working as expected
- FEATURE: New functionality or enhancement request
- DOCS: Documentation improvements or corrections
- CHORE: Maintenance tasks (dependencies, refactoring, cleanup)
- OTHER: Unclear or doesn't fit other categories

Respond with ONLY a JSON object in this format:
{
  "classification": "BUG|FEATURE|DOCS|CHORE|OTHER",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}`;

  const userPrompt = `Classify this GitHub issue:

Title: ${title}

Body:
${body}

Respond with JSON only.`;

  const response = await callAI(client, systemPrompt, userPrompt, 512, 0.1);
  
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new AutoFixError(
      `Failed to parse AI classification response: ${error.message}`,
      ErrorCodes.AI_ERROR
    );
  }
}

/**
 * Generate fix plan using AI
 * @param {Object} client - AI client
 * @param {string} title - Issue title
 * @param {string} body - Issue body
 * @param {string} classification - Issue classification
 * @param {Array<string>} affectedFiles - Files mentioned in issue
 * @returns {Promise<Object>} - Fix plan
 */
export async function generateFixPlan(client, title, body, classification, affectedFiles = []) {
  const systemPrompt = `You are a GitHub auto-fix planning assistant. Generate a detailed plan to fix the issue.

Respond with ONLY a JSON object in this format:
{
  "plan_steps": ["Step 1", "Step 2", ...],
  "file_changes": [
    {
      "path": "path/to/file.js",
      "operation": "MODIFY|CREATE|DELETE",
      "summary": "What will change"
    }
  ],
  "validation_commands": ["npm run lint", "npm run type-check"],
  "estimated_complexity": "SIMPLE|MODERATE|COMPLEX"
}`;

  const userPrompt = `Create a fix plan for this ${classification} issue:

Title: ${title}

Body:
${body}

Affected files: ${affectedFiles.length > 0 ? affectedFiles.join(', ') : 'Not specified'}

Generate a step-by-step plan. Respond with JSON only.`;

  const response = await callAI(client, systemPrompt, userPrompt, 1024, 0.3);
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new AutoFixError(
      `Failed to parse AI plan response: ${error.message}`,
      ErrorCodes.AI_ERROR
    );
  }
}

/**
 * Generate code diff using AI
 * @param {Object} client - AI client
 * @param {string} filePath - File to modify
 * @param {string} currentContent - Current file content
 * @param {string} changeDescription - What to change
 * @param {Array<string>} planSteps - Plan steps for context
 * @returns {Promise<string>} - Unified diff format
 */
export async function generateDiff(client, filePath, currentContent, changeDescription, planSteps = []) {
  const systemPrompt = `You are a code generation assistant. Generate a unified diff (patch) to implement the requested change.

The diff MUST be in standard unified diff format:
--- a/path/to/file
+++ b/path/to/file
@@ -line,count +line,count @@
 context line
-removed line
+added line
 context line

Rules:
1. Include at least 3 lines of context before and after changes
2. Use exact indentation and whitespace from original
3. Only change what's necessary
4. Follow the project's coding style
5. Output ONLY the diff, no explanations`;

  const planContext = planSteps.length > 0 
    ? `\n\nPlan steps:\n${planSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : '';

  const userPrompt = `Generate a unified diff to implement this change:

File: ${filePath}

Change description: ${changeDescription}${planContext}

Current file content:
\`\`\`
${currentContent}
\`\`\`

Generate unified diff format only.`;

  const response = await callAI(client, systemPrompt, userPrompt, 2048, 0.2);
  
  // Extract diff from response (might be in code block)
  const diffMatch = response.match(/```(?:diff)?\n([\s\S]*?)\n```/) || response.match(/^---.*$/m);
  
  if (!diffMatch) {
    throw new AutoFixError(
      'AI did not generate valid diff format',
      ErrorCodes.AI_ERROR
    );
  }
  
  return diffMatch[1] || response;
}

/**
 * Generate PR description using AI
 * @param {Object} client - AI client
 * @param {Object} issue - Issue data
 * @param {Object} triageResult - Triage result
 * @param {Object} fixPlan - Fix plan
 * @param {Array<Object>} commits - Commits made
 * @returns {Promise<string>} - PR description (Markdown)
 */
export async function generatePRDescription(client, issue, triageResult, fixPlan, commits) {
  const systemPrompt = `You are a GitHub PR description generator. Create a clear, comprehensive PR description.

Format the response as Markdown with these sections:
1. Summary (2-3 sentences)
2. What Changed (bullet points)
3. Why (explain the fix)
4. Manual Verification (steps to test)
5. Risk Assessment (based on triage data)

Be concise but thorough. Use professional tone.`;

  const userPrompt = `Generate a PR description for this auto-fix:

Issue #${issue.number}: ${issue.title}

Classification: ${triageResult.classification}
Risk: ${triageResult.risk}

Fix plan:
${fixPlan.plan_steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Files changed: ${fixPlan.file_changes.map(fc => fc.path).join(', ')}

Commits: ${commits.length} commit(s)

Generate PR description in Markdown.`;

  return await callAI(client, systemPrompt, userPrompt, 1024, 0.4);
}
