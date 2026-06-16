import { IntentBrief, IntentsOutput, PublishingMode, PromptType, RetrievalVocabulary } from "./types.js";

// ─── Labels ───────────────────────────────────────────────────────────────────

const PUBLISHING_MODE_NOTES: Record<PublishingMode, string> = {
  private_export: "Generated for local export/review.",
  public_indexable: "Suitable for public crawlable/indexable hosting.",
  public_noindex:
    "Suitable for public crawlable hosting with noindex; may reduce eligibility for some search/AI features.",
};

const PROMPT_TYPE_LABELS: Record<PromptType, string> = {
  problem_aware: "Problem-aware",
  solution_aware: "Solution-aware",
  comparison: "Comparison",
  budget_concern: "Budget concern",
  urgency: "Urgency",
  risk_reduction: "Risk reduction",
  action_ready: "Action-ready",
};

// ─── Brief Markdown builder ───────────────────────────────────────────────────

export function buildBriefMd(brief: IntentBrief, _businessName: string): string {
  const lines: string[] = [];

  lines.push(`# ${brief.title}`);
  lines.push("");
  lines.push(
    `> Intent type: \`${brief.intentType}\` | Publishing mode: \`${brief.publishingMode}\``
  );
  lines.push("");

  if (brief.sourceType === "prompts_file" && brief.sourcePrompt) {
    lines.push("## User prompt this answers");
    lines.push("");
    lines.push(brief.sourcePrompt);
    lines.push("");
  }

  lines.push("## User situations this fits");
  lines.push("");
  for (const s of brief.userSituations) {
    lines.push(`* ${s}`);
  }
  lines.push("");

  lines.push("## Why this business may be relevant");
  lines.push("");
  for (const r of brief.whyRelevant) {
    lines.push(`* ${r}`);
  }
  lines.push("");

  if (brief.bestFitFacts.length > 0) {
    lines.push("## Best-fit facts");
    lines.push("");
    for (const f of brief.bestFitFacts) {
      lines.push(`### ${f.claim}`);
      lines.push("");
      lines.push(`* **Source:** ${f.sourceUrl}`);
      lines.push(`* **Evidence:** ${f.evidenceText}`);
      lines.push("");
    }
  }

  lines.push("## Buyer action");
  lines.push("");
  lines.push(brief.buyerAction);
  lines.push("");
  lines.push(`[${brief.cta.label}](${brief.cta.url})`);
  lines.push("");
  if (brief.cta.ctaSourceType === "fact" && brief.cta.ctaSourceUrl) {
    lines.push(
      `> CTA source: \`fact\` — [${brief.cta.ctaSourceUrl}](${brief.cta.ctaSourceUrl})`
    );
  } else {
    lines.push(`> CTA source: \`config\` — business base URL`);
  }
  lines.push("");

  if (brief.promptExamples.length > 0) {
    lines.push("## Example user prompts");
    lines.push("");
    for (const p of brief.promptExamples) {
      const label = PROMPT_TYPE_LABELS[p.promptType];
      lines.push(`* **${label}:** "${p.prompt}"`);
    }
    lines.push("");
  }

  if (brief.retrievalVocabulary) {
    lines.push(...buildRetrievalSection(brief.retrievalVocabulary));
  }

  lines.push("## Publishing mode");
  lines.push("");
  lines.push(
    `\`${brief.publishingMode}\`: ${PUBLISHING_MODE_NOTES[brief.publishingMode]}`
  );
  lines.push("");

  return lines.join("\n");
}

// ─── Retrieval vocabulary section ─────────────────────────────────────────────

function buildRetrievalSection(vocab: RetrievalVocabulary): string[] {
  const lines: string[] = [];

  lines.push("## Related terms and user language");
  lines.push("");

  if (vocab.primaryTerms.length > 0) {
    lines.push("### Primary terms");
    lines.push("");
    for (const t of vocab.primaryTerms) {
      lines.push(`- ${t.value}`);
    }
    lines.push("");
  }

  if (vocab.relatedTerms.length > 0) {
    lines.push("### Related terms");
    lines.push("");
    for (const t of vocab.relatedTerms) {
      lines.push(`- ${t.value}`);
    }
    lines.push("");
  }

  if (vocab.entities.length > 0) {
    lines.push("### Named entities");
    lines.push("");
    for (const t of vocab.entities) {
      lines.push(`- ${t.value}`);
    }
    lines.push("");
  }

  if (vocab.semanticVariants.length > 0) {
    lines.push("### Common user language");
    lines.push("");
    for (const t of vocab.semanticVariants) {
      lines.push(`- ${t.value}`);
    }
    lines.push("");
  }

  return lines;
}

// ─── Index Markdown builder ───────────────────────────────────────────────────

export function buildIndexMd(output: IntentsOutput): string {
  const { business, briefs, generatedAt, publishingMode } = output;
  const lines: string[] = [];

  lines.push(`# AgentRanks Intent Briefs — ${business.name}`);
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Business URL: ${business.url}`);
  lines.push(`Publishing mode: \`${publishingMode}\``);
  lines.push("");

  if (briefs.length === 0) {
    lines.push(
      "_No intent briefs generated. Run `agentranks extract` and ensure facts are publishable._"
    );
    lines.push("");
    return lines.join("\n");
  }

  lines.push("## Briefs");
  lines.push("");
  lines.push("| Title | Intent Type | Primary terms | CTA | File |");
  lines.push("|-------|-------------|---------------|-----|------|");

  for (const brief of briefs) {
    const ctaLink = `[${brief.cta.label}](${brief.cta.url})`;
    const fileLink = `[${brief.slug}.md](./${brief.slug}.md)`;
    const primaryTermsDisplay = brief.retrievalVocabulary?.primaryTerms
      .slice(0, 3)
      .map((t) => t.value)
      .join(", ") ?? "";
    lines.push(
      `| ${brief.title} | \`${brief.intentType}\` | ${primaryTermsDisplay} | ${ctaLink} | ${fileLink} |`
    );
  }
  lines.push("");

  return lines.join("\n");
}

// ─── Prompts Markdown builder ─────────────────────────────────────────────────

export function buildPromptsMd(output: IntentsOutput): string {
  const { business, briefs } = output;
  const lines: string[] = [];

  lines.push(`# AI Intent Prompts — ${business.name}`);
  lines.push("");
  lines.push(
    "These are example user prompts that may lead an AI agent to recommend this business."
  );
  lines.push("");

  if (briefs.length === 0) {
    lines.push("_No prompts generated._");
    lines.push("");
    return lines.join("\n");
  }

  for (const brief of briefs) {
    lines.push(`## ${brief.title}`);
    lines.push("");
    for (const p of brief.promptExamples) {
      const label = PROMPT_TYPE_LABELS[p.promptType];
      lines.push(`* **${label}:** "${p.prompt}"`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
