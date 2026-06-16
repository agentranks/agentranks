import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { postProcessFacts } from "../extractor/index.js";
import type { RawFact } from "@agentranks/core";

const SOURCE_URL = "https://example.com/page";
const LEGAL_URL = "https://example.com/terms";
const PRICING_URL = "https://example.com/pricing";

function makeRawFact(overrides: Partial<RawFact> = {}): RawFact {
  return {
    category: "service",
    claim: "Knacksters provides on-demand staffing for tech teams.",
    evidenceText: "Knacksters provides on-demand staffing for tech teams.",
    confidence: 0.9,
    riskLevel: "low",
    ...overrides,
  };
}

// ─── FAQ completeness ──────────────────────────────────────────────────────────

describe("Incomplete FAQ answers", () => {
  it("drops FAQ fact with 'not explicitly provided' and creates a content gap", () => {
    const { facts, contentGaps } = postProcessFacts([
      makeRawFact({
        category: "faq",
        claim: "What is the refund policy?",
        detail: "Answer: Not explicitly provided on the page.",
        evidenceText: "Answer: Not explicitly provided on the page.",
      }),
    ], SOURCE_URL);

    assert.equal(facts.length, 0, "fact should be dropped");
    assert.equal(contentGaps.length, 1, "content gap should be created");
    assert.equal(contentGaps[0].type, "missing_faq_answer");
    assert.equal(contentGaps[0].question, "What is the refund policy?");
  });

  it("drops FAQ with 'not mentioned' in detail", () => {
    const { facts, contentGaps } = postProcessFacts([
      makeRawFact({
        category: "faq",
        claim: "Do you offer a free trial?",
        detail: "This is not mentioned on the page.",
        evidenceText: "free trial",
      }),
    ], SOURCE_URL);

    assert.equal(facts.length, 0);
    assert.equal(contentGaps.length, 1);
  });

  it("keeps FAQ fact that has a real answer", () => {
    const { facts, contentGaps } = postProcessFacts([
      makeRawFact({
        category: "faq",
        claim: "Do you offer a free trial?",
        detail: "Yes, Knacksters offers 50 free hours with no credit card required.",
        evidenceText: "50 free hours with no credit card required",
        confidence: 0.95,
      }),
    ], SOURCE_URL);

    assert.equal(facts.length, 1, "valid FAQ should be kept");
    assert.equal(contentGaps.length, 0);
  });

  it("drops FAQ with zero confidence", () => {
    const { facts } = postProcessFacts([
      makeRawFact({
        category: "faq",
        claim: "Is there enterprise support?",
        confidence: 0,
        evidenceText: "enterprise support",
      }),
    ], SOURCE_URL);

    assert.equal(facts.length, 0);
  });
});

// ─── Risk level escalation ─────────────────────────────────────────────────────

describe("Deterministic risk scoring", () => {
  it("escalates fact with SLA guarantee to high risk and needs_review", () => {
    const { facts } = postProcessFacts([
      makeRawFact({
        claim: "Knacksters offers an SLA guarantee of 99.9% uptime.",
        evidenceText: "SLA guarantee of 99.9% uptime",
        confidence: 0.85,
      }),
    ], SOURCE_URL);

    assert.equal(facts[0].riskLevel, "high");
    assert.equal(facts[0].status, "needs_review");
  });

  it("escalates GDPR compliance claim to high risk", () => {
    const { facts } = postProcessFacts([
      makeRawFact({
        claim: "The platform is GDPR-compliant and SOC 2 certified.",
        evidenceText: "GDPR-compliant and SOC 2 certified",
        confidence: 0.8,
      }),
    ], SOURCE_URL);

    assert.equal(facts[0].riskLevel, "high");
    assert.equal(facts[0].status, "needs_review");
  });

  it("escalates 'top-tier' claim to high risk and claim category", () => {
    const { facts } = postProcessFacts([
      makeRawFact({
        claim: "We offer top-tier talent with no quality compromises.",
        evidenceText: "top-tier talent with no quality compromises",
        confidence: 0.7,
      }),
    ], SOURCE_URL);

    assert.equal(facts[0].riskLevel, "high");
    assert.equal(facts[0].category, "claim");
    assert.equal(facts[0].status, "needs_review");
  });

  it("escalates 'industry-leading' to high risk", () => {
    const { facts } = postProcessFacts([
      makeRawFact({
        claim: "Knacksters is the industry-leading staffing platform.",
        evidenceText: "industry-leading staffing platform",
      }),
    ], SOURCE_URL);

    assert.equal(facts[0].riskLevel, "high");
  });

  it("escalates 'guaranteed' to high risk and needs_review", () => {
    const { facts } = postProcessFacts([
      makeRawFact({
        claim: "Replacement candidates are guaranteed within 48 hours.",
        evidenceText: "guaranteed within 48 hours",
      }),
    ], SOURCE_URL);

    assert.equal(facts[0].riskLevel, "high");
    assert.equal(facts[0].status, "needs_review");
  });
});

