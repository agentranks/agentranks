# AgentRanks Core — Basic Example

This example shows how to use AgentRanks Core to build an AI-readable profile for a website.

## Sample Files

- `config.json` — Example configuration (normally lives in `.agentranks/config.json`)
- `sample-facts.json` — Example extracted business facts (normally lives in `agentranks.facts.json`)

## Walk-Through

```bash
# 1. Install dependencies
pnpm install

# 2. Build all packages
pnpm build

# 3. Link the CLI globally (or use pnpm dlx)
cd packages/cli && pnpm link --global

# 4. Create a new project directory
mkdir my-project && cd my-project

# 5. Copy the example config and set your API key
mkdir .agentranks
cp ../examples/basic/config.json .agentranks/config.json
export AGENTRANKS_LLM_API_KEY=sk-...

# 6. Run the full workflow
agentranks scan https://yoursite.com
agentranks extract
agentranks validate
agentranks generate
```

## Expected Outputs

After `agentranks generate`, you'll have:

```
agentranks-output/
  agentranks.json         ← Master structured output (machine-readable)
  llms.txt               ← LLM-optimized plain text
  ai-profile.md          ← Company AI profile (Markdown)
  products.md            ← Product catalog (Markdown)
  services.md            ← Services list (Markdown)
  pricing.md             ← Pricing info (Markdown)
  faqs.md                ← FAQ answers (Markdown)
  policies.md            ← Company policies (Markdown)
  use-cases.md           ← Use cases (Markdown)
  differentiators.md     ← Unique value props (Markdown)
  schema.json            ← schema.org JSON-LD
```
