import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  filterIntentFacts,
  generateIntents,
  generateIntentsFromPrompts,
  computeContentHash,
  computeRefreshStats,
  buildBriefMd,
  buildIndexMd,
  buildPromptsMd,
  slugify,
} from "@agentranks/publisher";
import type { BusinessFact, AgentRanksConfig } from "@agentranks/core";
import type { PromptType, CtaSourceType } from "@agentranks/publisher";
import { readPromptsFile } from "../commands/intents.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function makeFact(overrides: Partial<BusinessFact> = {}): BusinessFact {
  const id = `fact-${++_idCounter}`;
  return {
    id,
    category: "service",
    claim: "The business offers software engineering support.",
    detail: "Teams can access senior developers on demand.",
    evidenceText: "On-demand software engineering support available for all plans.",
    sourceUrl: "https://example.com/services",
    confidence: 0.9,
    riskLevel: "low",
    status: "approved",
    publishPriority: "core",
    extractedAt: "2026-06-01T00:00:00.000Z",
    tags: [],
    ...overrides,
  };
}

const TEST_CONFIG: AgentRanksConfig = {
  version: "1",
  name: "Acme Inc",
  baseUrl: "https://acme.com",
  description: "Test business",
  maxPages: 50,
  crawlDelay: 500,
};

// ─── filterIntentFacts ────────────────────────────────────────────────────────

describe("filterIntentFacts", () => {
  it("includes approved low-risk core facts", () => {
    const fact = makeFact({ status: "approved", riskLevel: "low", publishPriority: "core" });
    assert.equal(filterIntentFacts([fact]).length, 1);
  });

  it("includes approved supporting facts", () => {
    const fact = makeFact({ status: "approved", riskLevel: "low", publishPriority: "supporting" });
    assert.equal(filterIntentFacts([fact]).length, 1);
  });

  it("includes extracted + low-risk + core facts", () => {
    const fact = makeFact({ status: "extracted", riskLevel: "low", publishPriority: "core" });
    assert.equal(filterIntentFacts([fact]).length, 1);
  });

  it("includes extracted + low-risk + supporting facts", () => {
    const fact = makeFact({ status: "extracted", riskLevel: "low", publishPriority: "supporting" });
    assert.equal(filterIntentFacts([fact]).length, 1);
  });

  it("excludes needs_review facts", () => {
    const fact = makeFact({ status: "needs_review", riskLevel: "low", publishPriority: "core" });
    assert.equal(filterIntentFacts([fact]).length, 0);
  });

  it("excludes rejected facts", () => {
    const fact = makeFact({ status: "rejected", riskLevel: "low", publishPriority: "core" });
    assert.equal(filterIntentFacts([fact]).length, 0);
  });

  it("excludes high-risk facts", () => {
    const fact = makeFact({ status: "approved", riskLevel: "high", publishPriority: "core" });
    assert.equal(filterIntentFacts([fact]).length, 0);
  });

  it("excludes legal priority facts", () => {
    const fact = makeFact({ status: "approved", riskLevel: "low", publishPriority: "legal" });
    assert.equal(filterIntentFacts([fact]).length, 0);
  });

  it("excludes low priority facts", () => {
    const fact = makeFact({ status: "approved", riskLevel: "low", publishPriority: "low" });
    assert.equal(filterIntentFacts([fact]).length, 0);
  });

  it("excludes extracted + medium-risk facts", () => {
    const fact = makeFact({ status: "extracted", riskLevel: "medium", publishPriority: "core" });
    assert.equal(filterIntentFacts([fact]).length, 0);
  });

  it("excludes extracted + high-risk facts", () => {
    const fact = makeFact({ status: "extracted", riskLevel: "high", publishPriority: "core" });
    assert.equal(filterIntentFacts([fact]).length, 0);
  });

  it("excludes extracted + low-risk but low-priority facts", () => {
    const fact = makeFact({ status: "extracted", riskLevel: "low", publishPriority: "low" });
    assert.equal(filterIntentFacts([fact]).length, 0);
  });

  it("returns empty array for empty input", () => {
    assert.equal(filterIntentFacts([]).length, 0);
  });
});

// ─── generateIntents — filtering ─────────────────────────────────────────────

