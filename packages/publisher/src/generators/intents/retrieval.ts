import { BusinessFact, RetrievalTerm, RetrievalVocabulary } from "@agentranks/core";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Acronyms that must be preserved as-is (case-sensitive output). */
const PRESERVED_ACRONYMS = new Set([
  "AI", "API", "CSM", "SaaS", "DevOps", "UI", "UX", "CX", "HR",
  "SEO", "CRM", "ERP", "B2B", "B2C", "ROI", "KPI", "OKR", "MVP",
  "SDK", "SLA", "NPS", "ARR", "MRR", "PLG", "GTM",
]);

/**
 * Controlled synonym/abbreviation mappings.
 * Keys are concept triggers (lowercase); values are mapped terms.
 * Only applied when the source facts actually support the concept.
 */
const CONTROLLED_MAPPINGS: Array<{
  triggers: string[];
  mappings: string[];
}> = [
  {
    triggers: ["customer success manager", "csm"],
    mappings: ["CSM"],
  },
  {
    triggers: ["customer success"],
    mappings: ["customer onboarding", "renewals", "retention"],
  },
  {
    triggers: ["try-before-you-hire", "try before you hire", "try before hiring"],
    mappings: ["contract-to-hire", "evaluate before hiring"],
  },
  {
    triggers: ["software engineering", "software engineer"],
    mappings: ["developers", "engineering capacity"],
  },
  {
    triggers: ["devops"],
    mappings: ["infrastructure", "platform engineering"],
  },
  {
    triggers: ["on-demand", "on demand staffing"],
    mappings: ["flexible talent", "fractional hiring"],
  },
  {
    triggers: ["fractional"],
    mappings: ["part-time expert", "flexible professional support"],
  },
  {
    triggers: ["saas", "software as a service"],
    mappings: ["cloud software"],
  },
  {
    triggers: ["full-time hire", "full-time hiring", "permanent hire"],
    mappings: ["alternative to hiring", "flexible staffing"],
  },
  {
    triggers: ["staffing agency", "talent marketplace"],
    mappings: ["vetted professionals", "managed talent"],
  },
];

/**
 * Vague terms to exclude from primary terms.
 * These add no retrieval value and dilute quality.
 */
const VAGUE_TERMS = new Set([
  "solutions", "best", "quality", "business help", "services",
  "support", "platform", "tool", "tools", "product", "products",
  "help", "company", "team", "teams", "work", "working", "great",
  "good", "top", "leading", "premier", "excellent", "professional",
  "professionals", "experts", "expertise",
]);

/** Minimum term length (chars), except for approved acronyms. */
const MIN_TERM_LENGTH = 2;

// ─── Technology / role / entity signals ──────────────────────────────────────

const ENTITY_PATTERNS: RegExp[] = [
  // Job roles (capitalized or keyword-signaled)
  /\b(engineer|developer|designer|manager|analyst|specialist|consultant|director|coordinator|strategist|architect|marketer)\b/i,
  // Known tech
  /\b(Salesforce|HubSpot|Zendesk|Slack|Jira|Figma|GitHub|AWS|Azure|GCP|Stripe|Shopify|Notion|Airtable|Intercom|Mixpanel|Segment|Snowflake|dbt|Kubernetes|Docker|React|Node\.js|Python|TypeScript|Go|Rust)\b/i,
  // Industries
  /\b(SaaS|FinTech|HealthTech|EdTech|PropTech|LegalTech|eCommerce|e-commerce|marketplace|B2B|B2C|startup|scale-up)\b/i,
  // Location signals
  /\b(US|UK|EU|Australia|Canada|New York|San Francisco|London|Berlin|Toronto|Sydney|remote|global)\b/i,
];

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function normalizeTermValue(raw: string): string {
  const trimmed = normalizeWhitespace(raw);
  // Preserve known acronyms exactly
  if (PRESERVED_ACRONYMS.has(trimmed.toUpperCase())) {
    // Return the uppercase version if it's in the set
    const upper = trimmed.toUpperCase();
    if (PRESERVED_ACRONYMS.has(upper)) return upper;
  }
  return trimmed;
}

