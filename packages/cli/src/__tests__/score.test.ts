import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPublishable,
  isExcluded,
  getSectionHealth,
  scoreCompanyProfile,
  scoreServiceProduct,
  scorePricingClarity,
  scoreFaqCoverage,
  scorePolicyClarity,
  scoreUseCaseCoverage,
  scoreDifferentiatorQuality,
  scoreEvidenceQuality,
  scoreRiskBurden,
  scoreOutputReadiness,
  computeScore,
  generateRecommendations,
  SECTIONS,
} from "../commands/score/index.js";
import type { BusinessFact } from "@agentranks/core";

// ─── Fixture helpers ───────────────────────────────────────────────────────────

let factIdx = 0;
function makeFact(overrides: Partial<BusinessFact> = {}): BusinessFact {
  factIdx++;
  return {
    id: `fact_${String(factIdx).padStart(4, "0")}`,
    category: "service",
    claim: "Knacksters provides on-demand staffing for tech teams.",
    evidenceText: "on-demand staffing for tech teams at Knacksters, available globally",
    sourceUrl: "https://example.com/",
    confidence: 0.9,
    riskLevel: "low",
    status: "extracted",
    publishPriority: "core",
    extractedAt: "2026-06-04T23:00:00.000Z",
    ...overrides,
  };
}

function makeFacts(
  count: number,
  overrides: Partial<BusinessFact> = {}
): BusinessFact[] {
  return Array.from({ length: count }, () => makeFact(overrides));
}

// ─── isPublishable ─────────────────────────────────────────────────────────────

describe("isPublishable", () => {
  it("does NOT publish approved high-risk facts (score mode excludes high-risk)", () => {
    assert.ok(!isPublishable(makeFact({ status: "approved", riskLevel: "high" })));
  });

  it("publishes extracted+low-risk+core facts", () => {
    assert.ok(isPublishable(makeFact({ status: "extracted", riskLevel: "low", publishPriority: "core" })));
  });

  it("publishes extracted+low-risk+supporting facts", () => {
    assert.ok(isPublishable(makeFact({ status: "extracted", riskLevel: "low", publishPriority: "supporting" })));
  });

  it("does NOT publish extracted+medium-risk facts", () => {
    assert.ok(!isPublishable(makeFact({ status: "extracted", riskLevel: "medium", publishPriority: "core" })));
  });

  it("does NOT publish extracted+low-risk+low-priority facts", () => {
    assert.ok(!isPublishable(makeFact({ status: "extracted", riskLevel: "low", publishPriority: "low" })));
  });

  it("does NOT publish needs_review facts", () => {
    assert.ok(!isPublishable(makeFact({ status: "needs_review" })));
  });

  it("does NOT publish rejected facts", () => {
    assert.ok(!isPublishable(makeFact({ status: "rejected" })));
  });
});

// ─── isExcluded ───────────────────────────────────────────────────────────────

describe("isExcluded", () => {
  it("excludes needs_review facts", () => {
    assert.ok(isExcluded(makeFact({ status: "needs_review" })));
  });

  it("excludes rejected facts", () => {
    assert.ok(isExcluded(makeFact({ status: "rejected" })));
  });

  it("excludes high-risk facts", () => {
    assert.ok(isExcluded(makeFact({ riskLevel: "high" })));
  });

  it("excludes low-priority facts", () => {
    assert.ok(isExcluded(makeFact({ publishPriority: "low" })));
  });

  it("does NOT exclude approved low-risk core facts", () => {
    assert.ok(!isExcluded(makeFact({ status: "approved", riskLevel: "low", publishPriority: "core" })));
  });
});

// ─── getSectionHealth ─────────────────────────────────────────────────────────

describe("getSectionHealth", () => {
  it("returns missing when no facts exist in section", () => {
    assert.equal(getSectionHealth([], [], 2), "missing");
  });

  it("returns notPublishable when facts exist but none publishable", () => {
    const facts = makeFacts(3, { status: "needs_review" });
    assert.equal(getSectionHealth(facts, [], 2), "notPublishable");
  });

  it("returns healthy when publishable count meets threshold", () => {
    const facts = makeFacts(3, { status: "extracted", riskLevel: "low" });
    const pub = facts.filter(isPublishable);
    assert.equal(getSectionHealth(facts, pub, 2), "healthy");
  });

  it("returns weak when publishable count is below threshold", () => {
    const facts = makeFacts(1, { status: "extracted", riskLevel: "low" });
    const pub = facts.filter(isPublishable);
    assert.equal(getSectionHealth(facts, pub, 3), "weak");
  });

  it("returns weak when more than 40% of facts need review", () => {
    const facts = [
      ...makeFacts(3, { status: "needs_review" }),
      ...makeFacts(4, { status: "extracted", riskLevel: "low" }),
    ];
    const pub = facts.filter(isPublishable);
    // 3/7 = 43% needs_review → weak
    assert.equal(getSectionHealth(facts, pub, 2), "weak");
  });

  it("returns weak when average confidence is below 0.7", () => {
    const facts = makeFacts(5, { confidence: 0.5, status: "extracted", riskLevel: "low" });
    const pub = facts.filter(isPublishable);
    assert.equal(getSectionHealth(facts, pub, 2), "weak");
  });
});