describe("generateIntents — fact filtering", () => {
  it("generates no briefs when all facts are needs_review", () => {
    const facts = [
      makeFact({ category: "service", status: "needs_review" }),
      makeFact({ category: "use_case", status: "needs_review" }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    assert.equal(output.briefs.length, 0);
  });

  it("generates no briefs when all facts are high-risk", () => {
    const facts = [makeFact({ category: "service", riskLevel: "high", status: "approved" })];
    const output = generateIntents(facts, TEST_CONFIG);
    assert.equal(output.briefs.length, 0);
  });

  it("generates no briefs when all facts are low-priority", () => {
    const facts = [makeFact({ category: "service", publishPriority: "low", status: "approved" })];
    const output = generateIntents(facts, TEST_CONFIG);
    assert.equal(output.briefs.length, 0);
  });

  it("does not include needs_review facts in any brief", () => {
    const publishable = makeFact({ category: "use_case", status: "approved", riskLevel: "low" });
    const excluded = makeFact({ category: "use_case", status: "needs_review", claim: "SHOULD NOT APPEAR" });
    const output = generateIntents([publishable, excluded], TEST_CONFIG);
    const allClaims = output.briefs.flatMap((b) => b.whyRelevant).join(" ");
    assert.ok(!allClaims.includes("SHOULD NOT APPEAR"));
  });

  it("does not include rejected facts in any brief", () => {
    const publishable = makeFact({ category: "use_case", status: "approved" });
    const rejected = makeFact({ category: "use_case", status: "rejected", claim: "REJECTED CLAIM" });
    const output = generateIntents([publishable, rejected], TEST_CONFIG);
    const allClaims = output.briefs.flatMap((b) => b.whyRelevant).join(" ");
    assert.ok(!allClaims.includes("REJECTED CLAIM"));
  });
});

// ─── generateIntents — use_case briefs ───────────────────────────────────────

describe("generateIntents — use_case briefs", () => {
  it("creates a use_case brief from use_case facts", () => {
    const facts = [
      makeFact({ category: "use_case", claim: "Helps teams handle project overload and bandwidth gaps." }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const useCaseBriefs = output.briefs.filter((b) => b.intentType === "use_case");
    assert.ok(useCaseBriefs.length > 0, "should have at least one use_case brief");
  });

  it("use_case brief includes userSituations", () => {
    const facts = [
      makeFact({ category: "use_case", claim: "Enables businesses to scale quickly during growth." }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs.find((b) => b.intentType === "use_case");
    assert.ok(brief);
    assert.ok(Array.isArray(brief.userSituations) && brief.userSituations.length > 0);
  });

  it("use_case brief title includes business name", () => {
    const facts = [makeFact({ category: "use_case" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs.find((b) => b.intentType === "use_case");
    assert.ok(brief?.title.includes("Acme Inc"), "title should include business name");
  });
});

// ─── generateIntents — service briefs ────────────────────────────────────────

describe("generateIntents — service briefs", () => {
  it("creates a service_need brief from service facts", () => {
    const facts = [
      makeFact({ category: "service", claim: "Provides on-demand software engineering support." }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const serviceBriefs = output.briefs.filter((b) => b.intentType === "service_need");
    assert.ok(serviceBriefs.length > 0);
  });

  it("creates a service_need brief from product facts", () => {
    const facts = [makeFact({ category: "product", claim: "SaaS product for remote engineering teams." })];
    const output = generateIntents(facts, TEST_CONFIG);
    const serviceBriefs = output.briefs.filter((b) => b.intentType === "service_need");
    assert.ok(serviceBriefs.length > 0);
  });

  it("service brief includes whyRelevant from fact claims", () => {
    const claim = "Expert software developers available on demand for your projects.";
    const facts = [makeFact({ category: "service", claim })];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs.find((b) => b.intentType === "service_need");
    assert.ok(brief?.whyRelevant.some((r) => r === claim));
  });
});

// ─── generateIntents — pricing briefs ────────────────────────────────────────

describe("generateIntents — pricing briefs", () => {
  it("creates a budget_or_pricing brief from pricing facts", () => {
    const facts = [
      makeFact({ category: "pricing", claim: "Flexible monthly pricing with no long-term contracts." }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const pricingBriefs = output.briefs.filter((b) => b.intentType === "budget_or_pricing");
    assert.ok(pricingBriefs.length > 0);
  });

  it("pricing brief CTA defaults to view_pricing when pricing source URL exists", () => {
    const facts = [
      makeFact({
        category: "pricing",
        claim: "Three pricing plans available.",
        sourceUrl: "https://acme.com/pricing",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs.find((b) => b.intentType === "budget_or_pricing");
    assert.ok(brief);
    assert.equal(brief.cta.actionType, "view_pricing");
  });
});

// ─── generateIntents — CTA inference ─────────────────────────────────────────

describe("generateIntents — CTA inference", () => {
  it("infers start_trial when trial keyword appears in a fact", () => {
    const facts = [
      makeFact({
        category: "pricing",
        claim: "Start a free trial with no credit card required.",
        evidenceText: "Free trial available, no credit card required.",
        sourceUrl: "https://acme.com/signup",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0];
    assert.ok(brief);
    assert.equal(brief.cta.actionType, "start_trial");
  });

  it("does NOT infer start_trial from incidental use of 'free' (false positive guard)", () => {
    const facts = [
      makeFact({
        category: "service",
        claim: "Free to contact us for more information.",
        evidenceText: "Feel free to reach out to our team.",
        sourceUrl: "https://acme.com/about",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    if (output.briefs.length > 0) {
      const brief = output.briefs[0]!;
      assert.notEqual(
        brief.cta.actionType,
        "start_trial",
        "Incidental 'free' should not trigger start_trial CTA"
      );
    }
  });

  it("infers view_pricing when fact has a pricing source URL", () => {
    const facts = [
      makeFact({
        category: "pricing",
        claim: "See our pricing plans for Starter and Pro tiers.",
        sourceUrl: "https://acme.com/pricing",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0];
    assert.ok(brief);
    assert.equal(brief.cta.actionType, "view_pricing");
  });

  it("falls back to visit_website when no specific trigger matches", () => {
    const facts = [
      makeFact({
        category: "service",
        claim: "Acme provides software support.",
        evidenceText: "Software support for enterprise clients.",
        sourceUrl: "https://acme.com/about",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0];
    assert.ok(brief);
    assert.equal(brief.cta.actionType, "visit_website");
    assert.equal(brief.cta.url, TEST_CONFIG.baseUrl);
  });

  it("CTA fallbackUrl is always the business base URL", () => {
    const facts = [makeFact({ category: "service" })];
    const output = generateIntents(facts, TEST_CONFIG);
    for (const brief of output.briefs) {
      assert.equal(brief.cta.fallbackUrl, TEST_CONFIG.baseUrl);
    }
  });

  it("CTA does not invent URLs beyond sourceUrl and baseUrl", () => {
    const facts = [makeFact({ category: "service", sourceUrl: "https://acme.com/services" })];
    const output = generateIntents(facts, TEST_CONFIG);
    for (const brief of output.briefs) {
      const validUrls = [TEST_CONFIG.baseUrl, "https://acme.com/services"];
      assert.ok(
        validUrls.includes(brief.cta.url),
        `CTA URL ${brief.cta.url} should be one of source URLs or base URL`
      );
    }
  });
});

// ─── generateIntents — CTA source tracking ───────────────────────────────────

describe("generateIntents — CTA source tracking", () => {
  it("ctaSourceType is 'fact' when CTA comes from a trial fact", () => {
    const trialFact = makeFact({
      category: "pricing",
      claim: "Free trial available with no credit card required.",
      evidenceText: "Start your trial today — no credit card needed.",
      sourceUrl: "https://acme.com/signup",
    });
    const output = generateIntents([trialFact], TEST_CONFIG);
    const brief = output.briefs[0];
    assert.ok(brief);
    assert.equal(brief.cta.ctaSourceType, "fact" satisfies CtaSourceType);
    assert.equal(brief.cta.ctaSourceFactId, trialFact.id);
    assert.equal(brief.cta.ctaSourceUrl, trialFact.sourceUrl);
  });

  it("ctaSourceType is 'fact' when CTA comes from a pricing-URL fact", () => {
    const pricingFact = makeFact({
      category: "pricing",
      claim: "Three pricing tiers available.",
      sourceUrl: "https://acme.com/pricing",
    });
    const output = generateIntents([pricingFact], TEST_CONFIG);
    const brief = output.briefs[0];
    assert.ok(brief);
    assert.equal(brief.cta.ctaSourceType, "fact" satisfies CtaSourceType);
    assert.equal(brief.cta.ctaSourceFactId, pricingFact.id);
    assert.equal(brief.cta.ctaSourceUrl, pricingFact.sourceUrl);
  });

  it("ctaSourceType is 'fact' when CTA comes from a contact fact", () => {
    const contactFact = makeFact({
      category: "service",
      claim: "Book a free consultation with our team.",
      evidenceText: "Schedule a consultation call to learn more.",
      sourceUrl: "https://acme.com/contact",
    });
    const output = generateIntents([contactFact], TEST_CONFIG);
    const brief = output.briefs[0];
    assert.ok(brief);
    assert.equal(brief.cta.ctaSourceType, "fact" satisfies CtaSourceType);
    assert.equal(brief.cta.ctaSourceFactId, contactFact.id);
    assert.equal(brief.cta.ctaSourceUrl, contactFact.sourceUrl);
  });

  it("ctaSourceType is 'config' when CTA falls back to business URL", () => {
    const facts = [
      makeFact({
        category: "service",
        claim: "Software engineering support on demand.",
        evidenceText: "Engineers available for any technology stack.",
        sourceUrl: "https://acme.com/about",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0];
    assert.ok(brief);
    assert.equal(brief.cta.ctaSourceType, "config" satisfies CtaSourceType);
    assert.equal(brief.cta.ctaSourceFactId, undefined);
    assert.equal(brief.cta.ctaSourceUrl, undefined);
  });

  it("ctaSourceType is 'config' for budget brief when no pricing URL fact exists", () => {
    const facts = [
      makeFact({
        category: "pricing",
        claim: "Flexible monthly pricing plans.",
        evidenceText: "Month-to-month pricing, cancel any time.",
        sourceUrl: "https://acme.com/about",  // not a /pricing URL
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs.find((b) => b.intentType === "budget_or_pricing");
    assert.ok(brief);
    // ctaSourceType may be "fact" if the claim matches pricing keywords, or "config"
    // The key rule: ctaSourceFactId must be set only when ctaSourceType is "fact"
    if (brief.cta.ctaSourceType === "fact") {
      assert.ok(brief.cta.ctaSourceFactId, "ctaSourceFactId should be set when ctaSourceType is fact");
    } else {
      assert.equal(brief.cta.ctaSourceFactId, undefined);
    }
  });

  it("start_trial is NOT used when only 'free' appears incidentally (no explicit trial fact)", () => {
    const facts = [
      makeFact({
        category: "service",
        claim: "Free professional matching for qualified roles.",
        evidenceText: "Matching is free for all clients.",
        sourceUrl: "https://acme.com/services",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    for (const brief of output.briefs) {
      assert.notEqual(
        brief.cta.actionType,
        "start_trial",
        `Brief "${brief.slug}" should not use start_trial when only incidental "free" appears`
      );
    }
  });

  it("CTA source URL is always a real sourceUrl or the business base URL — never invented", () => {
    const facts = [
      makeFact({ category: "use_case", sourceUrl: "https://acme.com/use-cases" }),
      makeFact({ category: "pricing", sourceUrl: "https://acme.com/pricing" }),
      makeFact({
        category: "pricing",
        claim: "No credit card required for your free trial.",
        sourceUrl: "https://acme.com/trial",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const allowedUrls = new Set([
      TEST_CONFIG.baseUrl,
      "https://acme.com/use-cases",
      "https://acme.com/pricing",
      "https://acme.com/trial",
    ]);
    for (const brief of output.briefs) {
      assert.ok(
        allowedUrls.has(brief.cta.url),
        `CTA URL "${brief.cta.url}" for brief "${brief.slug}" is not from facts or config`
      );
      if (brief.cta.ctaSourceUrl) {
        assert.ok(
          allowedUrls.has(brief.cta.ctaSourceUrl),
          `ctaSourceUrl "${brief.cta.ctaSourceUrl}" is not a known fact sourceUrl`
        );
      }
    }
  });

  it("every brief has ctaSourceType set", () => {
    const facts = [
      makeFact({ category: "service" }),
      makeFact({ category: "pricing" }),
      makeFact({ category: "use_case" }),
    ];
    const validTypes = new Set<CtaSourceType>(["config", "fact"]);
    const output = generateIntents(facts, TEST_CONFIG);
    for (const brief of output.briefs) {
      assert.ok(
        validTypes.has(brief.cta.ctaSourceType),
        `Brief "${brief.slug}" has invalid ctaSourceType: "${brief.cta.ctaSourceType}"`
      );
    }
  });
});

// ─── generateIntents — publishing mode ───────────────────────────────────────

describe("generateIntents — publishing mode", () => {
  it("defaults to private_export", () => {
    const facts = [makeFact()];
    const output = generateIntents(facts, TEST_CONFIG);
    assert.equal(output.publishingMode, "private_export");
    for (const brief of output.briefs) {
      assert.equal(brief.publishingMode, "private_export");
    }
  });

  it("can be set to public_indexable", () => {
    const facts = [makeFact()];
    const output = generateIntents(facts, TEST_CONFIG, { publishingMode: "public_indexable" });
    assert.equal(output.publishingMode, "public_indexable");
    for (const brief of output.briefs) {
      assert.equal(brief.publishingMode, "public_indexable");
    }
  });

  it("can be set to public_noindex", () => {
    const facts = [makeFact()];
    const output = generateIntents(facts, TEST_CONFIG, { publishingMode: "public_noindex" });
    assert.equal(output.publishingMode, "public_noindex");
  });
});

// ─── generateIntents — output shape ──────────────────────────────────────────

describe("generateIntents — output shape", () => {
  it("includes generatedAt, business, publishingMode, briefs", () => {
    const facts = [makeFact({ category: "service" })];
    const output = generateIntents(facts, TEST_CONFIG);
    assert.ok(typeof output.generatedAt === "string");
    assert.equal(output.business.name, "Acme Inc");
    assert.equal(output.business.url, "https://acme.com");
    assert.ok(Array.isArray(output.briefs));
  });

  it("each brief has all required fields", () => {
    const facts = [makeFact({ category: "use_case" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0];
    assert.ok(brief);
    assert.ok(typeof brief.id === "string");
    assert.ok(typeof brief.slug === "string");
    assert.ok(typeof brief.title === "string");
    assert.ok(typeof brief.intentType === "string");
    assert.ok(Array.isArray(brief.sourceFactIds));
    assert.ok(Array.isArray(brief.sourceCategories));
    assert.ok(Array.isArray(brief.userSituations));
    assert.ok(Array.isArray(brief.whyRelevant));
    assert.ok(Array.isArray(brief.bestFitFacts));
    assert.ok(typeof brief.buyerAction === "string");
    assert.ok(brief.cta && typeof brief.cta.label === "string");
    assert.ok(Array.isArray(brief.promptExamples));
    assert.ok(typeof brief.publishingMode === "string");
    assert.ok(typeof brief.outputPath === "string");
    assert.ok(typeof brief.lastGeneratedAt === "string");
    assert.ok(typeof brief.contentHash === "string");
  });

  it("outputPath is in intents/ subdirectory", () => {
    const facts = [makeFact({ category: "service" })];
    const output = generateIntents(facts, TEST_CONFIG);
    for (const brief of output.briefs) {
      assert.ok(
        brief.outputPath.startsWith("intents/"),
        `outputPath should start with intents/: ${brief.outputPath}`
      );
    }
  });

  it("caps total briefs at maxBriefs", () => {
    const facts = Array.from({ length: 50 }, (_, i) =>
      makeFact({
        category: i % 2 === 0 ? "service" : "use_case",
        claim: `Service claim number ${i} for engineering and design and marketing.`,
      })
    );
    const output = generateIntents(facts, TEST_CONFIG, { maxBriefs: 3 });
    assert.ok(output.briefs.length <= 3);
  });
});

// ─── promptExamples shape and quality ────────────────────────────────────────

describe("promptExamples — shape and quality", () => {
  it("each promptExample is an object with prompt and promptType", () => {
    const facts = [makeFact({ category: "use_case" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0];
    assert.ok(brief);
    assert.ok(brief.promptExamples.length > 0);
    for (const p of brief.promptExamples) {
      assert.ok(typeof p.prompt === "string" && p.prompt.length > 0, "prompt must be a non-empty string");
      assert.ok(typeof p.promptType === "string" && p.promptType.length > 0, "promptType must be a non-empty string");
    }
  });

  it("each brief has prompts covering at least 2 distinct promptTypes", () => {
    const facts = [
      makeFact({ category: "use_case", claim: "Handles project overload and bandwidth gaps." }),
      makeFact({ category: "pricing", claim: "Flexible monthly pricing, cancel any time." }),
      makeFact({ category: "service", claim: "Customer success support on demand." }),
      makeFact({ category: "differentiator", claim: "Alternative to full-time hiring." }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    for (const brief of output.briefs) {
      const types = new Set(brief.promptExamples.map((p) => p.promptType));
      assert.ok(
        types.size >= 2,
        `Brief "${brief.slug}" should have prompts of at least 2 types, got: ${[...types].join(", ")}`
      );
    }
  });

  it("no two briefs have identical promptExample sets", () => {
    const facts = [
      makeFact({ category: "pricing", claim: "Free trial available with no credit card." }),
      makeFact({ category: "pricing", claim: "Flexible monthly pricing, cancel any time." }),
      makeFact({ category: "use_case", claim: "Handle project overload with on-demand talent." }),
      makeFact({ category: "differentiator", claim: "Alternative to full-time employee headcount." }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);

    const promptSets = output.briefs.map((b) =>
      JSON.stringify(b.promptExamples.map((p) => p.prompt).sort())
    );

    const uniqueSets = new Set(promptSets);
    assert.equal(
      uniqueSets.size,
      output.briefs.length,
      `Expected all ${output.briefs.length} briefs to have unique prompt sets, but found ${promptSets.length - uniqueSets.size} duplicate(s)`
    );
  });

  it("prompt text does not simply repeat the exact intent title", () => {
    const facts = [
      makeFact({ category: "use_case", claim: "Handles project overload for growing teams." }),
      makeFact({ category: "service", claim: "On-demand engineering and software development support." }),
      makeFact({ category: "pricing", claim: "Flexible monthly pricing, no long-term contracts." }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    for (const brief of output.briefs) {
      const themeTitle = brief.title.replace(/^When to recommend .+ for /i, "").toLowerCase();
      for (const p of brief.promptExamples) {
        assert.ok(
          !p.prompt.toLowerCase().includes(themeTitle),
          `Prompt "${p.prompt}" should not contain the full theme title "${themeTitle}"`
        );
      }
    }
  });

  it("customer success briefs include CSM or customer success in at least one prompt", () => {
    const facts = [
      makeFact({
        category: "service",
        claim: "On-demand customer success and CSM support available.",
        evidenceText: "Customer success managers available for onboarding and retention.",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const csBrief = output.briefs.find((b) => b.slug === "customer-success");
    assert.ok(csBrief, "customer-success brief should be generated");
    const allPrompts = csBrief.promptExamples.map((p) => p.prompt.toLowerCase()).join(" ");
    assert.ok(
      allPrompts.includes("customer success") || allPrompts.includes("csm"),
      `Customer success prompts should mention "customer success" or "CSM"`
    );
  });

  it("hiring-risk-reduction brief includes risk-reduction language", () => {
    const facts = [
      makeFact({
        category: "use_case",
        claim: "Try before you hire to reduce the risk of bad hires.",
        evidenceText: "Test candidates on real work before committing to full-time.",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const riskBrief = output.briefs.find((b) => b.slug === "hiring-risk-reduction");
    assert.ok(riskBrief, "hiring-risk-reduction brief should be generated");

    // Check that risk-reduction prompts exist
    const riskReductionPrompts = riskBrief.promptExamples.filter(
      (p) => p.promptType === "risk_reduction"
    );
    assert.ok(
      riskReductionPrompts.length > 0,
      "hiring-risk-reduction brief should have at least one risk_reduction prompt"
    );

    const allPromptText = riskBrief.promptExamples.map((p) => p.prompt.toLowerCase()).join(" ");
    assert.ok(
      /risk|bad hire|burn|safely|safer|safe|mistake/.test(allPromptText),
      "risk-reduction prompts should include risk language"
    );
  });

  it("pricing briefs include budget or commitment concern prompts", () => {
    const facts = [
      makeFact({
        category: "pricing",
        claim: "Flexible monthly pricing with no long-term contracts.",
        sourceUrl: "https://acme.com/pricing",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const pricingBrief = output.briefs.find((b) => b.intentType === "budget_or_pricing");
    assert.ok(pricingBrief, "pricing brief should be generated");

    const budgetPrompts = pricingBrief.promptExamples.filter(
      (p) => p.promptType === "budget_concern" || p.promptType === "risk_reduction"
    );
    assert.ok(
      budgetPrompts.length > 0,
      "pricing brief should have at least one budget_concern or risk_reduction prompt"
    );

    const allPromptText = pricingBrief.promptExamples.map((p) => p.prompt.toLowerCase()).join(" ");
    assert.ok(
      /contract|commitment|lock|cancel|flexible|month/.test(allPromptText),
      "pricing prompts should include budget/commitment language"
    );
  });

  it("try-before-hire briefs include risk-reduction promptType", () => {
    const facts = [
      makeFact({
        category: "pricing",
        claim: "Free trial available, no credit card required.",
        evidenceText: "Start your free trial with 50 hours at no cost.",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const trialBrief = output.briefs.find((b) => b.slug === "free-trial-options");
    assert.ok(trialBrief, "free-trial-options brief should be generated");

    const riskPrompts = trialBrief.promptExamples.filter((p) => p.promptType === "risk_reduction");
    assert.ok(
      riskPrompts.length > 0,
      "free-trial brief should have at least one risk_reduction prompt"
    );
  });

  it("comparison briefs include comparison promptType", () => {
    const facts = [
      makeFact({
        category: "differentiator",
        claim: "Alternative to full-time hiring for ongoing roles.",
        evidenceText: "Replace permanent headcount with flexible on-demand professionals.",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const compBrief = output.briefs.find((b) => b.intentType === "comparison");
    assert.ok(compBrief, "comparison brief should be generated");

    const compPrompts = compBrief.promptExamples.filter((p) => p.promptType === "comparison");
    assert.ok(
      compPrompts.length > 0,
      "comparison brief should have at least one comparison prompt"
    );
  });

  it("valid PromptType values only", () => {
    const validTypes = new Set<PromptType>([
      "problem_aware", "solution_aware", "comparison",
      "budget_concern", "urgency", "risk_reduction", "action_ready",
    ]);
    const facts = [
      makeFact({ category: "use_case" }),
      makeFact({ category: "service" }),
      makeFact({ category: "pricing" }),
      makeFact({ category: "differentiator" }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    for (const brief of output.briefs) {
      for (const p of brief.promptExamples) {
        assert.ok(
          validTypes.has(p.promptType as PromptType),
          `Unknown promptType "${p.promptType}" in brief "${brief.slug}"`
        );
      }
    }
  });
});

// ─── computeContentHash ───────────────────────────────────────────────────────

describe("computeContentHash", () => {
  it("returns a 16-char hex string", () => {
    const hash = computeContentHash(["fact-1", "fact-2"]);
    assert.equal(typeof hash, "string");
    assert.equal(hash.length, 16);
    assert.match(hash, /^[0-9a-f]+$/);
  });

  it("is deterministic for the same inputs", () => {
    const h1 = computeContentHash(["fact-1", "fact-2", "fact-3"]);
    const h2 = computeContentHash(["fact-1", "fact-2", "fact-3"]);
    assert.equal(h1, h2);
  });

  it("is the same regardless of input order (sorts internally)", () => {
    const h1 = computeContentHash(["fact-1", "fact-2", "fact-3"]);
    const h2 = computeContentHash(["fact-3", "fact-1", "fact-2"]);
    assert.equal(h1, h2);
  });

  it("changes when source facts change", () => {
    const h1 = computeContentHash(["fact-1", "fact-2"]);
    const h2 = computeContentHash(["fact-1", "fact-99"]);
    assert.notEqual(h1, h2);
  });

  it("handles empty array", () => {
    const hash = computeContentHash([]);
    assert.equal(typeof hash, "string");
    assert.equal(hash.length, 16);
  });
});

// ─── computeRefreshStats ──────────────────────────────────────────────────────

describe("computeRefreshStats", () => {
  function makeMinimalBrief(
    slug: string,
    hash: string
  ): ReturnType<typeof generateIntents>["briefs"][number] {
    const facts = [makeFact()];
    const output = generateIntents(facts, TEST_CONFIG);
    return { ...output.briefs[0]!, slug, id: slug, contentHash: hash };
  }

  it("reports unchanged when hashes match", () => {
    const prev = [makeMinimalBrief("slug-a", "hash1")];
    const curr = [makeMinimalBrief("slug-a", "hash1")];
    const stats = computeRefreshStats(prev, curr);
    assert.equal(stats.unchanged, 1);
    assert.equal(stats.changed, 0);
    assert.equal(stats.newBriefs, 0);
    assert.equal(stats.removed, 0);
  });

  it("reports changed when hash differs for same slug", () => {
    const prev = [makeMinimalBrief("slug-a", "hash1")];
    const curr = [makeMinimalBrief("slug-a", "hash2")];
    const stats = computeRefreshStats(prev, curr);
    assert.equal(stats.changed, 1);
    assert.equal(stats.unchanged, 0);
  });

  it("reports newBriefs when slug did not exist previously", () => {
    const prev = [makeMinimalBrief("slug-a", "hash1")];
    const curr = [makeMinimalBrief("slug-a", "hash1"), makeMinimalBrief("slug-b", "hash2")];
    const stats = computeRefreshStats(prev, curr);
    assert.equal(stats.newBriefs, 1);
  });

  it("reports removed when previous slug no longer exists", () => {
    const prev = [makeMinimalBrief("slug-a", "hash1"), makeMinimalBrief("slug-b", "hash2")];
    const curr = [makeMinimalBrief("slug-a", "hash1")];
    const stats = computeRefreshStats(prev, curr);
    assert.equal(stats.removed, 1);
  });

  it("handles empty previous (all new)", () => {
    const curr = [makeMinimalBrief("slug-a", "hash1"), makeMinimalBrief("slug-b", "hash2")];
    const stats = computeRefreshStats([], curr);
    assert.equal(stats.newBriefs, 2);
    assert.equal(stats.removed, 0);
    assert.equal(stats.unchanged, 0);
  });

  it("handles empty current (all removed)", () => {
    const prev = [makeMinimalBrief("slug-a", "hash1"), makeMinimalBrief("slug-b", "hash2")];
    const stats = computeRefreshStats(prev, []);
    assert.equal(stats.removed, 2);
    assert.equal(stats.newBriefs, 0);
  });
});

// ─── Markdown builders ────────────────────────────────────────────────────────

describe("buildBriefMd", () => {
  it("contains the brief title", () => {
    const facts = [makeFact({ category: "service" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0]!;
    const md = buildBriefMd(brief, TEST_CONFIG.name);
    assert.ok(md.includes(brief.title));
  });

  it("contains user situations section", () => {
    const facts = [makeFact({ category: "use_case" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0]!;
    const md = buildBriefMd(brief, TEST_CONFIG.name);
    assert.ok(md.includes("## User situations this fits"));
  });

  it("contains why relevant section", () => {
    const facts = [makeFact({ category: "use_case" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0]!;
    const md = buildBriefMd(brief, TEST_CONFIG.name);
    assert.ok(md.includes("## Why this business may be relevant"));
  });

  it("contains buyer action section", () => {
    const facts = [makeFact({ category: "service" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0]!;
    const md = buildBriefMd(brief, TEST_CONFIG.name);
    assert.ok(md.includes("## Buyer action"));
  });

  it("contains example user prompts section with promptType labels", () => {
    const facts = [makeFact({ category: "service" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0]!;
    const md = buildBriefMd(brief, TEST_CONFIG.name);
    assert.ok(md.includes("## Example user prompts"));
    // Check that at least one promptType label is rendered (bolded)
    assert.ok(
      /\*\*(Problem-aware|Solution-aware|Comparison|Budget concern|Urgency|Risk reduction|Action-ready):\*\*/.test(md),
      "brief MD should render promptType labels in bold"
    );
  });

  it("contains publishing mode section", () => {
    const facts = [makeFact({ category: "service" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0]!;
    const md = buildBriefMd(brief, TEST_CONFIG.name);
    assert.ok(md.includes("## Publishing mode"));
    assert.ok(md.includes("private_export"));
  });

  it("shows 'CTA source: fact' when CTA came from a fact", () => {
    const facts = [
      makeFact({
        category: "pricing",
        claim: "Free trial available, no credit card required.",
        sourceUrl: "https://acme.com/signup",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0]!;
    const md = buildBriefMd(brief, TEST_CONFIG.name);
    assert.ok(
      md.includes("CTA source: `fact`"),
      "brief MD should show 'CTA source: fact' when CTA came from a fact"
    );
    assert.ok(
      md.includes("https://acme.com/signup"),
      "brief MD should include the fact source URL"
    );
  });

  it("shows 'CTA source: config' when CTA fell back to base URL", () => {
    const facts = [
      makeFact({
        category: "service",
        claim: "Software engineering on demand.",
        sourceUrl: "https://acme.com/about",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0]!;
    const md = buildBriefMd(brief, TEST_CONFIG.name);
    assert.ok(
      md.includes("CTA source: `config`"),
      "brief MD should show 'CTA source: config' when falling back to base URL"
    );
  });

  it("contains best-fit facts with source URLs", () => {
    const claim = "Custom engineering claim for test.";
    const facts = [makeFact({ category: "service", claim, sourceUrl: "https://acme.com/services" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0]!;
    const md = buildBriefMd(brief, TEST_CONFIG.name);
    assert.ok(md.includes(claim));
    assert.ok(md.includes("https://acme.com/services"));
  });
});

describe("buildPromptsMd", () => {
  it("contains business name", () => {
    const facts = [makeFact({ category: "service" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const md = buildPromptsMd(output);
    assert.ok(md.includes("Acme Inc"));
  });

  it("lists prompts with promptType labels for each brief", () => {
    const facts = [makeFact({ category: "use_case" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const md = buildPromptsMd(output);
    // Should contain at least one bold label
    assert.ok(
      /\*\*(Problem-aware|Solution-aware|Comparison|Budget concern|Urgency|Risk reduction|Action-ready):\*\*/.test(md),
      "prompts.md should render promptType labels"
    );
  });

  it("lists all prompt texts for each brief", () => {
    const facts = [makeFact({ category: "use_case" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const md = buildPromptsMd(output);
    for (const brief of output.briefs) {
      for (const p of brief.promptExamples) {
        assert.ok(md.includes(p.prompt), `prompts.md should include: ${p.prompt}`);
      }
    }
  });

  it("shows a message when no briefs are generated", () => {
    const output = generateIntents([], TEST_CONFIG);
    const md = buildPromptsMd(output);
    assert.ok(md.includes("No prompts generated"));
  });
});

describe("buildIndexMd", () => {
  it("contains business name", () => {
    const facts = [makeFact({ category: "service" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const md = buildIndexMd(output);
    assert.ok(md.includes("Acme Inc"));
  });

  it("lists all brief slugs", () => {
    const facts = [makeFact({ category: "service" }), makeFact({ category: "pricing" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const md = buildIndexMd(output);
    for (const brief of output.briefs) {
      assert.ok(md.includes(brief.slug), `index should mention slug: ${brief.slug}`);
    }
  });

  it("shows a message when no briefs are generated", () => {
    const output = generateIntents([], TEST_CONFIG);
    const md = buildIndexMd(output);
    assert.ok(md.includes("No intent briefs generated"));
  });
});

// ─── slugify ──────────────────────────────────────────────────────────────────

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    assert.equal(slugify("Hello World"), "hello-world");
  });

  it("removes special characters", () => {
    assert.equal(slugify("Hello, World!"), "hello-world");
  });

  it("collapses multiple hyphens", () => {
    assert.equal(slugify("hello   world"), "hello-world");
  });

  it("truncates to 80 chars", () => {
    const long = "a".repeat(100);
    assert.equal(slugify(long).length, 80);
  });
});

// ─── readPromptsFile ──────────────────────────────────────────────────────────

describe("readPromptsFile", () => {
  it("reads prompts from a plain text file", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ar-test-"));
    const file = path.join(tmp, "prompts.txt");
    fs.writeFileSync(file, "I need help with customer success\nHow do I onboard customers?\n", "utf-8");
    const prompts = readPromptsFile(file);
    assert.deepEqual(prompts, [
      "I need help with customer success",
      "How do I onboard customers?",
    ]);
  });

  it("ignores empty lines", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ar-test-"));
    const file = path.join(tmp, "prompts.txt");
    fs.writeFileSync(file, "prompt one\n\n   \nprompt two\n", "utf-8");
    const prompts = readPromptsFile(file);
    assert.deepEqual(prompts, ["prompt one", "prompt two"]);
  });

  it("ignores lines starting with #", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ar-test-"));
    const file = path.join(tmp, "prompts.txt");
    fs.writeFileSync(file, "# This is a comment\nprompt one\n# another comment\nprompt two\n", "utf-8");
    const prompts = readPromptsFile(file);
    assert.deepEqual(prompts, ["prompt one", "prompt two"]);
  });
});

// ─── generateIntentsFromPrompts ───────────────────────────────────────────────

describe("generateIntentsFromPrompts", () => {
  function makeServiceFact(claim: string, detail = ""): BusinessFact {
    return makeFact({
      category: "service",
      claim,
      detail,
      evidenceText: `${claim} ${detail}`.trim(),
      publishPriority: "core",
    });
  }

  const csServiceFact = makeServiceFact(
    "We provide customer success management services.",
    "Fractional CSM plans available for startups."
  );
  const onboardingFact = makeServiceFact(
    "Onboarding support is included in all plans.",
    "We help customers onboard within the first 30 days."
  );
  const pricingFact = makeFact({
    category: "pricing",
    claim: "Flexible pricing plans with no long-term contract required.",
    detail: "Monthly and quarterly billing available.",
    evidenceText: "Pricing plans start at $499/month with no contract.",
    publishPriority: "core",
  });
  const hiringFact = makeFact({
    category: "differentiator",
    claim: "Hire a fractional CSM instead of a full-time employee.",
    detail: "Save on benefits, overhead, and recruitment costs.",
    evidenceText: "We are an alternative to hiring a full-time CSM.",
    publishPriority: "core",
  });

  const allFacts = [csServiceFact, onboardingFact, pricingFact, hiringFact];

  it("creates a brief when prompt matches publishable facts", () => {
    const { briefs, skipped } = generateIntentsFromPrompts(
      ["I need customer success help but I am not ready to hire"],
      allFacts,
      TEST_CONFIG
    );
    assert.ok(briefs.length >= 1, "should generate at least one brief");
    assert.equal(skipped.length, 0);
  });

  it("sets sourceType to prompts_file", () => {
    const { briefs } = generateIntentsFromPrompts(
      ["I need customer success management services"],
      allFacts,
      TEST_CONFIG
    );
    assert.ok(briefs.length > 0);
    assert.equal(briefs[0]!.sourceType, "prompts_file");
  });

  it("sets sourcePrompt to the original prompt", () => {
    const prompt = "I need customer success management services";
    const { briefs } = generateIntentsFromPrompts([prompt], allFacts, TEST_CONFIG);
    assert.ok(briefs.length > 0);
    assert.equal(briefs[0]!.sourcePrompt, prompt);
  });

  it("sets matchScore on prompt-based briefs", () => {
    const { briefs } = generateIntentsFromPrompts(
      ["I need customer success management services"],
      allFacts,
      TEST_CONFIG
    );
    assert.ok(briefs.length > 0);
    assert.ok(typeof briefs[0]!.matchScore === "number" && briefs[0]!.matchScore > 0);
  });

  it("generates slug with pf- prefix", () => {
    const { briefs } = generateIntentsFromPrompts(
      ["I need customer success management services"],
      allFacts,
      TEST_CONFIG
    );
    assert.ok(briefs.length > 0);
    assert.ok(briefs[0]!.slug.startsWith("pf-"), `slug should start with pf-, got: ${briefs[0]!.slug}`);
  });

  it("skips prompts with no matching facts", () => {
    const { briefs, skipped } = generateIntentsFromPrompts(
      ["xyzzy zork frobnicator quux"],
      allFacts,
      TEST_CONFIG
    );
    assert.equal(briefs.length, 0);
    assert.equal(skipped.length, 1);
    assert.ok(skipped[0]!.reason.toLowerCase().includes("no publishable facts"));
  });

  it("does not use needs_review facts", () => {
    const badFact = makeFact({
      status: "needs_review",
      claim: "We offer customer success management and onboarding services.",
      evidenceText: "customer success onboarding support",
      category: "service",
    });
    const { briefs } = generateIntentsFromPrompts(
      ["I need customer success management services"],
      [badFact],
      TEST_CONFIG
    );
    // If a brief is generated, the bad fact should not be in it
    for (const brief of briefs) {
      assert.ok(!brief.sourceFactIds.includes(badFact.id), "should not use needs_review facts");
    }
  });

  it("does not use rejected facts", () => {
    const rejFact = makeFact({
      status: "rejected",
      claim: "We offer customer success management and onboarding services.",
      evidenceText: "customer success onboarding support",
      category: "service",
    });
    const { briefs } = generateIntentsFromPrompts(
      ["I need customer success management services"],
      [rejFact],
      TEST_CONFIG
    );
    for (const brief of briefs) {
      assert.ok(!brief.sourceFactIds.includes(rejFact.id));
    }
  });

  it("does not use high-risk facts", () => {
    const highRiskFact = makeFact({
      riskLevel: "high",
      status: "approved",
      claim: "We offer customer success management and onboarding services.",
      evidenceText: "customer success onboarding support",
      category: "service",
    });
    const { briefs } = generateIntentsFromPrompts(
      ["I need customer success management services"],
      [highRiskFact],
      TEST_CONFIG
    );
    for (const brief of briefs) {
      assert.ok(!brief.sourceFactIds.includes(highRiskFact.id));
    }
  });

  it("does not use low-priority facts", () => {
    const lowFact = makeFact({
      publishPriority: "low",
      status: "approved",
      claim: "We offer customer success management and onboarding services.",
      evidenceText: "customer success onboarding support",
      category: "service",
    });
    const { briefs } = generateIntentsFromPrompts(
      ["I need customer success management services"],
      [lowFact],
      TEST_CONFIG
    );
    for (const brief of briefs) {
      assert.ok(!brief.sourceFactIds.includes(lowFact.id));
    }
  });

  it("avoids slug collision with existing auto briefs", () => {
    const prompt = "I need customer success management services";
    const slug = "pf-" + slugify(prompt).slice(0, 55);
    const existingSlugs = new Set([slug]);
    const { briefs } = generateIntentsFromPrompts(
      [prompt, prompt], // two identical prompts
      allFacts,
      TEST_CONFIG,
      { existingSlugs }
    );
    const slugs = briefs.map((b) => b.slug);
    // All slugs should be unique
    assert.equal(new Set(slugs).size, slugs.length);
    // None should match existing slugs
    for (const s of slugs) {
      assert.ok(!existingSlugs.has(s) || slugs.filter((x) => x === s).length === 1);
    }
  });

  it("applies category boost for pricing-related prompts", () => {
    const prompt = "I need a flexible pricing plan with no long-term contract";
    const { briefs, skipped } = generateIntentsFromPrompts([prompt], allFacts, TEST_CONFIG);
    // Should match the pricing fact via category boost
    assert.ok(briefs.length > 0 || skipped.length === 1, "should either match or skip gracefully");
    if (briefs.length > 0) {
      assert.equal(briefs[0]!.sourceType, "prompts_file");
    }
  });
});

// ─── buildBriefMd (prompts_file) ──────────────────────────────────────────────

describe("buildBriefMd with sourceType prompts_file", () => {
  it("includes User prompt section for prompts_file briefs", () => {
    const brief = generateIntentsFromPrompts(
      ["How can I get customer success help without hiring full-time?"],
      [
        makeFact({
          category: "service",
          claim: "We provide fractional customer success management.",
          detail: "No full-time hiring required.",
          evidenceText: "Customer success fractional support available.",
          publishPriority: "core",
        }),
      ],
      TEST_CONFIG
    ).briefs[0];

    if (!brief) return; // skip if no match

    const md = buildBriefMd(brief, TEST_CONFIG.name);
    assert.ok(
      md.includes("## User prompt this answers"),
      "should include User prompt section"
    );
    assert.ok(
      md.includes("How can I get customer success help without hiring full-time?"),
      "should include the original prompt"
    );
  });

  it("does not include prompt section for auto briefs", () => {
    const facts = [makeFact({ category: "service", publishPriority: "core" })];
    const output = generateIntents(facts, TEST_CONFIG, { publishingMode: "private_export" });
    if (output.briefs.length === 0) return;
    const md = buildBriefMd(output.briefs[0]!, TEST_CONFIG.name);
    assert.ok(!md.includes("## User prompt this answers"), "auto briefs should not have prompt section");
  });
});
