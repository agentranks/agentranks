import type { RetrievalVocabulary } from "@agentranks/core";

// Re-export for consumers who import from this module directly
export type { RetrievalVocabulary, RetrievalTerm, RetrievalTermSource, ImportedRetrievalTerm } from "@agentranks/core";

// ─── Public intent types ──────────────────────────────────────────────────────

export type PublishingMode = "private_export" | "public_indexable" | "public_noindex";

export type IntentType =
  | "service_need"
  | "use_case"
  | "budget_or_pricing"
  | "comparison"
  | "local"
  | "product"
  | "marketplace"
  | "offer"
  | "category"
  | "general";

export type CtaActionType =
  | "visit_website"
  | "book_call"
  | "start_trial"
  | "contact_sales"
  | "view_pricing"
  | "request_demo"
  | "sign_up"
  | "view_merchant"
  | "view_product"
  | "browse_category"
  | "claim_offer"
  | "view_offer"
  | "request_quote"
  | "compare_options"
  | "browse_catalog";

export type CtaAudience = "buyer" | "merchant" | "developer" | "agent";

export type PromptType =
  | "problem_aware"
  | "solution_aware"
  | "comparison"
  | "budget_concern"
  | "urgency"
  | "risk_reduction"
  | "action_ready";

export interface PromptExample {
  prompt: string;
  promptType: PromptType;
}

export type CtaSourceType = "config" | "fact";

export type BriefSourceType = "auto" | "prompts_file";

export interface IntentCta {
  label: string;
  url: string;
  actionType: CtaActionType;
  fallbackUrl: string;
  audience: CtaAudience;
  /** How this CTA URL was determined. */
  ctaSourceType: CtaSourceType;
  ctaSourceFactId?: string;
  ctaSourceUrl?: string;
}

export interface IntentFact {
  claim: string;
  sourceUrl: string;
  evidenceText: string;
}

export interface IntentBrief {
  id: string;
  slug: string;
  title: string;
  intentType: IntentType;
  sourceFactIds: string[];
  sourceCategories: string[];
  userSituations: string[];
  whyRelevant: string[];
  bestFitFacts: IntentFact[];
  buyerAction: string;
  cta: IntentCta;
  promptExamples: PromptExample[];
  publishingMode: PublishingMode;
  outputPath: string;
  lastGeneratedAt: string;
  contentHash: string;
  retrievalVocabulary: RetrievalVocabulary;
  sourceType?: BriefSourceType;
  sourcePrompt?: string;
  matchScore?: number;
}

export interface IntentsOutput {
  generatedAt: string;
  business: { name: string; url: string };
  publishingMode: PublishingMode;
  briefs: IntentBrief[];
}

export interface GenerateIntentsOptions {
  publishingMode?: PublishingMode;
  maxBriefs?: number;
}

export interface RefreshStats {
  unchanged: number;
  changed: number;
  newBriefs: number;
  removed: number;
}

export interface SkippedPrompt {
  prompt: string;
  reason: string;
}

export interface PromptsFileBriefResult {
  briefs: IntentBrief[];
  skipped: SkippedPrompt[];
}
