# AgentRanks — Architecture

## Overview

AgentRanks is a pnpm TypeScript monorepo that scans a website, extracts structured business facts via an LLM, validates those facts, and publishes AI-readable output files.

## Package Dependency Graph

```
@agentranks/cli
    ├── @agentranks/core      (schemas, config, types)
    ├── @agentranks/crawler   (fetch + parse web pages)
    ├── @agentranks/ai        (LLM extraction)
    └── @agentranks/publisher (output generators)

@agentranks/crawler  → @agentranks/core
@agentranks/ai       → @agentranks/core
@agentranks/publisher → @agentranks/core
```

## Data Flow

```
agentranks init
└── Prompts user for config → saves agentranks/config.json

agentranks scan <url>
└── Fetcher (HTTP, rate-limited, respects robots.txt)
    └── Parser (Cheerio, extracts text + links)
        └── BFS Crawler (follows same-origin links up to maxPages)
            └── agentranks/pages.json

agentranks extract
└── Reads agentranks/pages.json
    └── For each page:
        └── LLM Client (OpenAI-compatible API)
            └── SYSTEM_PROMPT + page text → JSON facts
                └── Zod validation of LLM response
                    └── mergeExtractionResults (deduplication)
                        └── agentranks.facts.json

agentranks validate
└── Reads agentranks.facts.json
    └── Zod schema validation per fact
        └── Confidence + quality checks
            └── ValidationReport (printed to console)

agentranks generate
└── Reads agentranks.facts.json + agentranks/config.json
    └── buildAgentRanksOutput() → AgentRanksOutput object
        └── writeAllOutputs():
            ├── agentranks.json      (master structured output)
            ├── llms.txt            (llms.txt spec)
            ├── ai-profile.md
            ├── products.md
            ├── services.md
            ├── pricing.md
            ├── faqs.md
            ├── policies.md
            ├── use-cases.md
            ├── differentiators.md
            └── schema.json         (schema.org JSON-LD)

agentranks intents
└── Reads agentranks.facts.json + agentranks/config.json
    └── filterIntentFacts() → publishable facts only
        └── generateIntents() → IntentsOutput
            ├── grouping: use_case → USE_CASE_THEMES
            ├── grouping: service/product → SERVICE_THEMES
            ├── grouping: pricing → PRICING_THEMES
            ├── grouping: differentiator → DIFFERENTIATOR_THEMES
            ├── grouping: location → local brief
            ├── CTA inference (from fact keywords + sourceUrls)
            └── writes to agentranks-output/intents/:
                ├── intents.json    (structured brief data)
                ├── index.md        (brief overview table)
                ├── prompts.md      (AI prompt examples)
                └── <slug>.md       (one file per brief)

agentranks deploy
└── Reads agentranks-output/ + agentranks/config.json
    └── Checks publishingMode in intents/intents.json
        │   (blocks private_export unless --force)
        ├── Direct copies: llms.txt, agentranks.json, schema.json → agentranks-public/
        ├── Markdown → HTML: ai-profile, services, products, pricing,
        │   faqs, policies, use-cases, differentiators → agentranks-public/<page>/index.html
        │   (schema.org JSON-LD inlined in ai-profile, services, pricing, faqs)
        ├── Intents → HTML: intents/index.md, intents/prompts.md,
        │   intents/<slug>.md → agentranks-public/ai/intents/<slug>/index.html
        ├── Sitemap: all deployed URLs → agentranks-public/ai/sitemap.xml
        └── Deploy artifacts → agentranks/deploy/:
            ├── submit-urls.txt     (one URL per line)
            ├── robots-suggested.txt
            ├── deploy-report.md    (next steps)
            └── deploy.json         (machine-readable manifest)
```

## Key Design Decisions

### 1. OpenAI-Compatible HTTP API
The LLM client (`packages/ai/src/client.ts`) is a minimal fetch-based HTTP client
that works with any OpenAI-compatible endpoint. No SDK dependency — just HTTP.
Configure via environment variables:
- `AGENTRANKS_LLM_API_KEY`
- `AGENTRANKS_LLM_BASE_URL` (defaults to DeepSeek)
- `AGENTRANKS_LLM_MODEL`

### 2. Zod Everywhere
All data structures (Page, BusinessFact, AgentRanksConfig, LLM response) are validated
with Zod schemas at package boundaries. This catches:
- Malformed config files
- Invalid LLM responses
- Bad facts files

