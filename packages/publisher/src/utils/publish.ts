import { BusinessFact } from "@agentranks/core";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Defines which publishability gate to apply.
 *
 * "generate" — facts safe for agentranks.json / llms.txt / Markdown output.
 *   Supports strict (approved-only) and includeLow (legal/low-priority) options.
 *
 * "intents" — stricter gate for AI Intent Pages.
 *   Always excludes high-risk, legal, and low-priority facts.
 *   strict/includeLow options have no effect.
 *
 * "score" — same gate as "intents", used for scoring publishable fact counts.
 */
export type PublishabilityMode = "generate" | "intents" | "score";

export interface PublishabilityOptions {
  mode: PublishabilityMode;
  /** generate only: include only approved facts (excludes extracted+low-risk). */
  strict?: boolean;
  /** generate only: include legal/low-priority facts. */
  includeLow?: boolean;
}

// ─── Core predicate ───────────────────────────────────────────────────────────

/**
 * Single source of truth for fact publishability.
 * Preserves the exact behavior of the three previous separate implementations.
 */
export function isFactPublishable(
  fact: BusinessFact,
  opts: PublishabilityOptions
): boolean {
  const { mode, strict = false, includeLow = false } = opts;

  // Always excluded regardless of mode
  if (fact.status === "rejected" || fact.status === "needs_review") return false;

  // intents + score: always exclude high-risk (even approved facts)
  if (mode !== "generate" && fact.riskLevel === "high") return false;

  // Handle legal/low-priority priority
  const isLowOrLegal =
    fact.publishPriority === "low" || fact.publishPriority === "legal";
  if (isLowOrLegal) {
    // intents + score: always exclude
    if (mode !== "generate") return false;
    // generate: exclude unless includeLow
    if (!includeLow) return false;
  }

  // Approved facts pass all remaining checks
  if (fact.status === "approved") return true;

  // Extracted facts — additional gate
  if (fact.status === "extracted") {
    // generate strict: only approved facts allowed
    if (strict && mode === "generate") return false;
    // Must be low-risk
    if (fact.riskLevel !== "low") return false;
    // intents + score: further restrict to core/supporting priority only
    if (mode !== "generate") {
      return (
        fact.publishPriority === "core" || fact.publishPriority === "supporting"
      );
    }
    return true;
  }

  return false;
}

/** Filter an array of facts to those publishable in the given mode. */
export function filterFacts(
  facts: BusinessFact[],
  opts: PublishabilityOptions
): BusinessFact[] {
  return facts.filter((f) => isFactPublishable(f, opts));
}
