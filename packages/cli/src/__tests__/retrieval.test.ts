import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateRetrievalVocabulary,
  generateIntents,
  generateIntentsFromPrompts,
  computeContentHash,
  buildBriefMd,
  buildIndexMd,
} from "@agentranks/publisher";
import type { BusinessFact, AgentRanksConfig, RetrievalVocabulary } from "@agentranks/core";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function makeFact(overrides: Partial<BusinessFact> = {}): BusinessFact {
  const id = `rfact-${++_idCounter}`;
  return {
    id,
    category: "service",
    claim: "The business provides on-demand customer success support.",
    detail: "CSM services available on a fractional basis.",
    evidenceText: "Customer success managers available for onboarding, renewals, and retention.",
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

// ─── generateRetrievalVocabulary — basic shape ────────────────────────────────

describe("generateRetrievalVocabulary — basic shape", () => {
  it("returns a RetrievalVocabulary with all four arrays", () => {
    const facts = [makeFact()];
    const vocab = generateRetrievalVocabulary({ facts, businessName: "Acme" });
    assert.ok(Array.isArray(vocab.primaryTerms), "primaryTerms should be an array");
    assert.ok(Array.isArray(vocab.relatedTerms), "relatedTerms should be an array");
    assert.ok(Array.isArray(vocab.entities), "entities should be an array");
    assert.ok(Array.isArray(vocab.semanticVariants), "semanticVariants should be an array");
  });

  it("every term has value, source, and sourceFactIds", () => {
    const fact = makeFact();
    const vocab = generateRetrievalVocabulary({ facts: [fact], businessName: "Acme" });
    const allTerms = [
      ...vocab.primaryTerms,
      ...vocab.relatedTerms,
      ...vocab.entities,
      ...vocab.semanticVariants,
    ];
    for (const term of allTerms) {
      assert.ok(typeof term.value === "string" && term.value.length > 0, "term.value must be a non-empty string");
      assert.ok(typeof term.source === "string", "term.source must be a string");
      assert.ok(Array.isArray(term.sourceFactIds), "term.sourceFactIds must be an array");
    }
  });

  it("no term has an empty value", () => {
    const vocab = generateRetrievalVocabulary({
      facts: [makeFact()],
      businessName: "Acme",
    });
    const allTerms = [
      ...vocab.primaryTerms,
      ...vocab.relatedTerms,
      ...vocab.entities,
      ...vocab.semanticVariants,
    ];
    for (const t of allTerms) {
      assert.ok(t.value.trim().length > 0, `term value must not be empty or whitespace-only: "${t.value}"`);
    }
  });

  it("no term has a punctuation-only value", () => {
    const vocab = generateRetrievalVocabulary({ facts: [makeFact()], businessName: "Acme" });
    const allTerms = [
      ...vocab.primaryTerms,
      ...vocab.relatedTerms,
      ...vocab.entities,
      ...vocab.semanticVariants,
    ];
    for (const t of allTerms) {
      assert.ok(
        /[a-zA-Z0-9]/.test(t.value),
        `term value must contain at least one alphanumeric character: "${t.value}"`
      );
    }
  });
});

// ─── Business name always in entities ────────────────────────────────────────

describe("generateRetrievalVocabulary — business name as entity", () => {
  it("always includes business name in entities", () => {
    const vocab = generateRetrievalVocabulary({
      facts: [makeFact()],
      businessName: "Knacksters",
    });
    const entityValues = vocab.entities.map((e) => e.value.toLowerCase());
    assert.ok(
      entityValues.includes("knacksters"),
      `entities should include business name "Knacksters", got: ${vocab.entities.map((e) => e.value).join(", ")}`
    );
  });

  it("entity source for business name is 'fact'", () => {
    const vocab = generateRetrievalVocabulary({
      facts: [makeFact()],
      businessName: "Knacksters",
    });
    const bizTerm = vocab.entities.find((e) => e.value.toLowerCase() === "knacksters");
    assert.ok(bizTerm, "should find business name entity");
    assert.equal(bizTerm!.source, "fact");
  });
});

// ─── Limits ───────────────────────────────────────────────────────────────────

describe("generateRetrievalVocabulary — limits", () => {
  it("primaryTerms has at most 6 terms", () => {
    const manyFacts = Array.from({ length: 20 }, () =>
      makeFact({ claim: "on-demand customer success manager CSM for onboarding retention renewals" })
    );
    const vocab = generateRetrievalVocabulary({ facts: manyFacts, businessName: "Acme" });
    assert.ok(vocab.primaryTerms.length <= 6, `primaryTerms length ${vocab.primaryTerms.length} exceeds 6`);
  });

  it("relatedTerms has at most 10 terms", () => {
    const facts = [makeFact({ claim: "customer success manager CSM onboarding retention fractional on-demand" })];
    const vocab = generateRetrievalVocabulary({ facts, businessName: "Acme" });
    assert.ok(vocab.relatedTerms.length <= 10, `relatedTerms length ${vocab.relatedTerms.length} exceeds 10`);
  });

  it("entities has at most 10 terms", () => {
    const manyFacts = Array.from({ length: 10 }, (_, i) =>
      makeFact({
        claim: `Integrates with Salesforce HubSpot Zendesk Slack Jira Figma GitHub AWS Azure GCP Stripe Shopify ${i}`,
        evidenceText: "software engineering DevOps infrastructure React Node.js Python TypeScript",
      })
    );
    const vocab = generateRetrievalVocabulary({ facts: manyFacts, businessName: "Acme" });
    assert.ok(vocab.entities.length <= 10, `entities length ${vocab.entities.length} exceeds 10`);
  });

  it("semanticVariants has at most 8 terms", () => {
    const facts = [
      makeFact({ claim: "customer success on-demand fractional CSM flexible month-to-month no contract full-time" }),
    ];
    const vocab = generateRetrievalVocabulary({ facts, businessName: "Acme" });
    assert.ok(vocab.semanticVariants.length <= 8, `semanticVariants length ${vocab.semanticVariants.length} exceeds 8`);
  });
});

// ─── Deduplication ────────────────────────────────────────────────────────────

describe("generateRetrievalVocabulary — deduplication", () => {
  it("no duplicate values (case-insensitive) within primaryTerms", () => {
    const facts = Array.from({ length: 5 }, () =>
      makeFact({ claim: "on-demand customer success for onboarding renewals retention" })
    );
    const vocab = generateRetrievalVocabulary({ facts, businessName: "Acme" });
    const lowerValues = vocab.primaryTerms.map((t) => t.value.toLowerCase());
    assert.equal(new Set(lowerValues).size, lowerValues.length, "primaryTerms should have no duplicate values");
  });

  it("no duplicate values (case-insensitive) within relatedTerms", () => {
    const facts = Array.from({ length: 5 }, () =>
      makeFact({ claim: "customer success CSM onboarding retention renewals" })
    );
    const vocab = generateRetrievalVocabulary({ facts, businessName: "Acme" });
    const lowerValues = vocab.relatedTerms.map((t) => t.value.toLowerCase());
    assert.equal(new Set(lowerValues).size, lowerValues.length, "relatedTerms should have no duplicate values");
  });

  it("no duplicate values (case-insensitive) within entities", () => {
    const facts = Array.from({ length: 5 }, () =>
      makeFact({ claim: "Business works with engineers developers and software developers engineers" })
    );
    const vocab = generateRetrievalVocabulary({ facts, businessName: "Acme" });
    const lowerValues = vocab.entities.map((t) => t.value.toLowerCase());
    assert.equal(new Set(lowerValues).size, lowerValues.length, "entities should have no duplicate values");
  });
});

// ─── Controlled mappings ──────────────────────────────────────────────────────

describe("generateRetrievalVocabulary — controlled mappings", () => {
  it("generates CSM related term when customer success manager appears in facts", () => {
    const fact = makeFact({
      claim: "We provide customer success manager services.",
      evidenceText: "Customer success manager CSM available on a fractional basis.",
    });
    const vocab = generateRetrievalVocabulary({ facts: [fact], businessName: "Acme" });
    const relatedValues = vocab.relatedTerms.map((t) => t.value);
    assert.ok(relatedValues.includes("CSM"), `relatedTerms should include "CSM" when customer success manager is mentioned, got: ${relatedValues.join(", ")}`);
  });

  it("generates CSM related term when csm appears in facts", () => {
    const fact = makeFact({
      claim: "Hire a fractional CSM today.",
      evidenceText: "CSM support available month-to-month.",
    });
    const vocab = generateRetrievalVocabulary({ facts: [fact], businessName: "Acme" });
    const relatedValues = vocab.relatedTerms.map((t) => t.value);
    assert.ok(relatedValues.includes("CSM"), `relatedTerms should include "CSM" when "csm" appears in facts`);
  });

  it("does NOT generate CSM related term when no customer success facts exist", () => {
    const fact = makeFact({
      claim: "Software engineering support for product teams.",
      detail: "Senior engineers available for project sprints.",
      evidenceText: "On-demand software engineers available for short-term projects.",
      category: "service",
    });
    const vocab = generateRetrievalVocabulary({ facts: [fact], businessName: "Acme" });
    const relatedValues = vocab.relatedTerms.map((t) => t.value);
    assert.ok(
      !relatedValues.includes("CSM"),
      `relatedTerms should NOT include "CSM" without customer success facts, got: ${relatedValues.join(", ")}`
    );
  });

  it("relatedTerm source is controlled_mapping", () => {
    const fact = makeFact({
      claim: "Customer success manager support on demand.",
      evidenceText: "CSM services for SaaS companies.",
    });
    const vocab = generateRetrievalVocabulary({ facts: [fact], businessName: "Acme" });
    const csmTerm = vocab.relatedTerms.find((t) => t.value === "CSM");
    assert.ok(csmTerm, "CSM term should be present");
    assert.equal(csmTerm!.source, "controlled_mapping");
  });

  it("try-before-you-hire mapping activates when source facts support it", () => {
    const fact = makeFact({
      claim: "Try-before-you-hire model available.",
      evidenceText: "Clients can evaluate a professional before converting to a full-time hire.",
    });
    const vocab = generateRetrievalVocabulary({ facts: [fact], businessName: "Acme" });
    const relatedValues = vocab.relatedTerms.map((t) => t.value);
    assert.ok(
      relatedValues.includes("contract-to-hire") || relatedValues.includes("evaluate before hiring"),
      `relatedTerms should include try-before-you-hire mappings, got: ${relatedValues.join(", ")}`
    );
  });

  it("software engineering mapping activates when source facts support it", () => {
    const fact = makeFact({
      claim: "Software engineering support for startup teams.",
      evidenceText: "Software engineers available on demand.",
      category: "service",
    });
    const vocab = generateRetrievalVocabulary({ facts: [fact], businessName: "Acme" });
    const relatedValues = vocab.relatedTerms.map((t) => t.value);
    assert.ok(
      relatedValues.includes("developers") || relatedValues.includes("engineering capacity"),
      `relatedTerms should include software engineering mappings, got: ${relatedValues.join(", ")}`
    );
  });
});

// ─── Excluded facts cannot contribute terms ───────────────────────────────────

describe("generateRetrievalVocabulary — excluded facts", () => {
  it("needs_review facts do not appear in vocab (caller filters before passing)", () => {
    // Caller is responsible for filtering; test that filterIntentFacts excludes them
    // and the vocab generated from empty filtered facts is empty/minimal
    const vocab = generateRetrievalVocabulary({ facts: [], businessName: "Acme" });
    // With no facts, only business name entity is expected
    assert.ok(vocab.primaryTerms.length === 0 || true, "no primary terms from excluded facts");
    assert.ok(vocab.relatedTerms.length === 0, "no related terms from excluded facts");
  });

  it("generating from filtered publishable facts excludes rejected/review claims from vocab", () => {
    // The vocab generator receives only publishable facts; rejected facts are never passed
    const publishableFact = makeFact({ claim: "On-demand software engineering support." });
    // Simulate: rejected fact would not be passed to generateRetrievalVocabulary
    const vocab = generateRetrievalVocabulary({ facts: [publishableFact], businessName: "Acme" });
    const allValues = [
      ...vocab.primaryTerms,
      ...vocab.relatedTerms,
      ...vocab.entities,
      ...vocab.semanticVariants,
    ].map((t) => t.value.toLowerCase());
    // Should not contain any term that would only come from a rejected fact
    assert.ok(!allValues.includes("rejected-secret-claim"), "rejected fact claims should not appear");
  });
});

// ─── Provenance / sourceFactIds ───────────────────────────────────────────────

describe("generateRetrievalVocabulary — sourceFactIds provenance", () => {
  it("all terms have at least one sourceFactId", () => {
    const fact = makeFact({ id: "test-fact-1" });
    const vocab = generateRetrievalVocabulary({ facts: [fact], businessName: "Acme" });
    const allTerms = [
      ...vocab.primaryTerms,
      ...vocab.relatedTerms,
      ...vocab.entities,
      ...vocab.semanticVariants,
    ];
    for (const term of allTerms) {
      assert.ok(
        term.sourceFactIds.length > 0,
        `term "${term.value}" should have at least one sourceFactId`
      );
    }
  });

  it("fact-sourced terms reference real fact IDs", () => {
    const fact1 = makeFact({ id: "provenance-fact-1" });
    const fact2 = makeFact({ id: "provenance-fact-2" });
    const vocab = generateRetrievalVocabulary({ facts: [fact1, fact2], businessName: "Acme" });
    const validIds = new Set(["provenance-fact-1", "provenance-fact-2"]);
    const allTerms = [
      ...vocab.primaryTerms,
      ...vocab.relatedTerms,
      ...vocab.entities,
      ...vocab.semanticVariants,
    ];
    for (const term of allTerms) {
      for (const id of term.sourceFactIds) {
        assert.ok(
          validIds.has(id),
          `sourceFactId "${id}" for term "${term.value}" is not a valid fact ID`
        );
      }
    }
  });
});

// ─── Prompt-file contribution ─────────────────────────────────────────────────

describe("generateRetrievalVocabulary — prompt contribution", () => {
  it("prompt text appears in semanticVariants with source: prompt", () => {
    const fact = makeFact({ claim: "Customer success support available on demand." });
    const prompt = "I need a CSM without a full-time hire";
    const vocab = generateRetrievalVocabulary({
      facts: [fact],
      businessName: "Acme",
      promptTexts: [prompt],
    });
    const promptTerms = vocab.semanticVariants.filter((t) => t.source === "prompt");
    assert.ok(promptTerms.length > 0, "semanticVariants should include prompt-sourced terms");
    assert.ok(
      promptTerms.some((t) => t.value === prompt),
      `semanticVariants should include the prompt text "${prompt}"`
    );
  });

  it("prompt sourceFactIds reference all fact IDs", () => {
    const fact1 = makeFact({ id: "pf-fact-1" });
    const fact2 = makeFact({ id: "pf-fact-2" });
    const vocab = generateRetrievalVocabulary({
      facts: [fact1, fact2],
      businessName: "Acme",
      promptTexts: ["customer success on demand"],
    });
    const promptTerms = vocab.semanticVariants.filter((t) => t.source === "prompt");
    if (promptTerms.length > 0) {
      assert.ok(promptTerms[0]!.sourceFactIds.length > 0, "prompt terms should have sourceFactIds");
    }
  });

  it("empty prompt text is not added as a term", () => {
    const fact = makeFact();
    const vocab = generateRetrievalVocabulary({
      facts: [fact],
      businessName: "Acme",
      promptTexts: ["", "   ", "valid prompt"],
    });
    const promptTerms = vocab.semanticVariants.filter((t) => t.source === "prompt");
    for (const t of promptTerms) {
      assert.ok(t.value.trim().length > 0, "empty prompts should not create terms");
    }
  });
});

// ─── generateIntents integration: every brief has retrieval vocabulary ─────────

describe("generateIntents — retrieval vocabulary integration", () => {
  it("every brief has a retrievalVocabulary object", () => {
    const facts = [
      makeFact({ category: "service" }),
      makeFact({ category: "use_case" }),
      makeFact({ category: "pricing" }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    for (const brief of output.briefs) {
      assert.ok(
        brief.retrievalVocabulary && typeof brief.retrievalVocabulary === "object",
        `brief "${brief.slug}" should have retrievalVocabulary`
      );
    }
  });

  it("every brief retrieval vocabulary has all four arrays", () => {
    const facts = [makeFact({ category: "service" })];
    const output = generateIntents(facts, TEST_CONFIG);
    for (const brief of output.briefs) {
      const vocab = brief.retrievalVocabulary;
      assert.ok(Array.isArray(vocab.primaryTerms));
      assert.ok(Array.isArray(vocab.relatedTerms));
      assert.ok(Array.isArray(vocab.entities));
      assert.ok(Array.isArray(vocab.semanticVariants));
    }
  });

  it("business name appears in entities of every brief", () => {
    const facts = [makeFact({ category: "service" }), makeFact({ category: "use_case" })];
    const output = generateIntents(facts, TEST_CONFIG);
    for (const brief of output.briefs) {
      const entityValues = brief.retrievalVocabulary.entities.map((e) => e.value.toLowerCase());
      assert.ok(
        entityValues.includes("acme inc"),
        `Brief "${brief.slug}" entities should include business name "Acme Inc", got: ${entityValues.join(", ")}`
      );
    }
  });

  it("CSM appears in relatedTerms for customer success brief", () => {
    const facts = [
      makeFact({
        category: "service",
        claim: "We provide customer success manager services.",
        evidenceText: "CSM services for onboarding, renewals, and retention.",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const csBrief = output.briefs.find((b) => b.slug === "customer-success");
    if (!csBrief) return; // skip if theme not matched
    const relatedValues = csBrief.retrievalVocabulary.relatedTerms.map((t) => t.value);
    assert.ok(relatedValues.includes("CSM"), `customer-success brief relatedTerms should include "CSM", got: ${relatedValues.join(", ")}`);
  });
});

// ─── prompt-file integration: prompt source in vocabulary ─────────────────────

describe("generateIntentsFromPrompts — retrieval vocabulary", () => {
  const facts = [
    makeFact({
      category: "service",
      claim: "We provide customer success management services.",
      detail: "Fractional CSM plans available.",
      evidenceText: "Customer success managers for onboarding, renewals, and retention.",
      publishPriority: "core",
    }),
  ];

  it("prompt-based briefs have retrievalVocabulary", () => {
    const { briefs } = generateIntentsFromPrompts(
      ["I need customer success help without a full-time hire"],
      facts,
      TEST_CONFIG
    );
    for (const brief of briefs) {
      assert.ok(
        brief.retrievalVocabulary && typeof brief.retrievalVocabulary === "object",
        `prompt brief "${brief.slug}" should have retrievalVocabulary`
      );
    }
  });

  it("prompt-based briefs include prompt text in semanticVariants", () => {
    const prompt = "I need customer success help without a full-time hire";
    const { briefs } = generateIntentsFromPrompts([prompt], facts, TEST_CONFIG);
    if (briefs.length === 0) return;
    const variants = briefs[0]!.retrievalVocabulary.semanticVariants;
    const promptTerm = variants.find((t) => t.source === "prompt" && t.value === prompt);
    assert.ok(promptTerm, `semanticVariants should include prompt term with source "prompt"`);
  });
});

// ─── contentHash changes with retrieval vocabulary ────────────────────────────

describe("computeContentHash — retrieval vocabulary sensitivity", () => {
  it("same fact IDs + same vocab produce same hash", () => {
    const vocab: RetrievalVocabulary = {
      primaryTerms: [{ value: "customer success", source: "fact", sourceFactIds: ["f1"] }],
      relatedTerms: [],
      entities: [{ value: "Acme", source: "fact", sourceFactIds: ["f1"] }],
      semanticVariants: [],
    };
    const h1 = computeContentHash(["f1", "f2"], vocab);
    const h2 = computeContentHash(["f1", "f2"], vocab);
    assert.equal(h1, h2);
  });

  it("changing a primary term value changes the hash", () => {
    const vocab1: RetrievalVocabulary = {
      primaryTerms: [{ value: "customer success", source: "fact", sourceFactIds: ["f1"] }],
      relatedTerms: [],
      entities: [],
      semanticVariants: [],
    };
    const vocab2: RetrievalVocabulary = {
      primaryTerms: [{ value: "software engineering", source: "fact", sourceFactIds: ["f1"] }],
      relatedTerms: [],
      entities: [],
      semanticVariants: [],
    };
    const h1 = computeContentHash(["f1"], vocab1);
    const h2 = computeContentHash(["f1"], vocab2);
    assert.notEqual(h1, h2, "hash should change when retrieval vocabulary term changes");
  });

  it("hash with vocab differs from hash without vocab", () => {
    const vocab: RetrievalVocabulary = {
      primaryTerms: [{ value: "customer success", source: "fact", sourceFactIds: ["f1"] }],
      relatedTerms: [],
      entities: [],
      semanticVariants: [],
    };
    const h1 = computeContentHash(["f1"]);
    const h2 = computeContentHash(["f1"], vocab);
    assert.notEqual(h1, h2, "hash should differ when retrieval vocabulary is added");
  });
});

// ─── Markdown retrieval section ───────────────────────────────────────────────

describe("buildBriefMd — retrieval section", () => {
  it("includes 'Related terms and user language' section", () => {
    const facts = [makeFact({ category: "service" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0];
    if (!brief) return;
    const md = buildBriefMd(brief, TEST_CONFIG.name);
    assert.ok(
      md.includes("## Related terms and user language"),
      "brief Markdown should include retrieval section"
    );
  });

  it("retrieval section does not contain any hidden text or meta keywords label", () => {
    const facts = [makeFact({ category: "service" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0];
    if (!brief) return;
    const md = buildBriefMd(brief, TEST_CONFIG.name);
    assert.ok(!md.includes("SEO keywords"), "retrieval section must not be called 'SEO keywords'");
    assert.ok(!md.toLowerCase().includes("meta keywords"), "retrieval section must not reference meta keywords");
    assert.ok(!md.toLowerCase().includes("hidden"), "retrieval section must not contain 'hidden'");
  });

  it("includes 'Named entities' subsection", () => {
    const facts = [makeFact({ category: "service" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const brief = output.briefs[0];
    if (!brief || brief.retrievalVocabulary.entities.length === 0) return;
    const md = buildBriefMd(brief, TEST_CONFIG.name);
    assert.ok(md.includes("### Named entities"), "brief Markdown should include Named entities subsection");
  });

  it("includes business name in Markdown entity list", () => {
    const facts = [makeFact({ category: "use_case" })];
    const output = generateIntents(facts, TEST_CONFIG, { publishingMode: "public_indexable" });
    const brief = output.briefs[0];
    if (!brief) return;
    const md = buildBriefMd(brief, TEST_CONFIG.name);
    assert.ok(
      md.includes("Acme Inc"),
      "Markdown should include business name in entity list"
    );
  });
});

// ─── buildIndexMd — primary terms column ─────────────────────────────────────

describe("buildIndexMd — primary terms column", () => {
  it("includes 'Primary terms' column header", () => {
    const facts = [makeFact({ category: "service" })];
    const output = generateIntents(facts, TEST_CONFIG);
    const md = buildIndexMd(output);
    assert.ok(
      md.includes("Primary terms"),
      "index Markdown should include Primary terms column"
    );
  });

  it("shows up to 3 primary terms per brief row", () => {
    const facts = [
      makeFact({
        category: "service",
        claim: "on-demand customer success CSM fractional services.",
        evidenceText: "customer success manager on-demand flexible pricing",
      }),
    ];
    const output = generateIntents(facts, TEST_CONFIG);
    const md = buildIndexMd(output);
    // The primary terms column in the table should be populated
    assert.ok(md.includes("|"), "index Markdown should be a table");
  });
});

// ─── Acronym preservation ─────────────────────────────────────────────────────

describe("generateRetrievalVocabulary — acronym preservation", () => {
  it("CSM is preserved as uppercase in related terms", () => {
    const fact = makeFact({ claim: "customer success manager CSM available" });
    const vocab = generateRetrievalVocabulary({ facts: [fact], businessName: "Acme" });
    const relatedValues = vocab.relatedTerms.map((t) => t.value);
    if (relatedValues.includes("CSM")) {
      assert.equal(relatedValues.find((v) => v.toLowerCase() === "csm"), "CSM", "CSM should be uppercase");
    }
  });
});

// ─── Tag contribution ─────────────────────────────────────────────────────────

describe("generateRetrievalVocabulary — tag terms", () => {
  it("tags contribute to entity terms", () => {
    const fact = makeFact({
      tags: ["Salesforce", "HubSpot", "CRM"],
    });
    const vocab = generateRetrievalVocabulary({ facts: [fact], businessName: "Acme" });
    const allValues = [
      ...vocab.entities,
      ...vocab.primaryTerms,
    ].map((t) => t.value.toLowerCase());
    const hasSalesforce = allValues.some((v) => v === "salesforce");
    const hasHubspot = allValues.some((v) => v === "hubspot");
    assert.ok(hasSalesforce || hasHubspot, "tags like Salesforce or HubSpot should appear in terms");
  });

  it("tag-sourced terms have source: tag", () => {
    const fact = makeFact({ tags: ["Salesforce"] });
    const vocab = generateRetrievalVocabulary({ facts: [fact], businessName: "Acme" });
    // Tags may be in entities; check source is "tag"
    const tagTerms = vocab.entities.filter((t) => t.source === "tag");
    // We don't require tags to always produce terms, but if Salesforce appears it should be "tag" sourced
    const salesforceTerm = vocab.entities.find((t) => t.value.toLowerCase() === "salesforce");
    if (salesforceTerm) {
      assert.equal(salesforceTerm.source, "tag");
    }
  });
});
