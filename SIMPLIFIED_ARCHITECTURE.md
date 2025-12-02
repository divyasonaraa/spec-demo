# Simplified Auto-Fix Architecture

## Overview

This document describes the simplified architecture implemented in branch `001-simplified-auto-fix`.

## Problem with Previous Architecture

The original 4-job workflow had issues:

```
┌─────────┐    ┌─────────┐    ┌──────┐    ┌────┐
│ Triage  │ -> │ Planner │ -> │ Code │ -> │ PR │
└─────────┘    └─────────┘    └──────┘    └────┘
   30s            60s AI         90s AI       10s
              (AI Call #1)    (AI Call #2)
```

**Problems**:
- ❌ Complex: 4 jobs with artifact passing between them
- ❌ Slow: 2 separate AI calls (planning + code generation)
- ❌ Fragile: More failure points (planner fails → code fails → PR fails)
- ❌ Costly: 2 AI calls per issue (~$0.06 per issue)
- ❌ Hard to debug: Cascade failures obscure root cause

## New Simplified Architecture

```
┌─────────┐    ┌──────────┐    ┌────┐
│ Triage  │ -> │ Auto-Fix │ -> │ PR │
└─────────┘    └──────────┘    └────┘
   30s            90s AI          10s
               (Single AI Call)
```

**Benefits**:
- ✅ Simple: 3 jobs instead of 4
- ✅ Fast: 1 AI call instead of 2 (33% faster)
- ✅ Reliable: Fewer failure points
- ✅ Cheap: ~$0.04 per issue (33% cost reduction)
- ✅ Easy to debug: Direct flow with clear errors

## How It Works

### Job 1: Triage (30 seconds)

**Agent**: `triage-agent.js`  
**Purpose**: Classify issue and assess risk

1. Load issue title and body
2. Classify using keywords (BUG/FEATURE/DOCS/CHORE/OTHER)
3. Extract affected files from issue body
4. Run security checks (keywords, file patterns)
5. Calculate risk score (LOW/MEDIUM/HIGH)
6. Make auto-fix decision:
   - `AUTO_FIX`: Safe for automation (LOW risk, no security flags)
   - `DRAFT_PR`: Needs review (MEDIUM risk)
   - `HUMAN_REVIEW_REQUIRED`: Block automation (HIGH risk, security)

**Output**: `triage-result.json`

### Job 2: Auto-Fix (90 seconds)

**Agent**: `auto-fix-agent.js` ← **NEW: Replaces planner + code**  
**Purpose**: Generate fix and apply changes in one step

1. Load triage result
2. Verify auto-fix is approved
3. Run security pre-check
4. **Direct AI prompt** with full context:
   - Issue title and body
   - Current file contents
   - Repository conventions
   - Request: Generate complete updated file content
5. **Apply changes** to working directory
6. Run validation (lint, type-check, build)
7. Create conventional commit
8. Push branch to remote

**Output**: `commit-result.json`

**Key Innovation**: Single AI call with direct prompt:

```javascript
// Old approach (2 AI calls):
1. AI generates plan (what to do)
2. AI generates code (how to do it)

// New approach (1 AI call):
AI generates complete fix directly
```

### Job 3: PR Generator (10 seconds)

**Agent**: `pr-generator.js` (updated)  
**Purpose**: Create pull request

1. Load triage + commit results (no longer needs fix-plan)
2. Generate PR title and body
3. Create PR (draft if MEDIUM risk)
4. Apply labels (auto-fix, classification, risk level)
5. Suggest reviewers from CODEOWNERS
6. Post success comment on issue

**Output**: `pr-result.json`

## File Changes

### New Files

- `.github/agents/auto-fix-agent.js` ← **Core innovation**
  - Merges planner + code logic
  - Direct AI prompting approach
  - Single responsibility: Issue → Fixed code

### Modified Files

- `.github/workflows/auto-fix.yml`
  - Removed `planner` job
  - Renamed `code` job to `auto-fix`
  - Updated job dependencies
  - Added API key environment variables

- `.github/agents/pr-generator.js`
  - Removed `fix-plan.json` dependency
  - Extract branch name from commit result
  - Simplified `shouldBeDraft()` logic
  - Updated file change iteration (strings not objects)

- `FIX_AUTOMATION.md`
  - Updated with simplified architecture info
  - New cost estimates
  - Faster completion times

### Deprecated Files (Still Present)

- `.github/agents/planner-agent.js` ← No longer used
- `.github/agents/code-agent.js` ← No longer used

These files remain for reference but are not called by the workflow.

## API Key Requirements

The simplified workflow requires one AI provider:

