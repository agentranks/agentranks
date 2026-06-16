# AgentRanks

[![CI](https://github.com/agentranks/agentranks/actions/workflows/ci.yml/badge.svg)](https://github.com/agentranks/agentranks/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agentranks.svg)](https://www.npmjs.com/package/agentranks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/node/v/agentranks.svg)](https://nodejs.org)

> **Build an AI-readable source of truth for your business.**
>
> [agentranks.io](https://agentranks.io) · [github.com/agentranks/agentranks](https://github.com/agentranks/agentranks)

AgentRanks is an open-source TypeScript CLI and package suite that scans your website, extracts structured business facts using an LLM, validates them, and generates AI-readable output files — including `agentranks.json`, `llms.txt`, Markdown profiles, schema.org JSON-LD, AI Intent Pages, and a deployable static site.

## Why AgentRanks?

AI assistants — ChatGPT, Claude, Perplexity, Google's AI overviews — increasingly answer questions about businesses on your behalf. When your website isn't machine-readable, these systems guess at what you do, pull outdated details, or leave you out of the answer entirely.

AgentRanks turns your website into a structured, source-backed profile that AI systems can read accurately:

- **Facts, not vibes** — every claim is tied to a real page on your site, with a confidence score. No invented details.
- **Speaks the AI's language** — generates `llms.txt`, schema.org structured data, and intent pages that state clearly when and why an assistant should recommend you.
- **You stay in control** — review and approve every fact before anything is published. Nothing hidden, nothing keyword-stuffed.
- **Runs locally** — it's a command-line tool you run yourself. No account, no SaaS, no data leaves your machine except the page text sent to the LLM you choose.

If customers are starting to find businesses through AI, AgentRanks helps make sure the AI gets *your* story right.

**Quickstart (one command):**

```bash
npm install -g agentranks
agentranks quickstart https://yourcompany.com --publishing-mode public_indexable
```

**Or granular workflow:**

```
agentranks init
agentranks scan https://yourcompany.com
agentranks extract
agentranks validate
agentranks score
agentranks review
agentranks generate
agentranks intents
agentranks deploy
agentranks submit --indexnow --dry-run
```

> **Alias:** `agentrank` (without the `s`) is a backward-compatible alias for the same binary.

---

## Features

- **Zero-config crawling** — BFS website crawler with `robots.txt` support and rate limiting
- **LLM-powered extraction** — Works with DeepSeek, OpenAI, Ollama, or any OpenAI-compatible API
- **Structured facts** — Every fact includes `sourceUrl` and `confidence` (no hallucinations)
- **Zod-validated schema** — All data is validated at every pipeline stage
- **AI-readiness scoring** — Deterministic 0–100 score across 10 categories with actionable recommendations
- **AI Intent Pages** — Source-backed recommendation pages that explain when an AI should recommend your business and what action the user can take next
- **Prompt-targeted intents** — Pass a `--prompts-file` of user questions to generate intent briefs matched to real prompts
- **Static deploy** — One command to produce a website-ready `agentranks-public/` folder with HTML, sitemap, and robots guidance
- **IndexNow submit** — Submit deployed URLs to IndexNow-compatible search engines with `agentranks submit --indexnow`
- **Quickstart** — Chain the full pipeline in one command with `agentranks quickstart`
- **Rich outputs** — Generates 12+ AI-readable files from a single command
- **Fully local** — No SaaS, no auth, no cloud required. No Google Search Console automation. No audit/monitoring (planned for future Cloud version).

---

## Outputs

| File | Description |
|------|-------------|
| `agentranks.json` | Master structured JSON output |
| `llms.txt` | LLM-optimized plain text ([llms.txt spec](https://llmstxt.org/)) |
| `ai-profile.md` | Company AI overview |
| `products.md` | Product catalog |
| `services.md` | Services list |
| `pricing.md` | Pricing information |
| `faqs.md` | FAQ answers |
| `policies.md` | Company policies |
| `use-cases.md` | Use cases and personas |
| `differentiators.md` | Unique value propositions |
| `schema.json` | schema.org JSON-LD |
| `intents/` | AI Intent Pages (run `agentranks intents`) |

After running `agentranks deploy`, an `agentranks-public/` folder is created containing:

| Path | Source |
|------|--------|
| `agentranks-public/llms.txt` | Direct copy |
| `agentranks-public/agentranks.json` | Direct copy |
| `agentranks-public/schema.json` | Direct copy |
| `agentranks-public/ai-profile/index.html` | Converted from `ai-profile.md` |
| `agentranks-public/services/index.html` | Converted from `services.md` |
| `agentranks-public/products/index.html` | Converted from `products.md` |
| `agentranks-public/pricing/index.html` | Converted from `pricing.md` |
| `agentranks-public/faqs/index.html` | Converted from `faqs.md` |
| `agentranks-public/policies/index.html` | Converted from `policies.md` |
| `agentranks-public/use-cases/index.html` | Converted from `use-cases.md` |
| `agentranks-public/differentiators/index.html` | Converted from `differentiators.md` |
| `agentranks-public/ai/intents/index.html` | Converted from `intents/index.md` |
| `agentranks-public/ai/intents/<slug>/index.html` | One per intent brief |
| `agentranks-public/ai/sitemap.xml` | Auto-generated |
| `.agentranks/deploy/submit-urls.txt` | One URL per line, ready for indexing tools |
| `.agentranks/deploy/robots-suggested.txt` | Suggested `robots.txt` block to merge |
| `.agentranks/deploy/deploy-report.md` | Human-readable deploy summary with next steps |
| `.agentranks/deploy/deploy.json` | Machine-readable manifest for `agentranks submit` |

---

## Requirements

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9 (for development / monorepo)
- An API key for an [OpenAI-compatible LLM](#llm-configuration)

---

## Installation

### Global install (recommended for use)

```bash
npm install -g agentranks
agentranks init
```

### From source (development)

```bash
# Clone the repo
git clone https://github.com/agentranks/agentranks.git
cd agentranks

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run directly without global linking
node packages/cli/dist/index.js init
```

> **Note:** The monorepo root exposes an `agentranks` npm script, but `pnpm run agentranks -- init` passes the `--` separator through to the CLI. Use `node packages/cli/dist/index.js <command>` directly in development, or link globally:
>
> ```bash
> cd packages/cli && pnpm link --global
> ```

---

## Quick Start

### 1. Set up environment

```bash
cp .env.example .env
```

Edit `.env` and set your LLM API key:

```env
AGENTRANKS_LLM_API_KEY=sk-...
AGENTRANKS_LLM_BASE_URL=https://api.deepseek.com/v1
AGENTRANKS_LLM_MODEL=deepseek-v4-pro
```

### 2. Initialize a project

```bash
mkdir my-project && cd my-project
agentranks init
```

### 3. Run the full pipeline

```bash
agentranks scan
agentranks extract
agentranks validate
agentranks score                  # see .agentranks/score.md for AI-readiness gaps
agentranks review                 # creates .agentranks/review.md + review.json
agentranks review --apply         # write reviewed facts back to agentranks.facts.json
agentranks generate               # generates agentranks-output/ files
agentranks intents                # generates AI Intent Pages in agentranks-output/intents/
```

Your AI-readable business profile is now in `agentranks-output/`.

> **Shortcut:** Skip manual editing with `agentranks review --approve-low-risk` to auto-approve all low-risk extracted facts, then run `agentranks generate` and `agentranks intents`.

### Quickstart (single command)

```bash
agentranks quickstart https://example.com \
  --publishing-mode public_indexable \
  --base-url https://example.com \
  --approve-low-risk
```

This chains: **init → scan → extract → validate → score → review → generate → intents → deploy** in one pass. IndexNow submission is not automatic; use `agentranks submit --indexnow` when ready.

---

### Granular workflow

```bash
agentranks init
agentranks scan https://example.com
agentranks extract
agentranks validate
agentranks score
agentranks review --approve-low-risk
agentranks generate
agentranks intents --publishing-mode public_indexable
agentranks deploy --base-url https://example.com
agentranks submit --indexnow --dry-run
```

---

### Retrieval vocabulary

Every intent brief includes a **retrieval vocabulary** section derived deterministically from your publishable facts. This appears as a visible, human-readable section in every intent brief Markdown file and the deployed HTML — never hidden text, never crawler-only content.

```md
## Related terms and user language

### Primary terms
- customer success
- on-demand professional services

### Related terms
- CSM
- customer onboarding
- renewals

### Named entities
- Knacksters

### Common user language
- customer success help without hiring full-time
- test a CSM before making a permanent hire
```

Terms are generated from:

- Publishable fact claims, detail, and evidence text
- Fact tags and categories
- Intent theme and business name
- User prompts (when using `--prompts-file`)
- Controlled synonym/abbreviation mappings (e.g. "customer success manager" → "CSM")

Excluded facts (rejected, needs_review, high-risk, legal-priority, low-priority) never contribute terms.

No LLM is called. No live keyword/trend fetching occurs. AgentRanks Cloud will later extend this with Search Console signals, Bing query data, trend scores, and competitor vocabulary.

---

### AI Intent Pages

AI Intent Pages explain when an AI or agent should recommend your business, product, or service — and what action the user should take next.

```bash
agentranks intents
# → agentranks-output/intents/index.md      (overview of all briefs)
# → agentranks-output/intents/prompts.md    (example AI prompts per brief)
# → agentranks-output/intents/intents.json  (structured JSON for all briefs)
# → agentranks-output/intents/<slug>.md     (one file per intent brief)
```

**Prompt-targeted intents** (from a prompts file):

```bash
# prompts.txt contains one user question per line, e.g.:
# I need customer success help but I'm not ready to hire full-time.
# What are alternatives to a full-time CSM?

agentranks intents --prompts-file prompts.txt --publishing-mode public_indexable
```

Prompts with matching publishable facts generate `pf-*` intent briefs. Prompts with no matching facts are skipped and reported. No LLM is called — matching is purely token-based and deterministic.

**Publishing modes:**

| Mode | Description |
|------|-------------|
| `private_export` | Local Markdown/JSON export only (default) |
| `public_indexable` | Intended for public, crawlable, indexable hosting. Best for AI/search discovery. |
| `public_noindex` | Public crawlable but with noindex. May reduce search/AI eligibility. |

> **Safety:** All generated briefs are honest, source-backed documents. If hosted, a human with the URL should see the same content as an AI crawler. AgentRanks does not generate hidden crawler-only pages or serve different content to AI vs. humans.

---

### Deploy

```bash
agentranks deploy --base-url https://example.com
```

Produces `agentranks-public/` — a static folder with HTML, sitemap, and robots guidance — ready to copy to your server or CDN.

---

### Submit to IndexNow

```bash
# Dry run first
agentranks submit --indexnow --dry-run

# Submit
agentranks submit --indexnow --key <your-indexnow-key>
```

Reads URLs from `.agentranks/deploy/deploy.json` (or falls back to `submit-urls.txt`). Writes a report to `.agentranks/submit/indexnow-report.md`.

> **Note:** AgentRanks v1 does not support Google Search Console API automation or recurring scheduled submission. Those features are planned for the future Cloud version. IndexNow submission requires manual human action (`agentranks submit --indexnow`).

---

## LLM Configuration

AgentRanks uses any **OpenAI-compatible** API. The default is DeepSeek.

| Provider | `AGENTRANKS_LLM_BASE_URL` | Model |
|----------|--------------------------|-------|
| **DeepSeek** _(default)_ | `https://api.deepseek.com/v1` | `deepseek-v4-pro` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Ollama (local) | `http://localhost:11434/v1` | `llama3` |
| Any compatible | Custom | Custom |

---

## Packages

| Package | Description |
|---------|-------------|
| `@agentranks/core` | Shared Zod schemas, types, and config utilities |
| `@agentranks/crawler` | Website fetcher and HTML parser (Cheerio) |
| `@agentranks/ai` | OpenAI-compatible LLM client and fact extractor |
| `@agentranks/publisher` | Output file generators |
| `agentranks` | Commander CLI (`agentranks` / `agentrank` commands) |

---

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build in watch mode
pnpm dev

# Clean all build artifacts
pnpm clean
```

### Project Structure

```
agentranks/
├── packages/
│   ├── core/         Shared schemas, types, config
│   ├── crawler/      Website crawler (BFS + Cheerio)
│   ├── ai/           LLM client + fact extractor
│   ├── publisher/    Output generators
│   └── cli/          Commander CLI
├── examples/
│   ├── basic/        Sample config and facts
│   └── knacksters/   Representative end-to-end output
├── docs/
│   ├── architecture.md
│   ├── cli-reference.md
│   ├── programmatic-usage.md
│   ├── release-checklist.md
│   └── demo-script.md
├── .github/workflows/ci.yml
├── CONTRIBUTING.md
├── CHANGELOG.md
├── SECURITY.md
├── .env.example
└── FILE_PLAN.md
```

---

## CLI Reference

See [`docs/cli-reference.md`](./docs/cli-reference.md) for full documentation.

```
agentranks init                          Initialize a new project
agentranks scan                          Crawl the website
agentranks extract                       Extract facts with LLM
agentranks validate                      Validate extracted facts
agentranks review                        Generate review files (review.md + review.json)
agentranks review --apply                Apply review.json edits to agentranks.facts.json
agentranks review --approve-low-risk     Auto-approve low-risk extracted facts
agentranks review --reject-needs-review  Bulk-reject all needs_review facts
agentranks score                         Score AI-readiness (no LLM required)
agentranks generate                      Generate AI-readable output files
agentranks generate --strict             Publish approved facts only
agentranks generate --include-low        Include low-priority facts in output
```

---

## Contributing

This is an early-stage open-source project. Contributions welcome.

1. Fork [github.com/agentranks/agentranks](https://github.com/agentranks/agentranks)
2. Create a feature branch
3. Make your changes (with tests)
4. Open a pull request

---

## License

MIT
