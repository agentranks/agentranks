# Contributing to AgentRanks

Thank you for your interest in contributing. AgentRanks Core is the open-source engine behind the AgentRanks toolkit.

## Repository structure

```
agentranks/
├── packages/
│   ├── core/        @agentranks/core       — schemas, config, types
│   ├── crawler/     @agentranks/crawler    — website crawling
│   ├── ai/          @agentranks/ai         — LLM fact extraction
│   ├── publisher/   @agentranks/publisher  — output generation
│   └── cli/         agentranks             — CLI entry point
├── docs/            — documentation
├── examples/        — example outputs
└── .github/         — CI workflows
```

## Prerequisites

- Node.js >= 20
- pnpm >= 9

## Setup

```bash
git clone https://github.com/agentranks/agentranks.git
cd agentranks
pnpm install
pnpm build
pnpm test
```

## Development workflow

```bash
# Build all packages
pnpm build

# Run all tests
pnpm test

# Run tests for a specific package
cd packages/cli
pnpm test

# Run the CLI from source
node packages/cli/dist/index.js --help
```

## Code conventions

- **TypeScript strict mode** — no `any`, no `@ts-ignore` without justification
- **Domain logic in packages** — business logic lives in `packages/`, not in CLI command files
- **No `process.exit` in domain functions** — throw readable errors instead
- **No console output in domain functions** — return data; CLI commands print
- **Deterministic generators** — no LLM calls in retrieval vocabulary or scoring
- **Zod schemas for all public types** — runtime validation is first class
- **Tests for new features** — use Node.js built-in test runner (`node:test`)

## Adding a new feature

1. Add types/schemas to `packages/core/src/schemas.ts` if they are cross-package
2. Implement logic in the appropriate package (`publisher`, `crawler`, etc.)
3. Export from the package's `index.ts`
4. Wire into the CLI command if needed (CLI should orchestrate, not own logic)
5. Add tests in `packages/<name>/src/__tests__/`
6. Update `docs/cli-reference.md` and `docs/architecture.md` as needed

## Retrieval vocabulary rules

The retrieval vocabulary system is deterministic — no LLM calls, no live fetching.

- Terms come only from publishable facts (approved or extracted+low-risk+core/supporting)
- Controlled synonym mappings in `packages/publisher/src/generators/intents/retrieval.ts`
- New mappings require justification in the PR description
- No vague terms, no keyword stuffing, no hidden content
- All terms must be derivable from source facts

## Submitting a pull request

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make changes and add tests
4. Run `pnpm build && pnpm test` — both must pass
5. Open a pull request with a clear description of the change

## What belongs in Core vs Cloud

| Feature | Core | Cloud |
|---------|------|-------|
| Deterministic fact extraction | Yes | — |
| Retrieval vocabulary from facts | Yes | — |
| Scoring and validation | Yes | — |
| Static site generation | Yes | — |
| IndexNow submission | Yes | — |
| Auth / billing / multi-user | No | Yes |
| Search Console / Bing signals | No | Yes |
| Trend scores | No | Yes |
| Competitor vocabulary | No | Yes |
| Scheduled refresh | No | Yes |
| Monitoring / audit | No | Yes |

Do not add Cloud features to Core.

## License

By contributing, you agree that your contributions are licensed under the MIT License.

Copyright (c) 2026 Marcel Eb
