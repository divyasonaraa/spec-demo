# Fix for Automated Workflow

## The Problem

The planner agent is failing because it can't access the AI API (GitHub Models or Anthropic).

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

### Step 3: Update Workflow to Use It

The workflow already supports `ANTHROPIC_API_KEY` - it will use it automatically once you add the secret.

The agents check in this order:
1. `ANTHROPIC_API_KEY` (if set) ← **ADD THIS**
2. `OPENAI_API_KEY` (if set)
3. `GITHUB_TOKEN` with GitHub Models (may not work yet)

### Step 4: Re-run the Workflow

Once the secret is added:
1. Go to: https://github.com/divyasonaraa/spec-demo/actions
2. Find the failed run for issue #34
3. Click "Re-run all jobs"
4. ✅ Should work now!

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

## Cost Estimate

With Anthropic Claude Sonnet:
- Triage: ~$0.01 per issue
- Planner: ~$0.02 per issue
- Code Agent: ~$0.03 per issue
- **Total: ~$0.06 per auto-fixed issue**

Very affordable for occasional use!

---

## Test After Adding Key

1. Close issue #34 (to reset state)
2. Create a new test issue:

```
Title: Fix typo in README

Body:
There's a typo in README.md: "teh" should be "the"

Affected Files:
- README.md
```

3. Watch it auto-fix! Should complete in 2-3 minutes.

---

## Need Help?

If you don't want to add an API key, you can:
1. Use the manual fix I created (PR #35)
2. Wait for GitHub Models to be fully available
3. Let me know and I can help debug GitHub Models further