// ─── Section score functions ───────────────────────────────────────────────────

describe("scoreCompanyProfile", () => {
  it("returns 0 when no company_profile facts", () => {
    assert.equal(scoreCompanyProfile([], []), 0);
  });

  it("returns 4 when facts exist but none publishable", () => {
    const all = makeFacts(2, { category: "company_profile", status: "needs_review" });
    assert.equal(scoreCompanyProfile(all, []), 4);
  });

  it("returns 7 for 1 publishable company_profile fact", () => {
    const all = makeFacts(1, { category: "company_profile" });
    const pub = all.filter(isPublishable);
    assert.equal(scoreCompanyProfile(all, pub), 7);
  });

  it("returns 10 for 2+ publishable company_profile facts", () => {
    const all = makeFacts(2, { category: "company_profile" });
    const pub = all.filter(isPublishable);
    assert.equal(scoreCompanyProfile(all, pub), 10);
  });
});

describe("scoreServiceProduct", () => {
  it("returns 0 for no facts", () => {
    assert.equal(scoreServiceProduct([], []), 0);
  });

  it("returns 2 when facts exist but none publishable", () => {
    const all = makeFacts(3, { category: "service", status: "needs_review" });
    assert.equal(scoreServiceProduct(all, []), 2);
  });

  it("returns 5 for 1-2 publishable facts", () => {
    const all = makeFacts(2, { category: "service" });
    const pub = all.filter(isPublishable);
    assert.equal(scoreServiceProduct(all, pub), 5);
  });

  it("returns 8 for 3-4 publishable facts", () => {
    const all = makeFacts(3, { category: "service" });
    const pub = all.filter(isPublishable);
    assert.equal(scoreServiceProduct(all, pub), 8);
  });

  it("returns 10 for 5+ publishable facts", () => {
    const all = makeFacts(5, { category: "service" });
    const pub = all.filter(isPublishable);
    assert.equal(scoreServiceProduct(all, pub), 10);
  });
});

describe("scorePricingClarity", () => {
  it("returns 0 for no pricing facts", () => {
    assert.equal(scorePricingClarity([], []), 0);
  });

  it("returns 4 when pricing facts exist but none publishable", () => {
    const all = makeFacts(2, { category: "pricing", status: "needs_review" });
    assert.equal(scorePricingClarity(all, []), 4);
  });

  it("returns 7 for 1-2 publishable pricing facts", () => {
    const all = makeFacts(2, { category: "pricing" });
    const pub = all.filter(isPublishable);
    assert.equal(scorePricingClarity(all, pub), 7);
  });

  it("returns 10 for 3+ publishable pricing facts", () => {
    const all = makeFacts(3, { category: "pricing" });
    const pub = all.filter(isPublishable);
    assert.equal(scorePricingClarity(all, pub), 10);
  });
});

// ─── Evidence quality scoring ─────────────────────────────────────────────────

describe("scoreEvidenceQuality", () => {
  it("returns 0 for empty fact list", () => {
    assert.equal(scoreEvidenceQuality([]), 0);
  });

  it("returns 10 when 95%+ facts have 30+ char evidence", () => {
    const facts = makeFacts(20, {
      evidenceText: "This is a long evidence text that is more than thirty characters.",
    });
    assert.equal(scoreEvidenceQuality(facts), 10);
  });

  it("returns 5 when 60-79% of facts have strong evidence", () => {
    const strong = makeFacts(7, { evidenceText: "Long enough evidence text with more than thirty characters." });
    const weak = makeFacts(3, { evidenceText: "short" });
    // 7/10 = 70% → should be 5
    assert.equal(scoreEvidenceQuality([...strong, ...weak]), 5);
  });

  it("returns 0 when below 30% have strong evidence", () => {
    const strong = makeFacts(2, { evidenceText: "Long enough evidence text with more than thirty characters." });
    const weak = makeFacts(8, { evidenceText: "short" });
    // 2/10 = 20% → 0
    assert.equal(scoreEvidenceQuality([...strong, ...weak]), 0);
  });

  it("penalizes by 2 when many claims have numbers but evidence does not", () => {
    const facts = makeFacts(10, {
      claim: "Knacksters has over 964,400 hours delivered.",
      evidenceText: "Long enough evidence text but without matching numbers clearly here.",
    });
    // All 10 facts have numeric claim but evidence lacks the number
    const score = scoreEvidenceQuality(facts);
    // Would be 10 for 30+ char evidence, but -2 for numeric mismatch
    assert.equal(score, 8);
  });
});

