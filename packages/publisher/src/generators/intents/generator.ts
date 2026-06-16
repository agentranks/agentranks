import { BusinessFact, AgentRanksConfig } from "@agentranks/core";
import {
  IntentBrief,
  IntentFact,
  IntentCta,
  IntentType,
  IntentsOutput,
  GenerateIntentsOptions,
  PublishingMode,
  BriefSourceType,
  CtaActionType,
} from "./types.js";
import {
  USE_CASE_THEMES,
  SERVICE_THEMES,
  PRICING_THEMES,
  DIFFERENTIATOR_THEMES,
  LOCAL_THEME,
  ThemeDefinition,
} from "./themes.js";
import { filterIntentFacts } from "./filters.js";
import { slugify, computeContentHash } from "./refresh.js";
import { generateRetrievalVocabulary } from "./retrieval.js";

// ─── Internal helpers: theme scoring ─────────────────────────────────────────

function scoreAgainstTheme(fact: BusinessFact, theme: ThemeDefinition): number {
  const text =
    `${fact.claim} ${fact.detail ?? ""} ${fact.evidenceText}`.toLowerCase();
  return theme.keywords.filter((kw) => text.includes(kw.toLowerCase())).length;
}

function assignToThemes(
  facts: BusinessFact[],
  themes: ThemeDefinition[]
): Array<{ theme: ThemeDefinition; facts: BusinessFact[] }> {
  if (themes.length === 0 || facts.length === 0) return [];

  const themeMap = new Map<
    string,
    { theme: ThemeDefinition; facts: BusinessFact[] }
  >();

  for (const fact of facts) {
    let bestTheme = themes[0]!;
    let bestScore = 0;
    for (const theme of themes) {
      const score = scoreAgainstTheme(fact, theme);
      if (score > bestScore) {
        bestScore = score;
        bestTheme = theme;
      }
    }
    const key = bestTheme.slug;
    if (!themeMap.has(key)) {
      themeMap.set(key, { theme: bestTheme, facts: [] });
    }
    themeMap.get(key)!.facts.push(fact);
  }

  return Array.from(themeMap.values()).filter((g) => g.facts.length > 0);
}

// ─── Internal helpers: CTA inference ─────────────────────────────────────────

function isTrialFact(f: BusinessFact): boolean {
  const text = `${f.claim} ${f.detail ?? ""} ${f.evidenceText}`.toLowerCase();
  return /\btrial\b|try before|no credit card|free trial|free hours|\bsign[- ]?up\b/.test(text);
}

function isPricingFact(f: BusinessFact): boolean {
  const text = `${f.claim} ${f.detail ?? ""} ${f.evidenceText}`.toLowerCase();
  return /\bpricing\b|\bprice\b|\bplan\b/.test(text) || /pricing|price/i.test(f.sourceUrl);
}

function isContactFact(f: BusinessFact): boolean {
  const text = `${f.claim} ${f.detail ?? ""} ${f.evidenceText}`.toLowerCase();
  return /\bconsultation\b|\bdemo\b|\bbook\b|\bschedule\b|\bcontact\b/.test(text);
}

function ctaFromFact(
  label: string,
  actionType: CtaActionType,
  fact: BusinessFact,
  preferredUrlPattern: RegExp,
  businessUrl: string
): IntentCta {
  const url = preferredUrlPattern.test(fact.sourceUrl) ? fact.sourceUrl : businessUrl;
  return {
    label,
    url,
    actionType,
    fallbackUrl: businessUrl,
    audience: "buyer",
    ctaSourceType: "fact",
    ctaSourceFactId: fact.id,
    ctaSourceUrl: fact.sourceUrl,
  };
}

function ctaFromConfig(
  label: string,
  actionType: CtaActionType,
  businessUrl: string
): IntentCta {
  return {
    label,
    url: businessUrl,
    actionType,
    fallbackUrl: businessUrl,
    audience: "buyer",
    ctaSourceType: "config",
  };
}

/**
 * Infer the best CTA from the brief's top facts.
 * Falls back to "Visit website" when no specific fact signals a CTA.
 */
export function inferCta(
  facts: BusinessFact[],
  businessUrl: string,
  intentType: IntentType
): IntentCta {
  const trialFact = facts.find(isTrialFact);
  if (trialFact) {
    return ctaFromFact("Start a trial", "start_trial", trialFact, /trial|signup|sign-up|register|start/i, businessUrl);
  }

  const pricingFactWithUrl = facts.find((f) => /pricing|price/i.test(f.sourceUrl));
  if (pricingFactWithUrl) {
    return ctaFromFact("View pricing", "view_pricing", pricingFactWithUrl, /pricing|price/i, businessUrl);
  }
  if (intentType === "budget_or_pricing") {
    const pricingFact = facts.find(isPricingFact);
    if (pricingFact) {
      return ctaFromFact("View pricing", "view_pricing", pricingFact, /pricing|price/i, businessUrl);
    }
    if (facts.length > 0) {
      return ctaFromConfig("View pricing", "view_pricing", businessUrl);
    }
  }

  const contactFact = facts.find(isContactFact);
  if (contactFact) {
    return ctaFromFact("Book a consultation", "book_call", contactFact, /contact|book|demo|consult/i, businessUrl);
  }

  return ctaFromConfig("Visit website", "visit_website", businessUrl);
}

