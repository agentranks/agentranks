import { BusinessFact } from "@agentranks/core";
import { isFactPublishable } from "@agentranks/publisher";
import {
  CategoryScores,
  FactCounts,
  ScoreReport,
  SectionStatus,
  SECTIONS,
} from "./types.js";

// ─── Publishability helpers ───────────────────────────────────────────────────

/**
 * Returns true if a fact is publishable for scoring purposes (score mode).
 * Uses the unified publishability gate from @agentranks/publisher.
 */
export function isPublishable(fact: BusinessFact): boolean {
  return isFactPublishable(fact, { mode: "score" });
}

/**
 * Returns true if a fact is considered "excluded" for score reporting.
 * This covers facts that reduce content quality metrics.
 */
export function isExcluded(fact: BusinessFact): boolean {
  return (
    fact.status === "needs_review" ||
    fact.status === "rejected" ||
    fact.riskLevel === "high" ||
    fact.publishPriority === "low"
  );
}

// ─── Section health ───────────────────────────────────────────────────────────

export function getSectionHealth(
  sectionFacts: BusinessFact[],
  sectionPublishable: BusinessFact[],
  threshold: number
): SectionStatus {
  if (sectionFacts.length === 0) return "missing";
  if (sectionPublishable.length === 0) return "notPublishable";

  const needsReviewCount = sectionFacts.filter((f) => f.status === "needs_review").length;
  const needsReviewRatio = needsReviewCount / sectionFacts.length;
  const avgConfidence = sectionFacts.reduce((s, f) => s + f.confidence, 0) / sectionFacts.length;
  const strongEvidence = sectionFacts.filter(
    (f) => (f.evidenceText?.length ?? 0) >= 30
  ).length / sectionFacts.length;

  const isWeak =
    sectionPublishable.length < threshold ||
    needsReviewRatio > 0.4 ||
    avgConfidence < 0.7 ||
    strongEvidence < 0.5;

  return isWeak ? "weak" : "healthy";
}

// ─── Category scorers ─────────────────────────────────────────────────────────

export function scoreCompanyProfile(all: BusinessFact[], publishable: BusinessFact[]): number {
  const total = all.filter((f) => f.category === "company_profile").length;
  const pub = publishable.filter((f) => f.category === "company_profile").length;
  if (total === 0) return 0;
  if (pub === 0) return 4;
  if (pub >= 2) return 10;
  return 7;
}

export function scoreServiceProduct(all: BusinessFact[], publishable: BusinessFact[]): number {
  const total = all.filter((f) => f.category === "service" || f.category === "product").length;
  const pub = publishable.filter((f) => f.category === "service" || f.category === "product").length;
  if (total === 0) return 0;
  if (pub === 0) return 2;
  if (pub >= 5) return 10;
  if (pub >= 3) return 8;
  return 5;
}

export function scorePricingClarity(all: BusinessFact[], publishable: BusinessFact[]): number {
  const total = all.filter((f) => f.category === "pricing").length;
  const pub = publishable.filter((f) => f.category === "pricing").length;
  if (total === 0) return 0;
  if (pub === 0) return 4;
  if (pub >= 3) return 10;
  return 7;
}

export function scoreFaqCoverage(all: BusinessFact[], publishable: BusinessFact[]): number {
  const total = all.filter((f) => f.category === "faq").length;
  const pub = publishable.filter((f) => f.category === "faq").length;
  if (total === 0) return 0;
  if (pub >= 5) return 10;
  if (pub >= 3) return 7;
  if (pub >= 1) return 4;
  return 0;
}

export function scorePolicyClarity(all: BusinessFact[], publishable: BusinessFact[]): number {
  const total = all.filter((f) => f.category === "policy" || f.category === "limitation").length;
  const pub = publishable.filter(
    (f) => f.category === "policy" || f.category === "limitation"
  ).length;
  if (total === 0) return 0;
  if (pub >= 4) return 10;
  if (pub >= 2) return 7;
  if (pub >= 1) return 4;
  return 0;
}

export function scoreUseCaseCoverage(all: BusinessFact[], publishable: BusinessFact[]): number {
  const total = all.filter((f) => f.category === "use_case").length;
  const pub = publishable.filter((f) => f.category === "use_case").length;
  if (total === 0) return 0;
  if (pub >= 5) return 10;
  if (pub >= 3) return 8;
  if (pub >= 1) return 5;
  return 0;
}

const VAGUE_DIFFERENTIATOR_RE = /\b(best|world.?class|top.?tier|industry.?leading|proven|seamless|guaranteed)\b/i;

