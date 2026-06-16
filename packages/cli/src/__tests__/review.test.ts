import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildReviewJson,
  buildReviewMd,
  applyReviewToFacts,
  approveLowRiskFacts,
  rejectNeedsReviewFacts,
  suggestedAction,
} from "../commands/review.js";
import type { BusinessFact } from "@agentranks/core";
import { filterPublishableFacts } from "@agentranks/publisher";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFact(overrides: Partial<BusinessFact> = {}): BusinessFact {
  return {
    id: "fact_aabbccdd1122",
    category: "service",
    claim: "Knacksters provides on-demand staffing for tech teams.",
    evidenceText: "on-demand staffing for tech teams",
    sourceUrl: "https://example.com/",
    confidence: 0.9,
    riskLevel: "low",
    status: "extracted",
    publishPriority: "core",
    extractedAt: "2026-06-04T23:00:00.000Z",
    ...overrides,
  };
}

// ─── buildReviewJson ──────────────────────────────────────────────────────────

describe("buildReviewJson", () => {
  it("returns a copy of all facts with all required fields", () => {
    const facts = [makeFact(), makeFact({ id: "fact_112233aabb", status: "needs_review" })];
    const result = buildReviewJson(facts);

    assert.equal(result.length, 2);
    assert.equal(result[0].id, facts[0].id);
    assert.equal(result[1].status, "needs_review");
    // Ensure all key fields are present
    assert.ok("publishPriority" in result[0]);
    assert.ok("riskLevel" in result[0]);
    assert.ok("evidenceText" in result[0]);
  });
});

// ─── buildReviewMd ────────────────────────────────────────────────────────────

describe("buildReviewMd", () => {
  it("groups facts with needs_review before extracted", () => {
    const facts = [
      makeFact({ id: "fact_aaa", status: "extracted" }),
      makeFact({ id: "fact_bbb", status: "needs_review", riskLevel: "high", category: "claim" }),
    ];
    const md = buildReviewMd(facts);

    const needsIdx = md.indexOf("## Needs Review");
    const extractedIdx = md.indexOf("## Extracted");
    assert.ok(needsIdx < extractedIdx, "needs_review section should come before extracted");
  });

  it("includes all required fields for each fact", () => {
    const fact = makeFact({
      claim: "We offer top-tier talent.",
      evidenceText: "top-tier talent",
      sourceUrl: "https://example.com/",
      confidence: 0.75,
      riskLevel: "high",
      publishPriority: "supporting",
    });
    const md = buildReviewMd([fact]);

    assert.ok(md.includes("We offer top-tier talent."), "claim should appear");
    assert.ok(md.includes("top-tier talent"), "evidenceText should appear");
    assert.ok(md.includes("https://example.com/"), "sourceUrl should appear");
    assert.ok(md.includes("75%"), "confidence should appear as percentage");
    assert.ok(md.includes("high"), "riskLevel should appear");
    assert.ok(md.includes("supporting"), "publishPriority should appear");
  });

  it("includes suggested action hint", () => {
    const fact = makeFact({ status: "needs_review", category: "proof_point", riskLevel: "medium" });
    const md = buildReviewMd([fact]);
    assert.ok(md.includes("Proof point"), "should mention proof point in action");
  });
});

// ─── applyReviewToFacts ───────────────────────────────────────────────────────

describe("applyReviewToFacts", () => {
  it("updates status when changed in review.json", () => {
    const existing = [makeFact({ id: "fact_001", status: "extracted" })];
    const review = [makeFact({ id: "fact_001", status: "approved" })];

    const { facts, stats } = applyReviewToFacts(review, existing);

    assert.equal(facts[0].status, "approved");
    assert.equal(stats.updated, 1);
    assert.equal(stats.unchanged, 0);
  });

  it("preserves rejected facts in output", () => {
    const existing = [
      makeFact({ id: "fact_001", status: "rejected" }),
      makeFact({ id: "fact_002", status: "extracted" }),
    ];
    const review = [
      makeFact({ id: "fact_001", status: "rejected" }),
      makeFact({ id: "fact_002", status: "approved" }),
    ];

    const { facts } = applyReviewToFacts(review, existing);

    const rejected = facts.find((f) => f.id === "fact_001");
    assert.equal(rejected?.status, "rejected", "rejected fact should be preserved");
  });

  it("keeps unreviewed facts unchanged", () => {
    const existing = [
      makeFact({ id: "fact_001", status: "extracted" }),
      makeFact({ id: "fact_002", status: "needs_review" }),
    ];
    // review.json only contains fact_001
    const review = [makeFact({ id: "fact_001", status: "approved" })];

    const { facts, stats } = applyReviewToFacts(review, existing);

    const unreviewedFact = facts.find((f) => f.id === "fact_002");
    assert.equal(unreviewedFact?.status, "needs_review", "unreviewed fact should be unchanged");
    assert.equal(stats.unchanged, 1); // fact_002 unchanged
  });

  it("reports correct status counts in stats", () => {
    const existing = [
      makeFact({ id: "fact_001", status: "extracted" }),
      makeFact({ id: "fact_002", status: "needs_review" }),
    ];
    const review = [
      makeFact({ id: "fact_001", status: "approved" }),
      makeFact({ id: "fact_002", status: "rejected" }),
    ];

    const { stats } = applyReviewToFacts(review, existing);

    assert.equal(stats.approved, 1);
    assert.equal(stats.rejected, 1);
  });
});

// ─── approveLowRiskFacts ──────────────────────────────────────────────────────

