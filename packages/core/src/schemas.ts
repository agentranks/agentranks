import { z } from "zod";

// ─── Page ─────────────────────────────────────────────────────────────────────

export const PageSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
  html: z.string(),
  text: z.string(),
  links: z.array(z.string()),
  crawledAt: z.string().datetime(),
  statusCode: z.number().int(),
});

export type Page = z.infer<typeof PageSchema>;

// ─── Business Facts ───────────────────────────────────────────────────────────

export const FactCategorySchema = z.enum([
  "company_profile",
  "product",
  "service",
  "pricing",
  "faq",
  "policy",
  "use_case",
  "differentiator",
  "competitor",
  "location",
  "integration",
  "claim",
  "limitation",
  "proof_point",
]);

export type FactCategory = z.infer<typeof FactCategorySchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const FactStatusSchema = z.enum(["extracted", "approved", "needs_review", "rejected"]);
export type FactStatus = z.infer<typeof FactStatusSchema>;

export const PublishPrioritySchema = z.enum(["core", "supporting", "legal", "low"]);
export type PublishPriority = z.infer<typeof PublishPrioritySchema>;

export const BusinessFactSchema = z.object({
  id: z.string(),
  category: FactCategorySchema,
  claim: z.string().min(1, "Claim must not be empty"),
  detail: z.string().optional(),
  evidenceText: z.string().min(1, "evidenceText must not be empty"),
  sourceUrl: z.string().url("sourceUrl must be a valid URL"),
  confidence: z
    .number()
    .min(0, "Confidence must be >= 0")
    .max(1, "Confidence must be <= 1"),
  riskLevel: RiskLevelSchema,
  status: FactStatusSchema,
  publishPriority: PublishPrioritySchema,
  extractedAt: z.string().datetime(),
  tags: z.array(z.string()).optional(),
});

export type BusinessFact = z.infer<typeof BusinessFactSchema>;

// ─── Content Gaps ─────────────────────────────────────────────────────────────

export const ContentGapSchema = z.object({
  type: z.enum(["missing_faq_answer", "weak_evidence", "incomplete_claim"]),
  question: z.string().optional(),
  claim: z.string().optional(),
  sourceUrl: z.string().url(),
  evidenceText: z.string().optional(),
  detectedAt: z.string().datetime(),
});

export type ContentGap = z.infer<typeof ContentGapSchema>;

// ─── LLM Raw Response ─────────────────────────────────────────────────────────

// RawFact uses z.string() for category so per-fact filtering handles invalid values
// rather than failing the entire page on schema validation.
export const RawFactSchema = z.object({
  category: z.string(),
  claim: z.string().min(1),
  detail: z.string().optional(),
  evidenceText: z.string().optional(),
  confidence: z.number().min(0).max(1),
  riskLevel: RiskLevelSchema.optional(),
  status: FactStatusSchema.optional(),
  publishPriority: PublishPrioritySchema.optional(),
  tags: z.array(z.string()).optional(),
});

export type RawFact = z.infer<typeof RawFactSchema>;

export const LLMExtractionResponseSchema = z.object({
  facts: z.array(z.unknown()),
});

export type LLMExtractionResponse = z.infer<typeof LLMExtractionResponseSchema>;

// ─── Extraction Result ────────────────────────────────────────────────────────

export const ExtractionResultSchema = z.object({
  sourceUrl: z.string().url(),
  facts: z.array(BusinessFactSchema),
  contentGaps: z.array(ContentGapSchema).optional(),
  extractedAt: z.string().datetime(),
  model: z.string(),
  pageTitle: z.string().optional(),
  error: z.string().optional(),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ─── Config ───────────────────────────────────────────────────────────────────

export const LLMConfigSchema = z.object({
  baseUrl: z.string().url().default("https://api.deepseek.com/v1"),
  model: z.string().default("deepseek-v4-pro"),
  apiKey: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).default(0.2),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

export const AgentRanksConfigSchema = z.object({
  version: z.string().default("1"),
  baseUrl: z.string().url(),
  name: z.string().min(1),
  description: z.string().optional(),
  maxPages: z.number().int().positive().default(50),
  crawlDelay: z.number().int().nonnegative().default(500),
  includePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
  llm: LLMConfigSchema.optional(),
  output: z
    .object({
      dir: z.string().default("agentranks-output"),
    })
    .optional(),
  createdAt: z.string().datetime().optional(),
});

export type AgentRanksConfig = z.infer<typeof AgentRanksConfigSchema>;

// ─── Master Output ────────────────────────────────────────────────────────────

export const AgentRanksOutputSchema = z.object({
  version: z.string(),
  generatedAt: z.string().datetime(),
  business: z.object({
    name: z.string(),
    url: z.string().url(),
    description: z.string().optional(),
  }),
  facts: z.array(BusinessFactSchema),
  summary: z.object({
    totalFacts: z.number().int(),
    byCategory: z.record(z.string(), z.number()),
    avgConfidence: z.number(),
    sourceUrls: z.array(z.string()),
    pagesScanned: z.number().int(),
  }),
});

export type AgentRanksOutput = z.infer<typeof AgentRanksOutputSchema>;

// ─── Retrieval Vocabulary ─────────────────────────────────────────────────────

export const RetrievalTermSourceSchema = z.enum([
  "fact",
  "tag",
  "theme",
  "prompt",
  "controlled_mapping",
]);

export type RetrievalTermSource = z.infer<typeof RetrievalTermSourceSchema>;

export const RetrievalTermSchema = z.object({
  value: z.string().min(1),
  source: RetrievalTermSourceSchema,
  sourceFactIds: z.array(z.string()),
});

export type RetrievalTerm = z.infer<typeof RetrievalTermSchema>;

export const RetrievalVocabularySchema = z.object({
  primaryTerms: z.array(RetrievalTermSchema),
  relatedTerms: z.array(RetrievalTermSchema),
  entities: z.array(RetrievalTermSchema),
  semanticVariants: z.array(RetrievalTermSchema),
});

export type RetrievalVocabulary = z.infer<typeof RetrievalVocabularySchema>;

/**
 * Shape for vocabulary imported from AgentRanks Cloud.
 * Core does not fetch live data; Cloud supplies this externally.
 */
export const ImportedRetrievalTermSchema = z.object({
  value: z.string().min(1),
  type: z.enum(["primary", "related", "entity", "semantic_variant"]).optional(),
  sourceName: z.string().optional(),
  demandScore: z.number().min(0).max(1).optional(),
  trendScore: z.number().min(0).max(1).optional(),
});

export type ImportedRetrievalTerm = z.infer<typeof ImportedRetrievalTermSchema>;

// ─── Validation Report ────────────────────────────────────────────────────────

export const ValidationIssueSchema = z.object({
  factId: z.string(),
  field: z.string(),
  message: z.string(),
  severity: z.enum(["error", "warning"]),
});

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const ValidationReportSchema = z.object({
  valid: z.boolean(),
  totalFacts: z.number().int(),
  validFacts: z.number().int(),
  issues: z.array(ValidationIssueSchema),
  checkedAt: z.string().datetime(),
});

export type ValidationReport = z.infer<typeof ValidationReportSchema>;