export function scoreDifferentiatorQuality(all: BusinessFact[], publishable: BusinessFact[]): number {
  const total = all.filter((f) => f.category === "differentiator").length;
  const pub = publishable.filter((f) => f.category === "differentiator").length;
  if (total === 0) return 0;

  let score = 0;
  if (pub >= 4) score = 10;
  else if (pub >= 2) score = 7;
  else if (pub >= 1) score = 4;

  if (pub > 0) {
    const vague = publishable.filter(
      (f) =>
        f.category === "differentiator" &&
        VAGUE_DIFFERENTIATOR_RE.test(f.claim) &&
        (f.evidenceText?.length ?? 0) < 40
    ).length;
    if (vague / pub > 0.4) score = Math.max(0, score - 2);
  }

  return score;
}

const NUMERIC_RE = /\d[\d,.]+/;

export function scoreEvidenceQuality(all: BusinessFact[]): number {
  if (all.length === 0) return 0;

  const strongCount = all.filter((f) => (f.evidenceText?.length ?? 0) >= 30).length;
  const strongRatio = strongCount / all.length;

  let score = 0;
  if (strongRatio >= 0.95) score = 10;
  else if (strongRatio >= 0.80) score = 8;
  else if (strongRatio >= 0.60) score = 5;
  else if (strongRatio >= 0.30) score = 2;

  const numericMismatchCount = all.filter((f) => {
    const claimNums = f.claim.match(NUMERIC_RE) ?? [];
    return claimNums.length > 0 && !NUMERIC_RE.test(f.evidenceText ?? "");
  }).length;
  if (numericMismatchCount / all.length > 0.2) {
    score = Math.max(0, score - 2);
  }

  return score;
}

export function scoreRiskBurden(all: BusinessFact[]): number {
  if (all.length === 0) return 10;

  const combined = all.filter(
    (f) => f.status === "needs_review" || f.riskLevel === "high"
  ).length;
  const ratio = combined / all.length;

  if (ratio < 0.10) return 10;
  if (ratio < 0.20) return 8;
  if (ratio < 0.35) return 5;
  if (ratio < 0.50) return 2;
  return 0;
}

