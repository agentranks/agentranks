# Programmatic Usage — AgentRanks Core Engine

AgentRanks is designed so the business logic lives in workspace packages (`@agentranks/core`, `@agentranks/crawler`, `@agentranks/ai`, `@agentranks/publisher`), not in the CLI layer. This lets you consume the Core engine from another Node.js project — including AgentRanks Cloud — without going through the CLI.

## Stable surface

The following functions and types are the stable programmatic API:

```ts
// @agentranks/crawler
scanWebsite(config: AgentRanksConfig): Promise<Page[]>

// @agentranks/ai
extractFacts(pages: Page[], config: AgentRanksConfig): Promise<ExtractionResult[]>

// @agentranks/publisher
validateFacts(facts: BusinessFact[]): ValidationReport
computeScore(facts: BusinessFact[]): ScoreResult           // via CLI score/logic.ts
generateOutputs(opts: WriteOutputOptions): string[]        // writeAllOutputs
generateIntents(facts, config, opts?): IntentsOutput
generateIntentsFromPrompts(prompts, facts, config, opts?): PromptsFileBriefResult
generateRetrievalVocabulary(opts: GenerateRetrievalVocabularyOptions): RetrievalVocabulary
deployOutputs(opts: DeployOptions): Promise<DeployResult>
buildIndexNowPayload(urls: string[], key: string): object  // in submit command
```

## Contracts for reusable functions

- **Never call `process.exit`** — domain functions throw typed errors instead.
- **No console output** — functions return data; callers decide how to print.
- **Throw readable errors** — errors include a human-readable `message`.
- **Pure where possible** — generators are deterministic given the same inputs.

## Option 1 — Bundled CLI (end users)

End users install the published `agentranks` package:

```bash
npm install -g agentranks
agentranks quickstart https://yourcompany.com
```

The CLI bundles all workspace packages into `dist/index.js` via tsup. No separate package publishing is required.

## Option 2 — Local workspace import (private Cloud integration)

For AgentRanks Cloud (or any private Node project in the same pnpm workspace), add a workspace dependency:

```json
// your-cloud-app/package.json
{
  "dependencies": {
    "@agentranks/core":      "workspace:*",
    "@agentranks/crawler":   "workspace:*",
    "@agentranks/ai":        "workspace:*",
    "@agentranks/publisher": "workspace:*"
  }
}
```

Then import directly:

```ts
import { scanWebsite } from "@agentranks/crawler";
import { extractFacts } from "@agentranks/ai";
import {
  validateFacts,
  generateIntents,
  generateRetrievalVocabulary,
  writeAllOutputs,
} from "@agentranks/publisher";
import { loadConfig } from "@agentranks/core";
```

## Option 3 — Future separate package publishing

In the future, workspace packages may be published independently as:

- `@agentranks/core`
- `@agentranks/publisher`
- `@agentranks/crawler`
- `@agentranks/ai`

This is not done yet. Until then, use workspace imports (Option 2) for private Cloud integration.

## Example: run the full pipeline programmatically

```ts
import { loadConfig } from "@agentranks/core";
import { scanWebsite } from "@agentranks/crawler";
import { extractFacts } from "@agentranks/ai";
import {
  validateFacts,
  writeAllOutputs,
  generateIntents,
  buildAgentRanksOutput,
  filterPublishableFacts,
} from "@agentranks/publisher";

async function runPipeline(configPath: string) {
  const config = await loadConfig(configPath);

  // 1. Crawl
  const pages = await scanWebsite(config);

  // 2. Extract facts via LLM
  const results = await extractFacts(pages, config);
  const allFacts = results.flatMap((r) => r.facts);

  // 3. Validate
  const report = validateFacts(allFacts);
  if (!report.valid) {
    throw new Error(`Validation failed: ${report.issues.length} errors`);
  }

  // 4. Generate outputs
  const output = buildAgentRanksOutput(config, allFacts);
  const outputDir = config.output?.dir ?? "agentranks-output";
  const written = writeAllOutputs({ outputDir, output });

  // 5. Generate intent briefs
  const intentsOutput = generateIntents(allFacts, config, {
    publishingMode: "public_indexable",
  });

  return { written, intentsOutput };
}
```

## Example: generate retrieval vocabulary standalone

```ts
import { generateRetrievalVocabulary } from "@agentranks/publisher";

const vocab = generateRetrievalVocabulary({
  facts: publishableFacts,
  businessName: "Knacksters",
  intentTheme: "Customer Success Support",
  promptTexts: ["I need a CSM without a full-time hire"],
});

console.log(vocab.primaryTerms);  // [{ value: "customer success", source: "fact", ... }]
console.log(vocab.relatedTerms);  // [{ value: "CSM", source: "controlled_mapping", ... }]
console.log(vocab.entities);      // [{ value: "Knacksters", source: "fact", ... }]
console.log(vocab.semanticVariants); // [{ value: "customer success help without ...", ... }]
```

## Cloud integration boundary

AgentRanks Cloud extends Core with:

| Feature | Core | Cloud |
|---------|------|-------|
| Deterministic retrieval vocabulary | Yes | — |
| LLM fact extraction | Yes (local) | Yes (managed) |
| Search Console terms | No | Yes |
| Bing query data | No | Yes |
| Trend scores | No | Yes |
| Competitor vocabulary | No | Yes |
| Scheduled refresh | No | Yes |
| Auth / billing | No | Yes |
| Monitoring / audit | No | Yes |

Cloud imports `ImportedRetrievalTerm` from Core for future vocabulary merging:

```ts
import type { ImportedRetrievalTerm } from "@agentranks/core";

// Cloud supplies these; Core does not fetch them
const cloudTerms: ImportedRetrievalTerm[] = [
  { value: "contract-to-hire CSM", type: "primary", demandScore: 0.87 },
  { value: "fractional customer success", type: "related", trendScore: 0.72 },
];
```

Core only provides the deterministic baseline. Cloud merges its live signals on top.