1. **Anthropic Claude** (recommended)
   - Add secret: `ANTHROPIC_API_KEY`
   - Model: Claude Sonnet 3.5
   - Cost: ~$0.03 per auto-fix

2. **OpenAI GPT-4** (alternative)
   - Add secret: `OPENAI_API_KEY`
   - Model: GPT-4
   - Cost: ~$0.04 per auto-fix

3. **GitHub Models** (fallback)
   - Uses `GITHUB_TOKEN` automatically
   - Beta feature, may not work reliably yet

## Example Flow

### Example Issue

```
Title: Fix typo in README

Body:
There's a typo in the installation section.
Line 42: "teh" should be "the"

Affected Files:
- README.md
```

### Workflow Execution

**Step 1: Triage (15 seconds)**
```json
{
  "classification": "DOCS",
  "risk": "LOW",
  "affectedFiles": ["README.md"],
  "securityFlags": false,
  "autoFixDecision": "AUTO_FIX",
  "reasoning": "Simple documentation typo fix"
}
```

**Step 2: Auto-Fix (45 seconds)**

AI Prompt:
```
Issue: Fix typo in README
Current README.md content: [...]
Fix: Generate updated file with "the" instead of "teh"
```

AI Response:
```json
{
  "file_changes": [{
    "path": "README.md",
    "content": "[complete updated file]",
    "change_summary": "Fixed typo: teh → the"
  }],
  "commit_message": "docs(readme): fix typo in installation section\n\nFixes #42"
}
```

**Step 3: PR Generator (8 seconds)**
```
Created PR #43: Fix #42: Fix typo in README
Branch: docs/42-fix-typo-readme
Status: Ready for review (not draft)
```

**Total Time**: ~70 seconds (vs. 120+ seconds with old architecture)

## Testing

### Test Case 1: Low-Risk Documentation Fix

```
Title: Fix typo in README
Body: Change "teh" to "the" on line 15
Affected Files: README.md

Expected: AUTO_FIX, PR created in 60-90 seconds
```

### Test Case 2: Medium-Risk Multi-File Change

```
Title: Update API endpoint in 3 files
Body: Change /api/v1 to /api/v2
Affected Files: routes.ts, handlers.ts, types.ts

Expected: DRAFT_PR, PR created with needs-review label
```

### Test Case 3: High-Risk Security Block

```
Title: Update API key in config
Body: Change API key to new value
Affected Files: .env, config/secrets.ts

Expected: HUMAN_REVIEW_REQUIRED, automation blocked
```

## Migration from Old Architecture

If you have existing issues with the old workflow:

1. **Already completed**: No action needed (PRs exist)
2. **Failed at planner**: Will work with simplified architecture
3. **Failed at code**: Will work with simplified architecture
4. **Failed at PR**: Can re-run with new workflow

Simply add `ANTHROPIC_API_KEY` secret and create new issues.

## Troubleshooting

### "Auto-fix agent timeout"
- Issue too complex for 90s window
- Increase `TIMEOUT_MS` in workflow
- Or mark as HUMAN_REVIEW_REQUIRED

### "AI API failed"
- Check API key is valid
- Check API key has credits
- Try alternative provider (OPENAI_API_KEY)

### "Validation failed"
- AI-generated code doesn't pass lint/type-check
- System automatically rolls back
- Posts detailed error to issue
- Requires manual fix

### "Security violation"
- Issue affects sensitive files (.env, keys, etc.)
- Automation correctly blocked
- Manual implementation required

## Future Improvements

Possible enhancements:

1. **Retry logic**: Auto-retry failed AI calls with exponential backoff
2. **Quality checks**: Verify AI output before applying (syntax check)
3. **Learning**: Track successful patterns, improve prompts
4. **Caching**: Cache repository context to reduce AI tokens
5. **Streaming**: Stream AI responses for faster perception

## Comparison Summary

| Metric | Old Architecture | New Architecture | Improvement |
|--------|------------------|------------------|-------------|
| Jobs | 4 | 3 | 25% fewer |
| AI Calls | 2 | 1 | 50% fewer |
| Duration | 120s | 70s | 42% faster |
| Cost | $0.06 | $0.04 | 33% cheaper |
| Failure Points | 4 | 3 | 25% fewer |
| Artifacts | 3 | 2 | 33% fewer |
| Code Complexity | High | Low | Easier to maintain |

## Conclusion

The simplified architecture achieves the same goal (automated issue fixing) with:
- **Less complexity**: Fewer moving parts
- **Better reliability**: Fewer failure points
- **Lower cost**: Fewer AI calls
- **Faster execution**: Direct approach
- **Easier debugging**: Clear error paths

This is a production-ready improvement over the original design.
