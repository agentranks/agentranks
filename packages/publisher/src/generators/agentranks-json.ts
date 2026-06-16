import { AgentRanksOutput, BusinessFact, AgentRanksConfig } from "@agentranks/core";
import { isFactPublishable } from "../utils/publish.js";

export interface PublishFilter {
  /** Only include explicitly approved facts. Default: false (also includes extracted+low-risk). */
  strict?: boolean;
  /** Include low-priority facts (granular role/tool lists, etc.). Default: false. */
  includeLow?: boolean;
}

export interface PublishStats {
  total: number;
  published: number;
  excluded: {
    needs_review: number;
    rejected: number;
    extracted_high_risk: number;
    low_priority: number;
  };
}

/**
 * Returns facts safe to publish and exclusion stats.
 * Delegates to the unified publishability helper with mode: "generate".
 */
export function filterPublishableFacts(
  facts: BusinessFact[],
  filter: PublishFilter = {}
): { publishable: BusinessFact[]; stats: PublishStats } {
  const publishable: BusinessFact[] = [];
  let needs_review = 0;
  let rejected = 0;
  let extracted_high_risk = 0;
  let low_priority = 0;

  for (const f of facts) {
    if (f.status === "rejected") { rejected++; continue; }
    if (f.status === "needs_review") { needs_review++; continue; }

    const isLowOrLegal = f.publishPriority === "low" || f.publishPriority === "legal";
    if (isLowOrLegal && !filter.includeLow) { low_priority++; continue; }

    if (isFactPublishable(f, { mode: "generate", strict: filter.strict, includeLow: filter.includeLow })) {
      publishable.push(f);
    } else {
      extracted_high_risk++;
    }
  }

  return {
    publishable,
    stats: {
      total: facts.length,
      published: publishable.length,
      excluded: { needs_review, rejected, extracted_high_risk, low_priority },
    },
  };
}

export function buildAgentRanksOutput(
  facts: BusinessFact[],
  config: AgentRanksConfig,
  pagesScanned: number,
  filter: PublishFilter = {}
): AgentRanksOutput & { publishStats: PublishStats } {
  const now = new Date().toISOString();

  const { publishable, stats } = filterPublishableFacts(facts, filter);

  const byCategory: Record<string, number> = {};
  for (const fact of publishable) {
    byCategory[fact.category] = (byCategory[fact.category] ?? 0) + 1;
  }

  const avgConfidence =
    publishable.length > 0
      ? publishable.reduce((sum, f) => sum + f.confidence, 0) / publishable.length
      : 0;

  const sourceUrls = Array.from(new Set(publishable.map((f) => f.sourceUrl))).sort();

  return {
    version: "1",
    generatedAt: now,
    business: {
      name: config.name,
      url: config.baseUrl,
      description: config.description,
    },
    facts: publishable,
    summary: {
      totalFacts: publishable.length,
      byCategory,
      avgConfidence: Math.round(avgConfidence * 1000) / 1000,
      sourceUrls,
      pagesScanned,
    },
    publishStats: stats,
  };
}