// ─── Risk/review burden scoring ───────────────────────────────────────────────

describe("scoreRiskBurden", () => {
  it("returns 10 for empty fact list", () => {
    assert.equal(scoreRiskBurden([]), 10);
  });

  it("returns 10 when combined needs_review+high-risk ratio < 10%", () => {
    const facts = makeFacts(20); // all extracted+low
    assert.equal(scoreRiskBurden(facts), 10);
  });

  it("returns 8 for 10-20% ratio", () => {
    const facts = [
      ...makeFacts(2, { status: "needs_review" }),
      ...makeFacts(10),
    ];
    // 2/12 ≈ 17%
    assert.equal(scoreRiskBurden(facts), 8);
  });

  it("returns 5 for 20-35% ratio", () => {
    const facts = [
      ...makeFacts(3, { status: "needs_review" }),
      ...makeFacts(7),
    ];
    // 3/10 = 30%
    assert.equal(scoreRiskBurden(facts), 5);
  });

  it("returns 0 for >50% ratio", () => {
    const facts = [
      ...makeFacts(6, { status: "needs_review" }),
      ...makeFacts(4),
    ];
    // 6/10 = 60%
    assert.equal(scoreRiskBurden(facts), 0);
  });
});

// ─── Output readiness scoring ─────────────────────────────────────────────────

// Helper: make a balanced set of service+pricing facts so the pricing-missing penalty never fires
function makeBalancedFacts(serviceCount: number, pricingCount: number, overrides: Partial<BusinessFact> = {}): BusinessFact[] {
  return [
    ...makeFacts(serviceCount, { category: "service", ...overrides }),
    ...makeFacts(pricingCount, { category: "pricing", ...overrides }),
  ];
}

describe("scoreOutputReadiness", () => {
  it("returns 0 when no publishable facts", () => {
    assert.equal(scoreOutputReadiness(makeFacts(5, { status: "needs_review" }), [], 0), 0);
  });

  it("returns 2 for 1-9 publishable facts", () => {
    // 3 service + 2 pricing = 5 publishable; no pricing penalty
    const all = makeBalancedFacts(3, 2);
    const pub = all.filter(isPublishable);
    assert.equal(scoreOutputReadiness(all, pub, 0), 2);
  });

  it("returns 5 for 10-24 publishable facts", () => {
    const all = makeBalancedFacts(8, 4);
    const pub = all.filter(isPublishable);
    assert.equal(scoreOutputReadiness(all, pub, 2), 5);
  });

  it("returns 8 for 25+ publishable facts with 3+ healthy sections", () => {
    const all = makeBalancedFacts(20, 10);
    const pub = all.filter(isPublishable);
    assert.equal(scoreOutputReadiness(all, pub, 4), 8);
  });

  it("returns 10 for 50+ publishable facts with 5+ healthy sections", () => {
    const all = makeBalancedFacts(40, 20);
    const pub = all.filter(isPublishable);
    assert.equal(scoreOutputReadiness(all, pub, 6), 10);
  });

  it("penalizes by 2 when 40%+ facts are low priority", () => {
    const low = makeFacts(5, { publishPriority: "low", status: "extracted", riskLevel: "low" });
    // core has service+pricing so the pricing-missing penalty does not confound the result
    const core = makeBalancedFacts(3, 2);
    const all = [...low, ...core];
    // low facts are not publishable (publishPriority:"low"); core facts are
    const pub = all.filter(isPublishable); // 5 publishable
    // Without low-priority bulk: 0/5 = 0% → no penalty
    const withoutPenalty = scoreOutputReadiness(core, pub, 0);
    // With low-priority bulk: 5/10 = 50% → −2 penalty
    const withPenalty = scoreOutputReadiness(all, pub, 0);
    assert.ok(withPenalty <= withoutPenalty - 2, "low-priority penalty should apply");
  });

  it("penalizes by 2 when pricing or service is missing from publishable", () => {
    // Only service facts → pricing penalty fires
    const serviceOnly = makeFacts(30, { category: "service" });
    const pubServiceOnly = serviceOnly.filter(isPublishable);
    const withoutPricing = scoreOutputReadiness(serviceOnly, pubServiceOnly, 3);

    // Adding pricing facts removes the penalty
    const withPricing = [...serviceOnly, ...makeFacts(3, { category: "pricing" })];
    const pubWithPricing = withPricing.filter(isPublishable);
    const withBoth = scoreOutputReadiness(withPricing, pubWithPricing, 3);

    assert.ok(withBoth > withoutPricing, "having both service and pricing should score higher");
  });
});

