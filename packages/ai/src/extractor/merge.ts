import { BusinessFact, ExtractionResult } from "@agentranks/core";

function normalizeClaim(claim: string): string {
  return claim.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Merge extraction results from multiple pages, deduplicating by normalized claim.
 * When two facts have the same normalized claim, the one with higher confidence wins.
 */
export function mergeExtractionResults(results: ExtractionResult[]): BusinessFact[] {
  const factMap = new Map<string, BusinessFact>();

  for (const result of results) {
    for (const fact of result.facts) {
      const key = normalizeClaim(fact.claim);
      const existing = factMap.get(key);
      if (!existing || fact.confidence > existing.confidence) {
        factMap.set(key, fact);
      }
    }
  }

  return Array.from(factMap.values());
}
