import { BusinessFact } from "@agentranks/core";
import { filterFacts } from "../../utils/publish.js";

/**
 * Filter facts to those safe for intent briefs.
 * Delegates to the unified publishability helper with mode: "intents".
 *
 * Excludes: rejected, needs_review, high-risk, legal, low-priority facts.
 * Includes: approved + extracted+low-risk+core/supporting.
 */
export function filterIntentFacts(facts: BusinessFact[]): BusinessFact[] {
  return filterFacts(facts, { mode: "intents" });
}