// ─── computeScore integration ─────────────────────────────────────────────────

describe("computeScore", () => {
  it("identifies missing sections correctly", () => {
    const facts = makeFacts(3, { category: "service" });
    const report = computeScore(facts);
    // company_profile, pricing, faq, policy, use_case, differentiator should all be missing
    assert.ok(report.missingSections.includes("Company Profile"));
    assert.ok(report.missingSections.includes("Pricing"));
    assert.ok(report.missingSections.includes("FAQ"));
  });

  it("identifies not-publishable sections", () => {
    const facts = [
      makeFact({ category: "pricing", status: "needs_review" }),
      makeFact({ category: "pricing", status: "needs_review" }),
    ];
    const report = computeScore(facts);
    assert.ok(report.notPublishableSections.includes("Pricing"));
  });

  it("identifies healthy sections", () => {
    const facts = [
      ...makeFacts(5, { category: "service" }),
      ...makeFacts(3, { category: "pricing" }),
    ];
    const report = computeScore(facts);
    assert.ok(report.healthySections.includes("Service/Product"));
    assert.ok(report.healthySections.includes("Pricing"));
  });

  it("identifies weak sections", () => {
    const facts = [
      // 1 publishable service fact — below threshold of 3 → weak
      makeFact({ category: "service" }),
    ];
    const report = computeScore(facts);
    assert.ok(report.weakSections.includes("Service/Product"));
  });

  it("overall score is 0-100", () => {
    const report = computeScore([]);
    assert.ok(report.overallScore >= 0 && report.overallScore <= 100);
  });

  it("a well-populated fact set scores higher than an empty one", () => {
    const emptyReport = computeScore([]);
    const richFacts = [
      ...makeFacts(2, { category: "company_profile" }),
      ...makeFacts(5, { category: "service" }),
      ...makeFacts(3, { category: "pricing" }),
      ...makeFacts(5, { category: "faq" }),
      ...makeFacts(4, { category: "policy" }),
      ...makeFacts(5, { category: "use_case" }),
      ...makeFacts(4, { category: "differentiator" }),
    ];
    const richReport = computeScore(richFacts);
    assert.ok(richReport.overallScore > emptyReport.overallScore);
  });
});

// ─── Recommendations ──────────────────────────────────────────────────────────

describe("generateRecommendations", () => {
  it("recommends adding pricing when no pricing facts", () => {
    const facts = makeFacts(5, { category: "service" });
    const pub = facts.filter(isPublishable);
    const scores = computeScore(facts).categoryScores;
    const recs = generateRecommendations(facts, pub, scores);
    assert.ok(recs.some((r) => r.toLowerCase().includes("pricing")));
  });

  it("recommends reviewing pricing when facts exist but none publishable", () => {
    const facts = makeFacts(3, { category: "pricing", status: "needs_review" });
    const pub: BusinessFact[] = [];
    const scores = computeScore(facts).categoryScores;
    const recs = generateRecommendations(facts, pub, scores);
    assert.ok(recs.some((r) => r.toLowerCase().includes("pricing")));
  });

  it("recommends adding FAQs when none exist", () => {
    const facts = makeFacts(5, { category: "service" });
    const pub = facts.filter(isPublishable);
    const scores = computeScore(facts).categoryScores;
    const recs = generateRecommendations(facts, pub, scores);
    assert.ok(recs.some((r) => r.toLowerCase().includes("faq") || r.toLowerCase().includes("buyer questions")));
  });

  it("recommends reviewing needs_review facts when ratio is high", () => {
    const facts = [
      ...makeFacts(3, { status: "needs_review" }),
      makeFact(),
    ];
    const pub = facts.filter(isPublishable);
    const scores = computeScore(facts).categoryScores;
    const recs = generateRecommendations(facts, pub, scores);
    assert.ok(recs.some((r) => r.toLowerCase().includes("review") || r.toLowerCase().includes("needs_review")));
  });

  it("recommends grouping granular facts when low-priority ratio is high", () => {
    const facts = [
      ...makeFacts(4, { publishPriority: "low" }),
      makeFact(),
    ];
    const pub = facts.filter(isPublishable);
    const scores = computeScore(facts).categoryScores;
    const recs = generateRecommendations(facts, pub, scores);
    assert.ok(recs.some((r) => r.toLowerCase().includes("group") || r.toLowerCase().includes("granular")));
  });

  it("returns at most 10 recommendations", () => {
    // Minimal facts to trigger many failures
    const facts: BusinessFact[] = [];
    const scores = computeScore(facts).categoryScores;
    const recs = generateRecommendations(facts, [], scores);
    assert.ok(recs.length <= 10);
  });
});