function isValidTerm(value: string): boolean {
  if (!value || value.length === 0) return false;
  // Punctuation-only
  if (/^[^a-zA-Z0-9]+$/.test(value)) return false;
  // Known acronym — always valid
  if (PRESERVED_ACRONYMS.has(value)) return true;
  // Too short
  if (value.length < MIN_TERM_LENGTH) return false;
  return true;
}

function isVagueTerm(value: string): boolean {
  return VAGUE_TERMS.has(value.toLowerCase());
}

/**
 * Deduplication map keyed by lowercase value.
 * Preserves the first occurrence's casing.
 */
function dedupeTerms(terms: RetrievalTerm[]): RetrievalTerm[] {
  const seen = new Map<string, RetrievalTerm>();
  for (const t of terms) {
    const key = t.value.toLowerCase();
    if (!seen.has(key)) seen.set(key, t);
  }
  return Array.from(seen.values());
}

function makeTerm(
  value: string,
  source: RetrievalTerm["source"],
  sourceFactIds: string[]
): RetrievalTerm | null {
  const normalized = normalizeTermValue(value);
  if (!isValidTerm(normalized)) return null;
  return { value: normalized, source, sourceFactIds };
}

// ─── Fact text extraction ─────────────────────────────────────────────────────

function factFullText(fact: BusinessFact): string {
  return [fact.claim, fact.detail ?? "", fact.evidenceText].join(" ");
}

// ─── Primary terms ────────────────────────────────────────────────────────────

/**
 * Phrases to extract from fact text for primary terms.
 * Patterns focus on service/product/use-case/comparison/pricing/location language.
 */
const PRIMARY_PHRASE_PATTERNS: RegExp[] = [
  // Pricing signals
  /\b(free trial|no credit card|cancel anytime|month.to.month|no long.term contract|flexible pricing|pay.as.you.go|pay per use|subscription|pricing plan)\b/i,
  // Service delivery model
  /\b(on.demand|fractional|contract.to.hire|try before you hire|managed service|dedicated support|vetted professional)\b/i,
  // Role-function phrases
  /\b(customer success|software engineer|product manager|growth marketer|data engineer|UX designer|DevOps engineer|customer support|account manager)\b/i,
  // Use-case phrases
  /\b(hiring risk|bandwidth gap|skill gap|short.term engagement|project capacity|temporary (staff|talent|help)|scale (up|down))\b/i,
  // Comparison/differentiator
  /\b(alternative to (hiring|agencies?|freelancers?)|without (hiring|a full.time)|instead of (hiring|an employee))\b/i,
];

function extractPrimaryTermsFromFact(fact: BusinessFact): string[] {
  const text = factFullText(fact);
  const found: string[] = [];
  for (const pattern of PRIMARY_PHRASE_PATTERNS) {
    const matches = text.match(new RegExp(pattern.source, "gi")) ?? [];
    for (const m of matches) {
      found.push(m.trim());
    }
  }
  return found;
}

// ─── Entity extraction ────────────────────────────────────────────────────────

function extractEntitiesFromFact(fact: BusinessFact): string[] {
  const text = factFullText(fact);
  const found: string[] = [];
  for (const pattern of ENTITY_PATTERNS) {
    const matches = text.match(new RegExp(pattern.source, "gi")) ?? [];
    for (const m of matches) {
      const trimmed = m.trim();
      // Normalize known acronyms
      if (PRESERVED_ACRONYMS.has(trimmed.toUpperCase())) {
        found.push(trimmed.toUpperCase());
      } else {
        found.push(trimmed);
      }
    }
  }
  return found;
}

// ─── Controlled mapping application ──────────────────────────────────────────