// ─── proof_point always needs_review ──────────────────────────────────────────

describe("proof_point category", () => {
  it("always sets proof_point facts to needs_review", () => {
    const { facts } = postProcessFacts([
      makeRawFact({
        category: "proof_point",
        claim: "Knacksters has delivered over 964,400 hours to clients.",
        evidenceText: "over 964,400 hours",
        confidence: 0.9,
      }),
    ], SOURCE_URL);

    assert.equal(facts[0].status, "needs_review");
    assert.equal(facts[0].riskLevel !== "low", true, "proof_point should not be low risk");
  });
});

// ─── Weak evidence ─────────────────────────────────────────────────────────────

describe("Evidence quality", () => {
  it("marks needs_review when evidenceText is too short", () => {
    const { facts } = postProcessFacts([
      makeRawFact({
        category: "pricing",
        claim: "Enterprise pricing is custom and includes white-label options.",
        evidenceText: "Enterprise Custom",
        confidence: 0.8,
      }),
    ], PRICING_URL);

    assert.equal(facts[0].status, "needs_review");
  });

  it("marks needs_review when claim has numbers but evidence does not", () => {
    const { facts } = postProcessFacts([
      makeRawFact({
        claim: "The platform supports 50,000 active professionals.",
        evidenceText: "active professionals",
        confidence: 0.8,
      }),
    ], SOURCE_URL);

    assert.equal(facts[0].status, "needs_review");
  });

  it("keeps approved status when evidence is strong and claim is simple", () => {
    const { facts } = postProcessFacts([
      makeRawFact({
        category: "service",
        claim: "Knacksters provides on-demand staffing for tech teams.",
        evidenceText: "on-demand staffing for tech teams at Knacksters",
        confidence: 0.9,
      }),
    ], SOURCE_URL);

    assert.equal(facts[0].status, "extracted");
    assert.equal(facts[0].riskLevel, "low");
  });
});

// ─── publishPriority ───────────────────────────────────────────────────────────

describe("publishPriority", () => {
  it("assigns legal priority to facts from /terms URL", () => {
    const { facts } = postProcessFacts([
      makeRawFact({
        category: "policy",
        claim: "Users must not share account credentials.",
        evidenceText: "Users must not share account credentials with third parties.",
        confidence: 0.95,
      }),
    ], LEGAL_URL);

    assert.equal(facts[0].publishPriority, "legal");
  });

  it("assigns core priority to service facts with detail", () => {
    const { facts } = postProcessFacts([
      makeRawFact({
        category: "service",
        claim: "Knacksters provides embedded engineering teams for product development.",
        detail: "Available for startups and enterprises.",
        evidenceText: "embedded engineering teams for product development",
        confidence: 0.9,
      }),
    ], SOURCE_URL);

    assert.equal(facts[0].publishPriority, "core");
  });

  it("assigns low priority to short service facts with no detail", () => {
    const { facts } = postProcessFacts([
      makeRawFact({
        category: "service",
        claim: "React development",
        evidenceText: "React development",
        confidence: 0.8,
      }),
    ], SOURCE_URL);

    assert.equal(facts[0].publishPriority, "low");
  });
});