### 3. sourceUrl + confidence on Every Fact
Every `BusinessFact` carries:
- `sourceUrl` — the exact page the claim was extracted from
- `confidence` — 0.0–1.0 float assigned by the LLM

This prevents hallucination and provides provenance.

### 4. No Cloud, No Auth
This milestone is fully local. No SaaS dashboard, no database, no auth.
All state lives in:
- `agentranks/` — project config and crawl data
- `agentranks.facts.json` — extracted facts
- `agentranks-output/` — generated files

### 5. Idempotent Commands
Each command can be re-run safely:
- `scan` overwrites `pages.json`
- `extract` overwrites `agentranks.facts.json`
- `generate` overwrites all output files
- `intents` overwrites `agentranks-output/intents/` on every run; use `--refresh` to see what changed

### 6. AI Intent Pages — Design Principles
`agentranks intents` generates source-backed recommendation pages from the fact graph without calling an LLM:

- **Deterministic** — same facts always produce the same briefs (contentHash tracks this)
- **Transparent** — every claim links to its `sourceUrl` and `evidenceText`
- **Human-accessible** — all generated pages are honest documents, not hidden crawler content
- **Same content for all** — if hosted, humans and AI crawlers must see the same page
- **Publishing mode** — `private_export` (default), `public_indexable`, or `public_noindex` is declared in the brief metadata. The deploy step can translate that metadata into HTML robots tags when explicitly requested (e.g. `--include-noindex` sets `noindex, follow` for `public_noindex` pages); without that flag, tag insertion is the responsibility of the hosting layer
- **Safety:** AgentRanks does not generate hidden crawler-only pages or serve different content to AI vs. humans

### 7. Fact Publishability Modes

All fact filtering across the codebase goes through a single predicate:

```typescript
// packages/publisher/src/utils/publish.ts
isFactPublishable(fact, { mode, strict?, includeLow? })
```

There are three modes, each applying a different publishability gate:

#### `mode: "generate"`
Used by `agentranks generate` when building `agentranks.json`, `llms.txt`, and Markdown pages.

- **Includes** extracted facts that are low-risk (`riskLevel: "low"`), regardless of approval status.
- **Includes** approved facts at any risk level — strict human approval overrides risk status for normal business output.
- **Excludes** `needs_review` and `rejected` facts (always).
- **Excludes** low-priority (`publishPriority: "low"` or `"legal"`) facts by default; pass `--include-low` to include them.
- **`--strict` flag**: restricts output to explicitly approved facts only; extracted+low-risk facts are excluded.

#### `mode: "intents"`
Used by `agentranks intents` when building AI Intent Pages.

- **Includes** approved facts with `riskLevel: "low"` or `"medium"`.
- **Includes** extracted facts that are low-risk (`riskLevel: "low"`) with `publishPriority: "core"` or `"supporting"`.
- **Excludes** high-risk facts even if approved — intent pages are public conversion/recommendation pages and must be conservative.
- **Excludes** low-priority and legal-priority facts unconditionally.
- **Excludes** `needs_review` and `rejected` facts (always).
- `strict` and `includeLow` options have no effect in this mode.

#### `mode: "score"`
Used by `agentranks score` when counting publishable facts for the readiness score.

- Follows the same gate as `"intents"` (intent-safe publishability).
- High-risk facts do not count toward the score even if approved, ensuring the score reflects what would actually be published.
- `strict` and `includeLow` options have no effect in this mode.

#### Always excluded (all modes)
| Status | Reason |
|---|---|
| `needs_review` | Fact requires human decision before any publication. |
| `rejected` | Fact was explicitly rejected by a reviewer. |

#### Summary table

| Fact state | `generate` | `generate --strict` | `generate --include-low` | `intents` / `score` |
|---|---|---|---|---|
| approved, low-risk, core | ✅ | ✅ | ✅ | ✅ |
| approved, high-risk, core | ✅ | ✅ | ✅ | ❌ |
| extracted, low-risk, core | ✅ | ❌ | ✅ | ✅ |
| extracted, medium-risk, core | ❌ | ❌ | ❌ | ❌ |
| approved, low-priority | ❌ | ❌ | ✅ | ❌ |
| needs\_review | ❌ | ❌ | ❌ | ❌ |
| rejected | ❌ | ❌ | ❌ | ❌ |

### 8. Deploy — Design Principles
`agentranks deploy` converts the `agentranks-output/` folder into a website-ready static folder:

- **No LLM required** — pure file transformation (Markdown → HTML via `marked`)
- **No automatic submission** — does not submit to Google, Bing, or any indexing API
- **Does not touch existing files** — `--clean` only removes AgentRanks-generated paths, never unrelated files
- **Same content for humans and crawlers** — generated HTML is an honest document accessible via URL
- **Canonical URLs match sitemap** — every page's canonical link exactly matches its sitemap entry
- **Pinned `marked` dependency** — exact version declared in `package.json` for reproducible builds
- **Trailing-slash URLs** — all deployed page URLs consistently use trailing slashes
- **Private export guard** — briefs with `publishingMode: "private_export"` are blocked unless `--force` is passed; error message explains how to fix

## File Structure

```
agentranks/
├── packages/
│   ├── core/src/
│   │   ├── schemas.ts       All Zod schemas and TypeScript types
│   │   ├── config.ts        Config load/save/resolve utilities
│   │   └── index.ts
│   ├── crawler/src/
│   │   ├── fetcher.ts       Rate-limited HTTP fetcher
│   │   ├── parser.ts        Cheerio HTML → text/links
│   │   ├── crawler.ts       BFS site crawler
│   │   └── index.ts
│   ├── ai/src/
│   │   ├── client.ts           OpenAI-compatible HTTP chat client
│   │   ├── prompts.ts          System and user prompts
│   │   ├── extractor/
│   │   │   ├── patterns.ts     Regex constants for risk/category detection
│   │   │   ├── postprocess.ts  Risk/priority enrichment + fact deduplication
│   │   │   ├── extract.ts      LLM call → raw BusinessFact[]
│   │   │   ├── merge.ts        mergeExtractionResults (deduplication)
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── publisher/src/
│   │   ├── utils/
│   │   │   └── publish.ts      Single source of truth for fact publishability
│   │   ├── generators/
│   │   │   ├── agentranks-json.ts   Builds AgentRanksOutput + filterPublishableFacts
│   │   │   ├── llms-txt.ts         llms.txt generator
│   │   │   ├── markdown.ts         All Markdown file generators
│   │   │   ├── schema-jsonld.ts    schema.org JSON-LD generator
│   │   │   ├── intents/
│   │   │   │   ├── types.ts        All intent-related TypeScript types
│   │   │   │   ├── themes.ts       Theme constants (USE_CASE, SERVICE, PRICING, …)
│   │   │   │   ├── filters.ts      filterIntentFacts (delegates to publish.ts intents mode)
│   │   │   │   ├── refresh.ts      slugify, computeContentHash, computeRefreshStats
│   │   │   │   ├── generator.ts    generateIntents, CTA inference, theme scoring
│   │   │   │   ├── prompt-match.ts generateIntentsFromPrompts (--prompts-file)
│   │   │   │   ├── markdown.ts     buildBriefMd, buildIndexMd, buildPromptsMd
│   │   │   │   └── index.ts
│   │   │   └── deploy/
│   │   │       ├── types.ts        DeployOptions, DeployResult
│   │   │       ├── paths.ts        AGENTRANKS_GENERATED_PATHS, CORE_MD_PAGES
│   │   │       ├── markdown-html.ts  mdToHtml, buildHtml, extractTitle, escapeHtml
│   │   │       ├── sitemap.ts      buildSitemap
│   │   │       ├── robots.ts       buildRobotsSuggested
│   │   │       ├── report.ts       buildDeployReport
│   │   │       └── index.ts        runDeploy orchestration
│   │   └── index.ts                validateFacts, writeAllOutputs, all public re-exports
│   └── cli/src/
│       ├── utils/
│       │   └── load.ts     loadJsonFile, loadFacts, loadPages (centralised I/O)
│       ├── commands/
│       │   ├── init.ts         Interactive project setup + .gitignore management
│       │   ├── scan.ts         Website crawl
│       │   ├── extract.ts      LLM fact extraction
│       │   ├── validate.ts     Zod validation report
│       │   ├── review.ts       Human fact review workflow
│       │   ├── score/
│       │   │   ├── types.ts    CategoryScores, ScoreReport, SECTIONS
│       │   │   ├── logic.ts    computeScore, all category scoring functions
│       │   │   ├── report.ts   buildScoreMd, printScoreReport
│       │   │   └── index.ts    runScore
│       │   ├── generate.ts     Output file generation
│       │   ├── intents.ts      AI Intent Page generation
│       │   ├── deploy.ts       Static deploy (agentranks-output → agentranks-public)
│       │   ├── submit.ts       IndexNow URL submission
│       │   └── quickstart.ts   Chain init→scan→extract→…→deploy
│       └── index.ts            Commander CLI entry
```
