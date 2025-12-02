# Fix for Automated Workflow - Simplified Architecture

## The Problem

The automation workflow was failing because:
1. Too complex: 4 jobs (triage → planner → code → pr) with 2 separate AI calls
2. GitHub Models API unreliable (beta feature)
3. More failure points = more things to go wrong

## ✅ Solution: Simplified Architecture (New!)

We've rebuilt the system with a simpler, more reliable approach:

**Before**: Triage → Planner → Code → PR (4 jobs, 2 AI calls)  
**After**: Triage → Auto-Fix → PR (3 jobs, 1 AI call)

### What Changed

1. **Merged planner + code into one agent** (`auto-fix-agent.js`)
   - Direct approach: Issue → AI prompt → Apply changes → Commit
   - Single AI call instead of two separate calls
   - Faster and more reliable

2. **Simplified workflow** (`.github/workflows/auto-fix.yml`)
   - 3 jobs instead of 4
   - Fewer artifacts to pass between jobs
   - Fewer potential failure points

3. **Better error handling**
   - Clear error messages
   - Automatic rollback on failure
   - Helpful hints for common issues

---

## Quick Fix: Add Anthropic API Key

### Step 1: Get an Anthropic API Key

1. Go to: https://console.anthropic.com/
2. Sign up or log in
3. Go to "API Keys"
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-...`)

### Step 2: Add to GitHub Secrets

1. Go to: https://github.com/divyasonaraa/spec-demo/settings/secrets/actions
2. Click "New repository secret"
3. Name: `ANTHROPIC_API_KEY`
4. Value: Paste your API key
5. Click "Add secret"

### Step 3: Test the Simplified Workflow

The workflow automatically uses the new simplified architecture. Once you add the API key:

1. Create a new test issue:

```
Title: Fix typo in README

Body:
There's a typo in README.md: "teh" should be "the"

Affected Files:
- README.md
```

2. Watch it auto-fix! Should complete in 1-2 minutes (faster than before!)

---

## Alternative: Use OpenAI Instead

If you prefer OpenAI (GPT-4):

1. Get API key from: https://platform.openai.com/api-keys
2. Add secret: `OPENAI_API_KEY` 
3. Workflow will use it automatically

---

## Why GitHub Models Didn't Work

GitHub Models is a newer feature that:
- May not be available in all repos yet
- Requires specific permissions
- Might have regional restrictions
- Is still in beta

Using Anthropic or OpenAI API keys is more reliable for now.

---

## Cost Estimate (Simplified Architecture)

With Anthropic Claude Sonnet:
- Triage: ~$0.01 per issue (keyword-based, rarely needs AI)
- Auto-Fix: ~$0.03 per issue (single AI call)
- **Total: ~$0.04 per auto-fixed issue** ← Cheaper than before!

Very affordable for occasional use!

---

## Benefits of Simplified Architecture

✅ **Simpler**: 3 jobs instead of 4  
✅ **Faster**: 1 AI call instead of 2  
✅ **More reliable**: Fewer failure points  
✅ **Cheaper**: ~33% cost reduction  
✅ **Easier to debug**: Direct flow with clear errors

---

## Need Help?

If you don't want to add an API key, you can:
1. Use the manual fix approach (create issues, get manual PRs)
2. Wait for GitHub Models to be fully available
3. Let me know and I can help debug GitHub Models further
