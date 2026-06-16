import { BusinessFact, AgentRanksConfig } from "@agentranks/core";
import {
  IntentBrief,
  IntentFact,
  IntentType,
  GenerateIntentsOptions,
  PromptsFileBriefResult,
  SkippedPrompt,
  BriefSourceType,
} from "./types.js";
import { filterIntentFacts } from "./filters.js";
import { inferCta, buildBuyerActionText } from "./generator.js";
import { slugify, computeContentHash } from "./refresh.js";
import { generateRetrievalVocabulary } from "./retrieval.js";

// ─── Stop words ───────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "to", "of", "in", "on",
  "at", "for", "by", "with", "from", "and", "but", "or", "not", "no",
  "nor", "its", "it", "this", "that", "these", "those", "im", "my",
  "me", "we", "our", "you", "your", "i", "he", "she", "they", "them",
  "am", "if", "so", "as", "into", "than", "also", "all", "any", "who",
  "what", "how", "when", "where", "why", "want", "need", "get", "just",
  "out", "about", "up", "there", "then", "now", "some", "been",
]);

// ─── Category boost rules ─────────────────────────────────────────────────────

const CATEGORY_BOOST_RULES: Array<{
  patterns: string[];
  categories: string[];
  boost: number;
}> = [
  {
    patterns: ["price", "cost", "budget", "contract", "trial", "free", "pricing", "plan", "pay", "paid", "subscription", "rate", "fee"],
    categories: ["pricing", "differentiator"],
    boost: 2,
  },
  {
    patterns: ["hire", "hiring", "full-time", "fulltime", "staffing", "employee", "headcount", "recruit", "headhunt"],
    categories: ["differentiator", "service"],
    boost: 2,
  },
  {
    patterns: ["customer success", "csm", "onboarding", "renewal", "retention", "support", "helpdesk", "cx"],
    categories: ["service", "use_case"],
    boost: 2,
  },
  {
    patterns: ["engineering", "engineer", "devops", "software", "developer", "dev", "tech", "saas", "api", "cloud", "coding", "infrastructure"],
    categories: ["service"],
    boost: 1,
  },
  {
    patterns: ["design", "creative", "brand", "ux", "ui", "figma", "marketing", "content", "seo", "social", "growth", "campaign"],
    categories: ["service"],
    boost: 1,
  },
];

const MIN_PROMPT_MATCH_SCORE = 2;

// ─── Tokenization ─────────────────────────────────────────────────────────────

function tokenizeText(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
  );
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scorePromptAgainstFact(prompt: string, fact: BusinessFact): number {
  const promptTokens = tokenizeText(prompt);
  const factText = [
    fact.claim,
    fact.detail ?? "",
    fact.evidenceText,
    fact.category,
    ...(fact.tags ?? []),
  ].join(" ");
  const factTokens = tokenizeText(factText);

  let score = 0;
  for (const token of promptTokens) {
    if (factTokens.has(token)) score++;
  }

  const promptLower = prompt.toLowerCase();
  for (const { patterns, categories, boost } of CATEGORY_BOOST_RULES) {
    if (
      patterns.some((p) => promptLower.includes(p)) &&
      categories.includes(fact.category)
    ) {
      score += boost;
      break;
    }
  }

  return score;
}

function inferIntentTypeFromCategories(categories: string[]): IntentType {
  if (categories.includes("pricing")) return "budget_or_pricing";
  if (categories.includes("differentiator")) return "comparison";
  if (categories.includes("use_case")) return "use_case";
  if (categories.includes("service") || categories.includes("product")) return "service_need";
  return "general";
}

// ─── Prompt-file brief generator ─────────────────────────────────────────────

/**
 * Generate source-backed intent briefs for each user prompt in a prompts file.
 *
 * Matching is fully deterministic — no LLM calls.
 * Prompts with no matching publishable facts are skipped and reported.
 * Pass `existingSlugs` to avoid collisions with auto-generated briefs.
 */
export function generateIntentsFromPrompts(
  userPrompts: string[],
  facts: BusinessFact[],
  config: AgentRanksConfig,
  opts: GenerateIntentsOptions & { existingSlugs?: Set<string> } = {}
): PromptsFileBriefResult {
  const { publishingMode = "private_export", existingSlugs = new Set<string>() } = opts;
  const publishable = filterIntentFacts(facts);
  const businessName = config.name;
  const businessUrl = config.baseUrl;
  const now = new Date().toISOString();

  const briefs: IntentBrief[] = [];
  const skipped: SkippedPrompt[] = [];
  const usedSlugs = new Set<string>(existingSlugs);

  for (const prompt of userPrompts) {
    const trimmed = prompt.trim();
    if (!trimmed) continue;

    const scored = publishable
      .map((f) => ({ fact: f, score: scorePromptAgainstFact(trimmed, f) }))
      .filter(({ score }) => score >= MIN_PROMPT_MATCH_SCORE)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      skipped.push({
        prompt: trimmed,
        reason: "No publishable facts matched this prompt (score below threshold)",
      });
      continue;
    }

    const topScored = scored.slice(0, 10);
    const topFacts = topScored.map(({ fact }) => fact);
    const totalScore = topScored.reduce((sum, { score }) => sum + score, 0);

    const baseSlug = "pf-" + slugify(trimmed).slice(0, 55);
    let slug = baseSlug;
    let counter = 2;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${counter++}`;
    }
    usedSlugs.add(slug);

    const sourceFactIds = topFacts.map((f) => f.id);
    const sourceCategories = Array.from(new Set(topFacts.map((f) => f.category)));
    const intentType = inferIntentTypeFromCategories(sourceCategories);
    const cta = inferCta(topFacts, businessUrl, intentType);
    const retrievalVocabulary = generateRetrievalVocabulary({
      facts: topFacts,
      businessName,
      promptTexts: [trimmed],
    });
    const contentHash = computeContentHash(sourceFactIds, retrievalVocabulary);

    const bestFitFacts: IntentFact[] = topFacts.map((f) => ({
      claim: f.claim,
      sourceUrl: f.sourceUrl,
      evidenceText: f.evidenceText,
    }));

    const whyRelevant = topFacts
      .map((f) => f.claim)
      .filter((c, i, arr) => arr.indexOf(c) === i)
      .slice(0, 6);

    const title =
      trimmed.length > 80
        ? `${businessName} for: ${trimmed.slice(0, 77)}…`
        : `${businessName} for: ${trimmed}`;

    const brief: IntentBrief = {
      id: slug,
      slug,
      title,
      intentType,
      sourceFactIds,
      sourceCategories,
      userSituations: [trimmed],
      whyRelevant,
      bestFitFacts,
      buyerAction: buildBuyerActionText(cta),
      cta,
      promptExamples: [{ prompt: trimmed, promptType: "problem_aware" }],
      publishingMode,
      outputPath: `intents/${slug}.md`,
      lastGeneratedAt: now,
      contentHash,
      retrievalVocabulary,
      sourceType: "prompts_file" as BriefSourceType,
      sourcePrompt: trimmed,
      matchScore: totalScore,
    };

    briefs.push(brief);
  }

  return { briefs, skipped };
}