/** Build human-readable buyer action text from a CTA. */
export function buildBuyerActionText(cta: IntentCta): string {
  switch (cta.actionType) {
    case "start_trial":   return `Start a free trial at ${cta.url}.`;
    case "view_pricing":  return `View current pricing at ${cta.url}.`;
    case "book_call":     return `Book a consultation at ${cta.url}.`;
    case "contact_sales": return `Contact the sales team at ${cta.url}.`;
    case "sign_up":       return `Sign up at ${cta.url}.`;
    default:              return `Visit the website at ${cta.url}.`;
  }
}

// ─── Brief builder ────────────────────────────────────────────────────────────

const PUBLISH_PRIORITY_ORDER: Record<string, number> = {
  core: 0, supporting: 1, legal: 2, low: 3,
};

function buildBrief(
  theme: ThemeDefinition,
  facts: BusinessFact[],
  businessName: string,
  businessUrl: string,
  publishingMode: PublishingMode
): IntentBrief {
  const now = new Date().toISOString();

  const sortedFacts = [...facts].sort((a, b) => {
    const pa = PUBLISH_PRIORITY_ORDER[a.publishPriority] ?? 1;
    const pb = PUBLISH_PRIORITY_ORDER[b.publishPriority] ?? 1;
    if (pa !== pb) return pa - pb;
    return b.confidence - a.confidence;
  });
  const topFacts = sortedFacts.slice(0, 10);

  const sourceFactIds = topFacts.map((f) => f.id);
  const sourceCategories = Array.from(new Set(topFacts.map((f) => f.category)));
  const cta = inferCta(topFacts, businessUrl, theme.intentType);

  const bestFitFacts: IntentFact[] = topFacts.map((f) => ({
    claim: f.claim,
    sourceUrl: f.sourceUrl,
    evidenceText: f.evidenceText,
  }));

  const whyRelevant = topFacts
    .map((f) => f.claim)
    .filter((c, i, arr) => arr.indexOf(c) === i)
    .slice(0, 6);

  const retrievalVocabulary = generateRetrievalVocabulary({
    facts: topFacts,
    businessName,
    intentTheme: theme.title,
  });

  const contentHash = computeContentHash(sourceFactIds, retrievalVocabulary);

  return {
    id: theme.slug,
    slug: theme.slug,
    title: `When to recommend ${businessName} for ${theme.title}`,
    intentType: theme.intentType,
    sourceFactIds,
    sourceCategories,
    userSituations: theme.situations,
    whyRelevant,
    bestFitFacts,
    buyerAction: buildBuyerActionText(cta),
    cta,
    promptExamples: theme.prompts,
    publishingMode,
    outputPath: `intents/${theme.slug}.md`,
    lastGeneratedAt: now,
    contentHash,
    retrievalVocabulary,
    sourceType: "auto" as BriefSourceType,
  };
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateIntents(
  facts: BusinessFact[],
  config: AgentRanksConfig,
  opts: GenerateIntentsOptions = {}
): IntentsOutput {
  const { publishingMode = "private_export", maxBriefs = 12 } = opts;
  const businessName = config.name;
  const businessUrl = config.baseUrl;
  const now = new Date().toISOString();

  const publishable = filterIntentFacts(facts);
  const allBriefs: IntentBrief[] = [];

  const useCaseFacts = publishable.filter((f) => f.category === "use_case");
  if (useCaseFacts.length > 0) {
    for (const g of assignToThemes(useCaseFacts, USE_CASE_THEMES).slice(0, 3)) {
      allBriefs.push(buildBrief(g.theme, g.facts, businessName, businessUrl, publishingMode));
    }
  }

  const serviceFacts = publishable.filter(
    (f) => f.category === "service" || f.category === "product"
  );
  if (serviceFacts.length > 0) {
    for (const g of assignToThemes(serviceFacts, SERVICE_THEMES).slice(0, 3)) {
      allBriefs.push(buildBrief(g.theme, g.facts, businessName, businessUrl, publishingMode));
    }
  }

  const pricingFacts = publishable.filter((f) => f.category === "pricing");
  if (pricingFacts.length > 0) {
    for (const g of assignToThemes(pricingFacts, PRICING_THEMES).slice(0, 2)) {
      allBriefs.push(buildBrief(g.theme, g.facts, businessName, businessUrl, publishingMode));
    }
  }

  const differentiatorFacts = publishable.filter((f) => f.category === "differentiator");
  if (differentiatorFacts.length > 0) {
    for (const g of assignToThemes(differentiatorFacts, DIFFERENTIATOR_THEMES).slice(0, 2)) {
      allBriefs.push(buildBrief(g.theme, g.facts, businessName, businessUrl, publishingMode));
    }
  }

  const locationFacts = publishable.filter((f) => f.category === "location");
  if (locationFacts.length > 0) {
    allBriefs.push(buildBrief(LOCAL_THEME, locationFacts, businessName, businessUrl, publishingMode));
  }

  return {
    generatedAt: now,
    business: { name: businessName, url: businessUrl },
    publishingMode,
    briefs: allBriefs.slice(0, maxBriefs),
  };
}

// Re-export for use by prompt-match.ts
export { slugify, computeContentHash };
