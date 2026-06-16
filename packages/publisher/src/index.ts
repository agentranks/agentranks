import fs from "fs";
import path from "path";
import {
  AgentRanksOutput,
  BusinessFact,
  ValidationReport,
  ValidationIssue,
  BusinessFactSchema,
} from "@agentranks/core";
import { generateLlmsTxt } from "./generators/llms-txt.js";
import { generateMarkdownFiles } from "./generators/markdown.js";
import { generateSchemaJsonLd } from "./generators/schema-jsonld.js";

export { buildAgentRanksOutput, filterPublishableFacts } from "./generators/agentranks-json.js";
export type { PublishFilter, PublishStats } from "./generators/agentranks-json.js";
export { generateLlmsTxt } from "./generators/llms-txt.js";
export { generateMarkdownFiles } from "./generators/markdown.js";
export type { MarkdownFiles } from "./generators/markdown.js";
export { generateSchemaJsonLd } from "./generators/schema-jsonld.js";
export type { SchemaOrgOutput } from "./generators/schema-jsonld.js";
export {
  generateIntents,
  generateIntentsFromPrompts,
  filterIntentFacts,
  computeContentHash,
  computeRefreshStats,
  slugify,
  buildBriefMd,
  buildIndexMd,
  buildPromptsMd,
  generateRetrievalVocabulary,
} from "./generators/intents/index.js";
export type { GenerateRetrievalVocabularyOptions } from "./generators/intents/index.js";
export {
  runDeploy,
  buildHtml,
  buildSitemap,
  buildRobotsSuggested,
  buildDeployReport,
  extractTitle,
  mdToHtml,
  AGENTRANKS_GENERATED_PATHS,
} from "./generators/deploy/index.js";
export type { DeployOptions, DeployResult } from "./generators/deploy/index.js";
export type {
  PublishingMode,
  IntentType,
  BriefSourceType,
  CtaActionType,
  CtaAudience,
  CtaSourceType,
  PromptType,
  PromptExample,
  IntentCta,
  IntentFact,
  IntentBrief,
  IntentsOutput,
  GenerateIntentsOptions,
  RefreshStats,
  SkippedPrompt,
  PromptsFileBriefResult,
  RetrievalVocabulary,
  RetrievalTerm,
  RetrievalTermSource,
  ImportedRetrievalTerm,
} from "./generators/intents/index.js";
export { isFactPublishable, filterFacts } from "./utils/publish.js";
export type { PublishabilityMode, PublishabilityOptions } from "./utils/publish.js";

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateFacts(facts: BusinessFact[]): ValidationReport {
  const now = new Date().toISOString();
  const issues: ValidationIssue[] = [];
  let validFacts = 0;

  for (const fact of facts) {
    const result = BusinessFactSchema.safeParse(fact);
    if (result.success) {
      validFacts++;
    } else {
      for (const err of result.error.errors) {
        issues.push({
          factId: fact.id ?? "unknown",
          field: err.path.join("."),
          message: err.message,
          severity: "error",
        });
      }
    }

    // Warn on very low confidence
    if (typeof fact.confidence === "number" && fact.confidence < 0.5) {
      issues.push({
        factId: fact.id,
        field: "confidence",
        message: `Low confidence (${fact.confidence}): consider reviewing this claim`,
        severity: "warning",
      });
    }

    // Warn on very short claims
    if (fact.claim && fact.claim.length < 10) {
      issues.push({
        factId: fact.id,
        field: "claim",
        message: `Claim is very short (${fact.claim.length} chars): may lack useful information`,
        severity: "warning",
      });
    }
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    totalFacts: facts.length,
    validFacts,
    issues,
    checkedAt: now,
  };
}

// ─── File writing ─────────────────────────────────────────────────────────────

export interface WriteOutputOptions {
  outputDir: string;
  output: AgentRanksOutput;
}

export function writeAllOutputs(opts: WriteOutputOptions): string[] {
  const { outputDir, output } = opts;
  const written: string[] = [];

  fs.mkdirSync(outputDir, { recursive: true });

  // agentranks.json
const agentRanksJsonPath = path.join(outputDir, "agentranks.json");
    fs.writeFileSync(agentRanksJsonPath, JSON.stringify(output, null, 2) + "\n", "utf-8");
    written.push(agentRanksJsonPath);

  // llms.txt
  const llmsTxtPath = path.join(outputDir, "llms.txt");
  fs.writeFileSync(llmsTxtPath, generateLlmsTxt(output), "utf-8");
  written.push(llmsTxtPath);

  // Markdown files
  const markdownFiles = generateMarkdownFiles(output);
  for (const [filename, content] of Object.entries(markdownFiles)) {
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, content, "utf-8");
    written.push(filePath);
  }

  // schema.json (JSON-LD)
  const schemaPath = path.join(outputDir, "schema.json");
  const schemaOutput = generateSchemaJsonLd(output);
  fs.writeFileSync(schemaPath, JSON.stringify(schemaOutput, null, 2) + "\n", "utf-8");
  written.push(schemaPath);

  return written;
}
