// ─── AgentRanks-generated paths ────────────────────────────────────────────────

/**
 * Paths (relative to targetDir) that AgentRanks generates and may clean.
 * Never includes the whole target directory to avoid destroying unrelated files.
 */
export const AGENTRANKS_GENERATED_PATHS = [
  "llms.txt",
  "agentranks.json",
  "schema.json",
  "ai-profile",
  "services",
  "products",
  "pricing",
  "faqs",
  "policies",
  "use-cases",
  "differentiators",
  "ai",
];

// ─── Core Markdown pages ──────────────────────────────────────────────────────

export interface CoreMdPage {
  file: string;
  urlPath: string;
  inlineSchema: boolean;
}

export const CORE_MD_PAGES: CoreMdPage[] = [
  { file: "ai-profile.md",      urlPath: "ai-profile/",      inlineSchema: true },
  { file: "services.md",        urlPath: "services/",         inlineSchema: true },
  { file: "products.md",        urlPath: "products/",         inlineSchema: false },
  { file: "pricing.md",         urlPath: "pricing/",          inlineSchema: true },
  { file: "faqs.md",            urlPath: "faqs/",             inlineSchema: true },
  { file: "policies.md",        urlPath: "policies/",         inlineSchema: false },
  { file: "use-cases.md",       urlPath: "use-cases/",        inlineSchema: false },
  { file: "differentiators.md", urlPath: "differentiators/",  inlineSchema: false },
];

// ─── Files copied verbatim to the deploy target ───────────────────────────────

export const DIRECT_COPY_FILES = ["llms.txt", "agentranks.json", "schema.json"];