describe("approveLowRiskFacts", () => {
  it("approves extracted+low-risk+core facts", () => {
    const facts = [
      makeFact({ id: "fact_001", status: "extracted", riskLevel: "low", publishPriority: "core" }),
      makeFact({ id: "fact_002", status: "extracted", riskLevel: "low", publishPriority: "supporting" }),
    ];
    const { facts: updated, count } = approveLowRiskFacts(facts);

    assert.equal(count, 2);
    assert.ok(updated.every((f) => f.status === "approved"));
  });

  it("does not approve extracted+medium-risk facts", () => {
    const facts = [
      makeFact({ id: "fact_001", status: "extracted", riskLevel: "medium", publishPriority: "core" }),
    ];
    const { facts: updated, count } = approveLowRiskFacts(facts);

    assert.equal(count, 0);
    assert.equal(updated[0].status, "extracted");
  });

  it("does not approve extracted+low-risk+legal facts", () => {
    const facts = [
      makeFact({ id: "fact_001", status: "extracted", riskLevel: "low", publishPriority: "legal" }),
    ];
    const { facts: updated, count } = approveLowRiskFacts(facts);

    assert.equal(count, 0);
    assert.equal(updated[0].status, "extracted");
  });

  it("does not approve needs_review facts", () => {
    const facts = [
      makeFact({ id: "fact_001", status: "needs_review", riskLevel: "low", publishPriority: "core" }),
    ];
    const { facts: updated, count } = approveLowRiskFacts(facts);

    assert.equal(count, 0);
    assert.equal(updated[0].status, "needs_review");
  });
});

// ─── rejectNeedsReviewFacts ───────────────────────────────────────────────────

describe("rejectNeedsReviewFacts", () => {
  it("rejects all needs_review facts", () => {
    const facts = [
      makeFact({ id: "fact_001", status: "needs_review" }),
      makeFact({ id: "fact_002", status: "needs_review", category: "claim", riskLevel: "high" }),
      makeFact({ id: "fact_003", status: "extracted" }),
    ];
    const { facts: updated, count } = rejectNeedsReviewFacts(facts);

    assert.equal(count, 2);
    assert.equal(updated.filter((f) => f.status === "rejected").length, 2);
    assert.equal(updated.find((f) => f.id === "fact_003")?.status, "extracted");
  });

  it("does not touch extracted or approved facts", () => {
    const facts = [
      makeFact({ id: "fact_001", status: "approved" }),
      makeFact({ id: "fact_002", status: "extracted" }),
    ];
    const { count } = rejectNeedsReviewFacts(facts);
    assert.equal(count, 0);
  });
});

// ─── suggestedAction ─────────────────────────────────────────────────────────

describe("suggestedAction", () => {
  it("returns escalated message for high-risk claim", () => {
    const fact = makeFact({ status: "needs_review", category: "claim", riskLevel: "high" });
    assert.ok(suggestedAction(fact).includes("High-risk"));
  });

  it("returns proof point message for proof_point category", () => {
    const fact = makeFact({ status: "needs_review", category: "proof_point" });
    assert.ok(suggestedAction(fact).includes("Proof point"));
  });

  it("returns ready-to-approve message for low-risk extracted core fact", () => {
    const fact = makeFact({ status: "extracted", riskLevel: "low", publishPriority: "core" });
    assert.ok(suggestedAction(fact).includes("ready to approve"));
  });

  it("returns approved message for approved fact", () => {
    const fact = makeFact({ status: "approved" });
    assert.ok(suggestedAction(fact).includes("Approved"));
  });
});

// ─── Publisher: rejected facts excluded from generate ─────────────────────────

describe("Publisher filtering — rejected facts", () => {
  it("excludes rejected facts from default generate", () => {
    const facts = [
      makeFact({ id: "fact_001", status: "approved" }),
      makeFact({ id: "fact_002", status: "rejected" }),
      makeFact({ id: "fact_003", status: "extracted", riskLevel: "low" }),
    ];
    const { publishable, stats } = filterPublishableFacts(facts);

    assert.equal(stats.excluded.rejected, 1);
    assert.ok(!publishable.some((f) => f.status === "rejected"), "no rejected facts should be published");
  });

  it("excludes rejected facts in --strict mode", () => {
    const facts = [
      makeFact({ id: "fact_001", status: "approved" }),
      makeFact({ id: "fact_002", status: "rejected" }),
    ];
    const { publishable, stats } = filterPublishableFacts(facts, { strict: true });

    assert.equal(stats.excluded.rejected, 1);
    assert.equal(publishable.length, 1);
    assert.equal(publishable[0].status, "approved");
  });

  it("--strict mode excludes extracted facts", () => {
    const facts = [
      makeFact({ id: "fact_001", status: "approved" }),
      makeFact({ id: "fact_002", status: "extracted", riskLevel: "low", publishPriority: "core" }),
    ];
    const { publishable, stats } = filterPublishableFacts(facts, { strict: true });

    assert.equal(publishable.length, 1);
    assert.equal(publishable[0].id, "fact_001");
    assert.equal(stats.excluded.extracted_high_risk, 1);
  });

  it("default generate excludes needs_review facts", () => {
    const facts = [
      makeFact({ id: "fact_001", status: "needs_review", riskLevel: "high" }),
      makeFact({ id: "fact_002", status: "extracted", riskLevel: "low" }),
    ];
    const { publishable, stats } = filterPublishableFacts(facts);

    assert.equal(stats.excluded.needs_review, 1);
    assert.ok(!publishable.some((f) => f.status === "needs_review"));
  });
});
