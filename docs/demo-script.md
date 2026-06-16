# AgentRanks Demo Script

A step-by-step walkthrough for demonstrating AgentRanks to a new user or in a recorded demo.

## Setup

```bash
# Install globally
npm install -g agentranks

# Or run from this repo
node packages/cli/dist/index.js --help
```

## Part 1 — Quickstart (60 seconds)

The fastest way to run the full pipeline:

```bash
agentranks quickstart https://www.knacksters.co
```

This chains: init → scan → extract → validate → score → review → generate → intents → deploy.

Use `--dry-run` to skip the LLM extraction step and show the flow without API calls:

```bash
agentranks quickstart https://www.knacksters.co --dry-run
```

## Part 2 — Step-by-step workflow

### Initialize a project

```bash
mkdir my-demo && cd my-demo
agentranks init
# Enter: https://www.example.com
# Enter: Example Company
```

This creates `.agentranks/config.json`.

### Crawl the website

```bash
agentranks scan
```

Output: `.agentranks/pages.json` — structured page data from the crawl.

### Extract facts with an LLM

```bash
agentranks extract
```

Requires a configured LLM (DeepSeek by default, or any OpenAI-compatible endpoint).
Output: `agentranks.facts.json`

### Review facts

```bash
agentranks review
# Interactive approve/reject per fact
agentranks review --apply
# Write approved facts back to disk
```

### Score AI readiness

```bash
agentranks score
```

Produces a 0–100 AI readiness score based on: fact count, confidence, coverage by category, publishability, and evidence quality.

### Generate outputs

```bash
agentranks generate
```

Creates in `agentranks-output/`:
- `agentranks.json` — master structured output
- `llms.txt` — LLMs.txt spec format
- `ai-profile.md`, `services.md`, `pricing.md`, `faqs.md` — category Markdown
- `schema.json` — schema.org JSON-LD

### Generate AI Intent Briefs

```bash
agentranks intents
# Or target specific user prompts:
agentranks intents --prompts-file prompts.txt
```

Creates `agentranks-output/intents/` with:
- `index.md` — brief directory with primary retrieval terms
- `{slug}.md` — per-intent brief with retrieval vocabulary section

### Deploy to a static site

```bash
agentranks deploy
```

Creates `agentranks-public/` with:
- HTML versions of all Markdown
- `sitemap.xml`
- `robots.txt` suggestion
- `deploy-report.md`

### Submit to IndexNow

```bash
agentranks submit
```

Submits all public URLs to IndexNow for fast discovery.

## Part 3 — Show the output

Open `agentranks-output/agentranks.json`:
- Shows structured business facts with categories, confidence, risk level, provenance

Open `agentranks-output/intents/customer-success.md`:
- Shows intent brief with user situations, best-fit facts, CTA
- Shows **retrieval vocabulary section** with primary terms, related terms, entities, common user language

Open `agentranks-output/llms.txt`:
- AI-readable format following the LLMs.txt spec

## Key talking points

1. **No black box** — all outputs are readable JSON and Markdown files
2. **Source-backed** — every fact has a source URL and evidence text
3. **Fully local** — no data leaves the machine (except LLM API calls)
4. **AI Intent Pages** — designed for how AI agents retrieve business context, not just web search
5. **Retrieval vocabulary** — derived deterministically from facts; no keyword stuffing or hidden content
6. **IndexNow support** — fast URL submission for discoverability
7. **Core vs Cloud** — this is the open-source engine; Cloud adds monitoring, trending signals, and managed refresh

## Alias

```bash
agentrank --help   # same as agentranks --help
```
