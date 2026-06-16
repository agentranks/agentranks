# AgentRanks — File Plan

## Overview
AgentRanks is a pnpm TypeScript monorepo CLI + package suite that helps businesses create an AI-readable source of truth by scanning a website, extracting structured business facts, validating them, and generating AI-readable outputs.

## Repository Structure

```
agentranks/
├── package.json                    # Root workspace package
├── pnpm-workspace.yaml             # pnpm workspace config
├── tsconfig.base.json              # Shared TypeScript config
├── .env.example                    # Environment variable template
├── .gitignore
├── README.md
│
├── packages/
│   ├── core/                       # Shared schemas, types, config
│   │   └── src/
│   │       ├── schemas.ts          # All Zod schemas
│   │       ├── config.ts           # Config loading/saving
│   │       └── index.ts
│   │
│   ├── crawler/                    # Website crawler
│   │   └── src/
│   │       ├── fetcher.ts          # HTTP fetching with rate limiting
│   │       ├── parser.ts           # Cheerio HTML parser
│   │       ├── crawler.ts          # BFS site crawler
│   │       └── index.ts
│   │
│   ├── ai/                         # LLM extraction
│   │   └── src/
│   │       ├── client.ts           # OpenAI-compatible HTTP client
│   │       ├── prompts.ts          # Extraction prompts
│   │       ├── extractor.ts        # Fact extraction logic
│   │       └── index.ts
│   │
│   ├── publisher/                  # Output generators
│   │   └── src/
│   │       ├── generators/
│   │       │   ├── agentranks-json.ts
│   │       │   ├── llms-txt.ts
│   │       │   ├── markdown.ts     # All markdown files
│   │       │   └── schema-jsonld.ts
│   │       └── index.ts
│   │
│   └── cli/                        # Commander CLI
│       └── src/
│           ├── commands/
│           │   ├── init.ts         # agentranks init
│           │   ├── scan.ts         # agentranks scan <url>
│           │   ├── extract.ts      # agentranks extract
│           │   ├── validate.ts     # agentranks validate
│           │   └── generate.ts     # agentranks generate
│           └── index.ts            # CLI entry point
│
├── examples/
│   └── basic/
│       ├── agentranks.config.json
│       └── README.md
│
└── docs/
    ├── architecture.md
    └── cli-reference.md
```

## Data Flow

```
agentranks init
  → agentranks/config.json (created interactively)

agentranks scan https://example.com
  → crawls pages (BFS, respects robots.txt, rate limiting)
  → agentranks/pages.json (array of Page objects)

agentranks extract
  → reads agentranks/pages.json
  → sends each page to LLM for fact extraction
  → agentranks.facts.json (array of BusinessFact objects)

agentranks validate
  → reads agentranks.facts.json
  → validates each fact with Zod
  → prints validation report

agentranks generate
  → reads agentranks.facts.json + config
  → generates agentranks-output/ (all files)
```

## Key Schemas (Zod)
- `PageSchema` — crawled page data
- `BusinessFactSchema` — single extracted fact with sourceUrl + confidence
- `AgentRanksConfigSchema` — project config
- `AgentRanksOutputSchema` — agentranks.json structure (artifact name preserved)

## Outputs
| File | Description |
|------|-------------|
| `agentranks/pages.json` | Raw crawled pages |
| `agentranks.facts.json` | Extracted + validated business facts |
| `agentranks-output/agentranks.json` | Master structured output |
| `agentranks-output/llms.txt` | LLM-friendly plain text |
| `agentranks-output/ai-profile.md` | Company overview for AI |
| `agentranks-output/products.md` | Products catalog |
| `agentranks-output/services.md` | Services list |
| `agentranks-output/pricing.md` | Pricing information |
| `agentranks-output/faqs.md` | FAQ answers |
| `agentranks-output/policies.md` | Company policies |
| `agentranks-output/use-cases.md` | Use cases |
| `agentranks-output/differentiators.md` | Unique value propositions |
| `agentranks-output/schema.json` | schema.org JSON-LD |