function applyControlledMappings(
  facts: BusinessFact[],
  factIds: string[]
): RetrievalTerm[] {
  const allText = facts.map(factFullText).join(" ").toLowerCase();
  const terms: RetrievalTerm[] = [];

  for (const { triggers, mappings } of CONTROLLED_MAPPINGS) {
    const triggered = triggers.some((t) => allText.includes(t));
    if (!triggered) continue;
    for (const mapping of mappings) {
      const t = makeTerm(mapping, "controlled_mapping", factIds);
      if (t) terms.push(t);
    }
  }

  return terms;
}

// ─── Semantic variants ────────────────────────────────────────────────────────

/**
 * Generate natural buyer-language variants from fact content.
 * These must be supported by the source facts and read as real buyer questions.
 */
function generateSemanticVariants(
  facts: BusinessFact[],
  factIds: string[],
  businessName: string,
  intentTheme?: string
): RetrievalTerm[] {
  const allText = facts.map(factFullText).join(" ").toLowerCase();
  const variants: RetrievalTerm[] = [];

  const has = (...terms: string[]) => terms.some((t) => allText.includes(t));

  if (has("customer success", "csm")) {
    variants.push(makeTerm(`customer success help without hiring full-time`, "fact", factIds)!);
    if (has("trial", "try before")) {
      variants.push(makeTerm(`test a CSM before making a permanent hire`, "fact", factIds)!);
    }
  }

  if (has("engineering", "developer", "software")) {
    variants.push(makeTerm(`extra engineering capacity for a short-term project`, "fact", factIds)!);
  }

  if (has("trial", "try before", "risk-free", "no credit card")) {
    variants.push(makeTerm(`try before committing to a paid plan`, "fact", factIds)!);
  }

  if (has("on-demand", "on demand", "fractional")) {
    variants.push(makeTerm(`on-demand professional without a long-term contract`, "fact", factIds)!);
  }

  if (has("flexible", "month-to-month", "cancel", "no contract")) {
    variants.push(makeTerm(`flexible support that scales without a long-term commitment`, "fact", factIds)!);
  }

  if (has("full-time", "permanent hire", "employee", "headcount")) {
    variants.push(makeTerm(`professional help without adding permanent headcount`, "fact", factIds)!);
  }

  if (intentTheme) {
    const themeLower = intentTheme.toLowerCase();
    if (themeLower.includes("pricing") || has("pricing", "price", "plan")) {
      variants.push(makeTerm(`${businessName} pricing and plans`, "theme", factIds)!);
    }
    if (themeLower.includes("local") || has("local", "on-site", "location")) {
      variants.push(makeTerm(`local professional services near me`, "fact", factIds)!);
    }
  }

  return variants.filter(Boolean) as RetrievalTerm[];
}

// ─── Tag terms ────────────────────────────────────────────────────────────────

function extractTagTerms(facts: BusinessFact[], factIds: string[]): RetrievalTerm[] {
  const terms: RetrievalTerm[] = [];
  for (const fact of facts) {
    for (const tag of fact.tags ?? []) {
      const t = makeTerm(tag, "tag", [fact.id]);
      if (t && !isVagueTerm(t.value)) terms.push(t);
    }
  }
  return terms;
}

// ─── Category terms ───────────────────────────────────────────────────────────

const CATEGORY_TERM_MAP: Record<string, string> = {
  pricing: "pricing",
  service: "professional services",
  product: "product",
  use_case: "use case",
  differentiator: "competitive advantage",
  location: "local services",
  integration: "integrations",
  proof_point: "case study",
  company_profile: "company overview",
  faq: "frequently asked questions",
  policy: "policy",
  competitor: "comparison",
  claim: "key claim",
  limitation: "limitation",
};

function extractCategoryTerms(facts: BusinessFact[], factIds: string[]): string[] {
  const categories = Array.from(new Set(facts.map((f) => f.category)));
  return categories.map((c) => CATEGORY_TERM_MAP[c] ?? c.replace(/_/g, " ")).filter(Boolean);
}

// ─── Main generator ───────────────────────────────────────────────────────────

