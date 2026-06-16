import crypto from "node:crypto";
import { RetrievalVocabulary } from "@agentranks/core";
import { IntentBrief, RefreshStats } from "./types.js";

/** Lowercase, strip non-alphanumeric, collapse spaces into hyphens. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

/**
 * Deterministic hash of sorted fact IDs plus retrieval vocabulary term values.
 * Changing any retrieval term produces a different hash, triggering refresh detection.
 */
export function computeContentHash(
  factIds: string[],
  retrieval?: RetrievalVocabulary
): string {
  const sortedIds = [...factIds].sort();
  const retrievalParts: string[] = [];
  if (retrieval) {
    const allTerms = [
      ...retrieval.primaryTerms,
      ...retrieval.relatedTerms,
      ...retrieval.entities,
      ...retrieval.semanticVariants,
    ].map((t) => t.value.toLowerCase()).sort();
    retrievalParts.push(...allTerms);
  }
  const input = [...sortedIds, ...retrievalParts].join("|");
  return crypto
    .createHash("sha256")
    .update(input)
    .digest("hex")
    .slice(0, 16);
}

/** Compare previous and current brief sets to produce refresh statistics. */
export function computeRefreshStats(
  previous: IntentBrief[],
  current: IntentBrief[]
): RefreshStats {
  const prevMap = new Map(previous.map((b) => [b.slug, b.contentHash]));
  const currMap = new Map(current.map((b) => [b.slug, b.contentHash]));

  let unchanged = 0, changed = 0, newBriefs = 0, removed = 0;

  for (const [slug, hash] of currMap) {
    if (!prevMap.has(slug)) newBriefs++;
    else if (prevMap.get(slug) === hash) unchanged++;
    else changed++;
  }
  for (const slug of prevMap.keys()) {
    if (!currMap.has(slug)) removed++;
  }

  return { unchanged, changed, newBriefs, removed };
}