export function scoreOutputReadiness(
  all: BusinessFact[],
  publishable: BusinessFact[],
  healthySectionCount: number
): number {
  if (publishable.length === 0) return 0;

  let score = 0;
  if (publishable.length >= 50 && healthySectionCount >= 5) score = 10;
  else if (publishable.length >= 25 && healthySectionCount >= 3) score = 8;
  else if (publishable.length >= 10) score = 5;
  else score = 2;

  const lowPriorityCount = all.filter((f) => f.publishPriority === "low").length;
  if (all.length > 0 && lowPriorityCount / all.length > 0.4) {
    score = Math.max(0, score - 2);
  }

  const pricingPublishable = publishable.filter((f) => f.category === "pricing").length;
  const servicePublishable = publishable.filter(
    (f) => f.category === "service" || f.category === "product"
  ).length;
  if (pricingPublishable === 0 || servicePublishable === 0) {
    score = Math.max(0, score - 2);
  }

  return score;
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export function generateRecommendations(
  all: BusinessFact[],
  publishable: BusinessFact[],
  scores: CategoryScores
): string[] {
  const recs: string[] = [];

  const byCategory = (cats: string[]) => ({
    all: all.filter((f) => cats.includes(f.category)),
    pub: publishable.filter((f) => cats.includes(f.category)),
  });

  const pricing = byCategory(["pricing"]);
  if (pricing.all.length === 0) {
    recs.push("Add pricing facts or pricing ranges so AI systems can answer pricing questions.");
  } else if (pricing.pub.length === 0) {
    recs.push("Review and approve pricing facts with clear evidence.");
  }

  const services = byCategory(["service", "product"]);
  if (services.all.length === 0) {
    recs.push("Add service and product facts describing what the business offers.");
  } else if (services.pub.length === 0) {
    recs.push("Review and approve service/product facts.");
  } else if (services.pub.length < 3) {
    recs.push("Expand service/product facts with more specific offerings and benefits.");
  }

  const faqs = byCategory(["faq"]);
  if (faqs.all.length === 0) {
    recs.push("Add clear FAQ answers for common buyer questions.");
  } else if (faqs.pub.length < 3) {
    recs.push("Add more complete FAQ answers backed by clear evidence from the page.");
  }

  const useCases = byCategory(["use_case"]);
  if (useCases.all.length === 0) {
    recs.push("Add use-case pages describing who the business helps and when.");
  } else if (useCases.pub.length < 3) {
    recs.push("Add more specific use cases with concrete outcomes and target personas.");
  }

  const differentiators = byCategory(["differentiator"]);
  if (differentiators.all.length === 0) {
    recs.push("Add specific, evidence-backed differentiators.");
  } else if (differentiators.pub.length === 0) {
    recs.push("Review differentiator facts — approve those with strong evidence.");
  }

  const policy = byCategory(["policy", "limitation"]);
  if (policy.all.length === 0) {
    recs.push(
      "Add cancellation, refund, trial, data, service limitation, or eligibility policies."
    );
  } else if (policy.pub.length === 0) {
    recs.push("Review and approve policy facts with supporting evidence.");
  }

  const company = byCategory(["company_profile"]);
  if (company.all.length === 0) {
    recs.push(
      "Add company profile facts: what the business does, who it serves, and when it was founded."
    );
  }

  const needsReviewCount = all.filter((f) => f.status === "needs_review").length;
  if (all.length > 0 && needsReviewCount / all.length > 0.25) {
    recs.push(
      "Review high-risk claims, proof points, and compliance/security claims. Run: agentranks review --reject-needs-review or approve selectively."
    );
  }

  if (scores.evidenceQuality < 6) {
    recs.push(
      "Add clearer source text for claims, pricing, policies, and differentiators. Evidence should be at least 30 characters and match the fact's claim."
    );
  }

  const lowPriorityCount = all.filter((f) => f.publishPriority === "low").length;
  if (all.length > 0 && lowPriorityCount / all.length > 0.3) {
    recs.push(
      "Group granular role/tool facts into broader service categories to reduce noise."
    );
  }

  const publishableRatio = all.length > 0 ? publishable.length / all.length : 0;
  if (publishableRatio < 0.4 && all.length > 0) {
    recs.push(
      "Approve low-risk facts or remove unsupported claims. Run: agentranks review --approve-low-risk"
    );
  }

  return recs.slice(0, 10);
}

// ─── Main scoring function ────────────────────────────────────────────────────

export function computeScore(facts: BusinessFact[]): ScoreReport {
  const publishable = facts.filter(isPublishable);

  const sectionStatuses = new Map<string, SectionStatus>();
  for (const section of SECTIONS) {
    const secAll = facts.filter((f) => section.categories.includes(f.category));
    const secPub = publishable.filter((f) => section.categories.includes(f.category));
    sectionStatuses.set(section.name, getSectionHealth(secAll, secPub, section.threshold));
  }

  const missingSections = SECTIONS
    .filter((s) => sectionStatuses.get(s.name) === "missing")
    .map((s) => s.label);
  const notPublishableSections = SECTIONS
    .filter((s) => sectionStatuses.get(s.name) === "notPublishable")
    .map((s) => s.label);
  const weakSections = SECTIONS
    .filter((s) => sectionStatuses.get(s.name) === "weak")
    .map((s) => s.label);
  const healthySections = SECTIONS
    .filter((s) => sectionStatuses.get(s.name) === "healthy")
    .map((s) => s.label);

  const healthySectionCount = healthySections.length;

  const categoryScores: CategoryScores = {
    companyProfile:        scoreCompanyProfile(facts, publishable),
    serviceProduct:        scoreServiceProduct(facts, publishable),
    pricingClarity:        scorePricingClarity(facts, publishable),
    faqCoverage:           scoreFaqCoverage(facts, publishable),
    policyClarity:         scorePolicyClarity(facts, publishable),
    useCaseCoverage:       scoreUseCaseCoverage(facts, publishable),
    differentiatorQuality: scoreDifferentiatorQuality(facts, publishable),
    evidenceQuality:       scoreEvidenceQuality(facts),
    riskBurden:            scoreRiskBurden(facts),
    outputReadiness:       scoreOutputReadiness(facts, publishable, healthySectionCount),
  };

  const overallScore = Math.round(
    Object.values(categoryScores).reduce((sum, s) => sum + s, 0) * 10 / 10
  );

  const counts: FactCounts = {
    totalFacts:       facts.length,
    publishableFacts: publishable.length,
    approvedFacts:    facts.filter((f) => f.status === "approved").length,
    extractedFacts:   facts.filter((f) => f.status === "extracted").length,
    needsReviewFacts: facts.filter((f) => f.status === "needs_review").length,
    rejectedFacts:    facts.filter((f) => f.status === "rejected").length,
    highRiskFacts:    facts.filter((f) => f.riskLevel === "high").length,
    lowPriorityFacts: facts.filter((f) => f.publishPriority === "low").length,
  };

  const recommendations = generateRecommendations(facts, publishable, categoryScores);

  return {
    overallScore,
    categoryScores,
    missingSections,
    notPublishableSections,
    weakSections,
    healthySections,
    counts,
    recommendations,
  };
}
