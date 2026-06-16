import { AgentRanksOutput, BusinessFact, FactCategory } from "@agentranks/core";

const CATEGORY_LABELS: Record<FactCategory, string> = {
  company_profile: "Company Profile",
  differentiator: "Key Differentiators",
  product: "Products",
  service: "Services",
  pricing: "Pricing",
  use_case: "Use Cases",
  integration: "Integrations",
  faq: "FAQs",
  policy: "Policies",
  location: "Locations",
  competitor: "Competitors",
  proof_point: "Proof Points",
  claim: "Claims",
  limitation: "Limitations",
};

const CATEGORY_ORDER: FactCategory[] = [
  "company_profile",
  "differentiator",
  "product",
  "service",
  "pricing",
  "use_case",
  "integration",
  "faq",
  "policy",
  "location",
  "competitor",
  "proof_point",
  "claim",
  "limitation",
];

/**
 * Generates llms.txt — a human and LLM-readable plain-text summary of the business.
 * Follows the llms.txt specification (https://llmstxt.org/).
 * Receives already-filtered publishable facts from `buildAgentRanksOutput`.
 */
export function generateLlmsTxt(output: AgentRanksOutput): string {
  const lines: string[] = [];

  lines.push(`# ${output.business.name}`);
  lines.push("");

  if (output.business.description) {
    lines.push(`> ${output.business.description}`);
    lines.push("");
  }

  lines.push(
    `> Source: ${output.business.url} | Generated: ${output.generatedAt} | Facts: ${output.summary.totalFacts}`
  );
  lines.push("");
  lines.push("---");
  lines.push("");

  const grouped = groupByCategory(output.facts);

  for (const category of CATEGORY_ORDER) {
    const facts = grouped[category];
    if (!facts || facts.length === 0) continue;

    const label = CATEGORY_LABELS[category];
    lines.push(`## ${label}`);
    lines.push("");

    for (const fact of facts) {
      lines.push(`- ${fact.claim}`);
      if (fact.detail) {
        lines.push(`  ${fact.detail}`);
      }
    }
    lines.push("");
  }

  lines.push("## Sources");
  lines.push("");
  for (const url of output.summary.sourceUrls) {
    lines.push(`- ${url}`);
  }
  lines.push("");

  return lines.join("\n");
}

function groupByCategory(
  facts: BusinessFact[]
): Partial<Record<FactCategory, BusinessFact[]>> {
  const grouped: Partial<Record<FactCategory, BusinessFact[]>> = {};
  for (const fact of facts) {
    if (!grouped[fact.category]) grouped[fact.category] = [];
    grouped[fact.category]!.push(fact);
  }
  return grouped;
}
