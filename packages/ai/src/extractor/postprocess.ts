import crypto from "crypto";
import {
  BusinessFact,
  ContentGap,
  RawFact,
  FactCategory,
  PublishPriority,
  RiskLevel,
} from "@agentranks/core";
import {
  VALID_CATEGORIES,
  CLAIM_ESCALATION_PATTERNS,
  MEDIUM_RISK_PATTERNS,
  INCOMPLETE_ANSWER_PATTERNS,
  LEGAL_URL_PATTERNS,
  VAGUE_PATTERNS,
} from "./patterns.js";

// ─── Risk scoring ─────────────────────────────────────────────────────────────

function determineRiskLevel(fact: RawFact, category: string): RiskLevel {
  const text = `${fact.claim} ${fact.detail ?? ""} ${fact.evidenceText ?? ""}`;

  if (CLAIM_ESCALATION_PATTERNS.some((p) => p.test(text))) return "high";

  if (category === "proof_point") {
    return CLAIM_ESCALATION_PATTERNS.some((p) => p.test(text)) ? "high" : "medium";
  }

  if (MEDIUM_RISK_PATTERNS.some((p) => p.test(text))) return "medium";

  if (category === "policy" && fact.confidence < 0.85) return "medium";

  const llmRisk = fact.riskLevel;
  if (llmRisk === "high") return "high";
  if (llmRisk === "medium") return "medium";

  return "low";
}

// ─── Publish priority ─────────────────────────────────────────────────────────

const CORE_CATEGORIES = new Set<string>([
  "company_profile", "product", "service", "pricing", "use_case", "differentiator", "faq",
]);

const LOW_PRIORITY_INTEGRATION_RE = /^[\w\s\-/+.]+\s+(integration|connector|plugin|API|SDK)$/i;

function determinePublishPriority(
  category: string,
  sourceUrl: string,
  claim: string,
  detail: string | undefined
): PublishPriority {
  if (LEGAL_URL_PATTERNS.some((p) => p.test(sourceUrl))) return "legal";

  if (category === "policy") return "supporting";

  if (CORE_CATEGORIES.has(category)) {
    if (
      (category === "service" || category === "product" || category === "integration") &&
      claim.length < 60 &&
      !detail
    ) {
      return "low";
    }
    return "core";
  }

  if (category === "integration") {
    if (claim.length < 80 && LOW_PRIORITY_INTEGRATION_RE.test(claim)) return "low";
    return "supporting";
  }

  if (category === "claim" || category === "proof_point") return "supporting";

  return "supporting";
}

// ─── Evidence quality ─────────────────────────────────────────────────────────

const NUMERIC_RE = /\d[\d,.]+/;

const STRONG_EVIDENCE_CATEGORIES = new Set<string>([
  "pricing", "policy", "claim", "proof_point",
]);

function hasWeakEvidence(fact: RawFact, category: string): boolean {
  const evidence = (fact.evidenceText ?? "").trim();
  if (evidence.length === 0) return true;
  if (evidence.length < 20) return true;

  const claimNumbers = fact.claim.match(/\d[\d,.]+/g) ?? [];
  if (claimNumbers.length > 0 && !NUMERIC_RE.test(evidence)) return true;

  if (STRONG_EVIDENCE_CATEGORIES.has(category) && evidence.length < 40) return true;

  return false;
}

// ─── ID generation ────────────────────────────────────────────────────────────

function generateFactId(claim: string, sourceUrl: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${claim}::${sourceUrl}`)
    .digest("hex")
    .slice(0, 12);
  return `fact_${hash}`;
}

// ─── Enrichment ───────────────────────────────────────────────────────────────

export function enrichFact(raw: RawFact, sourceUrl: string, now: string): BusinessFact {
  return {
    id: generateFactId(raw.claim, sourceUrl),
    category: raw.category as FactCategory,
    claim: raw.claim.trim(),
    detail: raw.detail?.trim(),
    evidenceText: raw.evidenceText?.trim() || raw.claim.trim(),
    sourceUrl,
    confidence: Math.round(raw.confidence * 100) / 100,
    riskLevel: (raw.riskLevel ?? "low") as RiskLevel,
    status: (raw.status ?? "extracted") as "extracted" | "needs_review",
    publishPriority: (raw.publishPriority ?? "supporting") as PublishPriority,
    extractedAt: now,
    tags: raw.tags,
  };
}

// ─── Post-processing ──────────────────────────────────────────────────────────

export interface PostProcessResult {
  facts: RawFact[];
  contentGaps: ContentGap[];
}

export function postProcessFacts(
  rawFacts: RawFact[],
  sourceUrl: string
): PostProcessResult {
  const facts: RawFact[] = [];
  const contentGaps: ContentGap[] = [];
  const now = new Date().toISOString();

  for (const fact of rawFacts) {
    if (!VALID_CATEGORIES.has(fact.category)) continue;

    const combined = `${fact.claim} ${fact.detail ?? ""}`;

    if (VAGUE_PATTERNS.some((p) => p.test(combined))) continue;
    if (fact.confidence === 0) continue;

    if (fact.category === "faq") {
      const fullText = `${fact.claim} ${fact.detail ?? ""} ${fact.evidenceText ?? ""}`;
      if (INCOMPLETE_ANSWER_PATTERNS.some((p) => p.test(fullText))) {
        contentGaps.push({
          type: "missing_faq_answer",
          question: fact.claim,
          sourceUrl,
          evidenceText: fact.evidenceText,
          detectedAt: now,
        });
        continue;
      }
    }

    const riskLevel = determineRiskLevel(fact, fact.category);

    let status: "extracted" | "needs_review";
    if (CLAIM_ESCALATION_PATTERNS.some((p) => p.test(combined))) {
      status = "needs_review";
    } else if (fact.category === "proof_point") {
      status = "needs_review";
    } else if (hasWeakEvidence(fact, fact.category)) {
      status = "needs_review";
    } else if (riskLevel === "high") {
      status = "needs_review";
    } else {
      status = "extracted";
    }

    const finalCategory = CLAIM_ESCALATION_PATTERNS.some((p) => p.test(combined))
      ? "claim"
      : fact.category;

    const publishPriority = determinePublishPriority(
      finalCategory,
      sourceUrl,
      fact.claim,
      fact.detail
    );

    facts.push({
      ...fact,
      category: finalCategory,
      riskLevel,
      status,
      publishPriority,
      confidence: status === "needs_review" && finalCategory === "claim"
        ? Math.min(fact.confidence, 0.75)
        : fact.confidence,
    });
  }

  return { facts, contentGaps };
}