export interface GenerateRetrievalVocabularyOptions {
  facts: BusinessFact[];
  businessName: string;
  intentTheme?: string;
  promptTexts?: string[];
}

/**
 * Deterministically generate retrieval vocabulary for an intent brief.
 *
 * Sources: publishable fact claims, detail, evidenceText, tags, categories,
 * intent theme, business name, and user prompts.
 *
 * Never includes: needs_review, rejected, high-risk, legal-priority,
 * or low-priority facts (caller must pre-filter facts).
 */
export function generateRetrievalVocabulary(
  opts: GenerateRetrievalVocabularyOptions
): RetrievalVocabulary {
  const { facts, businessName, intentTheme, promptTexts = [] } = opts;
  const factIds = facts.map((f) => f.id);

  // ── Primary terms ──────────────────────────────────────────────────────────

  const rawPrimary: RetrievalTerm[] = [];

  for (const fact of facts) {
    const phrases = extractPrimaryTermsFromFact(fact);
    for (const phrase of phrases) {
      const t = makeTerm(phrase, "fact", [fact.id]);
      if (t && !isVagueTerm(t.value)) rawPrimary.push(t);
    }
  }

  // Prefer core facts over supporting facts
  const coreFacts = facts.filter((f) => f.publishPriority === "core");
  const supportingFacts = facts.filter((f) => f.publishPriority === "supporting");

  // Add category-level terms as primary signals when no phrase-level terms found
  const categoryTerms = extractCategoryTerms(coreFacts.length > 0 ? coreFacts : facts, factIds);
  for (const ct of categoryTerms) {
    const t = makeTerm(ct, "fact", factIds);
    if (t && !isVagueTerm(t.value)) rawPrimary.push(t);
  }

  // Theme contributes to primary terms
  if (intentTheme) {
    const t = makeTerm(intentTheme, "theme", factIds);
    if (t && !isVagueTerm(t.value)) rawPrimary.push(t);
  }

  // Business name adds context to primary
  const businessNameTerm = makeTerm(businessName, "fact", factIds);

  const primaryTerms = dedupeTerms(rawPrimary)
    .filter((t) => !isVagueTerm(t.value))
    .slice(0, 6);

  // ── Related terms (controlled mappings only) ───────────────────────────────

  const relatedTerms = dedupeTerms(applyControlledMappings(facts, factIds)).slice(0, 10);

  // ── Entities ───────────────────────────────────────────────────────────────

  const rawEntities: RetrievalTerm[] = [];

  // Business name always first
  if (businessNameTerm) rawEntities.push(businessNameTerm);

  for (const fact of facts) {
    const entityStrings = extractEntitiesFromFact(fact);
    for (const e of entityStrings) {
      const t = makeTerm(e, "fact", [fact.id]);
      if (t) rawEntities.push(t);
    }
  }

  // Tags often carry entity-like values
  for (const tagTerm of extractTagTerms(facts, factIds)) {
    rawEntities.push(tagTerm);
  }

  const entities = dedupeTerms(rawEntities).slice(0, 10);

  // ── Semantic variants ──────────────────────────────────────────────────────

  const rawVariants: RetrievalTerm[] = generateSemanticVariants(
    facts,
    factIds,
    businessName,
    intentTheme
  );

  // Prompt-derived variants
  for (const prompt of promptTexts) {
    if (!prompt.trim()) continue;
    const t = makeTerm(prompt.trim(), "prompt", factIds);
    if (t) rawVariants.push(t);
  }

  // Avoid variants that are identical to primary terms or entities
  const primaryValues = new Set(primaryTerms.map((t) => t.value.toLowerCase()));
  const entityValues = new Set(entities.map((t) => t.value.toLowerCase()));

  const semanticVariants = dedupeTerms(rawVariants)
    .filter((t) => !primaryValues.has(t.value.toLowerCase()))
    .filter((t) => !entityValues.has(t.value.toLowerCase()))
    .slice(0, 8);

  return { primaryTerms, relatedTerms, entities, semanticVariants };
}
