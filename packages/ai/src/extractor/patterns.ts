import { FactCategorySchema } from "@agentranks/core";

export const VALID_CATEGORIES = new Set<string>(FactCategorySchema.options);

/**
 * Patterns that always escalate a fact into the `claim` category at high risk.
 * Limited to genuine superlative, comparative, or hard-to-verify performance
 * claims. Verifiable certifications (SOC 2, ISO, HIPAA, GDPR), case studies,
 * testimonials, and bare guarantees are intentionally NOT here — those are
 * source-backed and should not carry high review burden.
 */
export const CLAIM_ESCALATION_PATTERNS: RegExp[] = [
  /\bROI\b/,
  /\bchurn reduction\b/i,
  /\bNRR improvement\b/i,
  /\bpass rate\b/i,
  /\bonly platform\b/i,
  /\bbest.?in.?class\b/i,
  /\bthe best\b/i,
  /\bbest\s+(platform|product|service|solution|option|choice|on the market)\b/i,
  /\bworld.?class\b/i,
  /\belite\b/i,
  /\bproven track record\b/i,
  /\bindustry.?leading\b/i,
  /\btop.?tier\b/i,
  /\btop.?rated\b/i,
  /\bno quality compromises?\b/i,
  /\d+(\.\d+)?\/5\s*(rating|stars?)?/i,
  /\bSLA guarantee\b/i,
  /\b\d+%\s*(uptime|availability)\b/i,
];

/**
 * Patterns that escalate to medium risk — claims that are plausibly verifiable
 * but easily inflated or worth a quick human glance. Topic words such as
 * "secure"/"security" are intentionally excluded to avoid flagging every
 * security-related statement.
 */
export const MEDIUM_RISK_PATTERNS: RegExp[] = [
  /\d[\d,]+\s*\+?\s*(users?|customers?|clients?|companies|enterprises?)\b/i,
  /\d[\d,]+\s*\+?\s*hours?\b/i,
  /\d[\d,]+\s*\+?\s*(professionals?|talent|experts?)\b/i,
  /\baverage\s+rating\b/i,
  /\bcertif(ied|ication)\b/i,
  /\bcomplian(t|ce)\b/i,
  /\baccredited\b/i,
  /\bnamed.+partner\b/i,
];

/** Patterns that indicate an FAQ has no answer on the page — should become a ContentGap. */
export const INCOMPLETE_ANSWER_PATTERNS: RegExp[] = [
  /not explicitly provided/i,
  /not provided/i,
  /not explicitly stated/i,
  /\bnot mentioned\b/i,
  /\bnot available\b/i,
  /\bunknown\b/i,
  /\bno answer\b/i,
  /answer:\s*not/i,
  /answer is not/i,
  /no information.*page/i,
  /page does not.*answer/i,
];

/** URL patterns that indicate legal/terms content. */
export const LEGAL_URL_PATTERNS: RegExp[] = [
  /\/terms/i,
  /\/privacy/i,
  /\/legal/i,
  /\/tos\b/i,
  /\/cookies/i,
  /\/gdpr/i,
  /\/data-protection/i,
];

/** Vague claim patterns — drop these entirely. */
export const VAGUE_PATTERNS: RegExp[] = [
  /there may be/i,
  /has pricing plans/i,
  /works in a certain way/i,
  /various places/i,
  /\bis different\b/i,
  /offers solutions/i,
  /provides services/i,
];

// ─── Review reasons ───────────────────────────────────────────────────────────

/**
 * Stable reason codes mapped to human-readable explanations.
 * Set on a fact when the engine flags it for review or elevated risk.
 * Reasons are deterministic (derived from the rule that fired) — no LLM.
 * Kept generic-but-specific: the claim text is shown alongside in the UI, so
 * the reviewer can see the offending phrase without it being interpolated here.
 */
export const REVIEW_REASONS = {
  /** CLAIM_ESCALATION_PATTERNS matched — superlative/performance claim. */
  SUPERLATIVE_UNSUBSTANTIATED:
    "Superlative or performance claim that's hard to independently verify.",
  /** MEDIUM_RISK_PATTERNS matched — counts/certifications/compliance. */
  MEDIUM_RISK_CLAIM:
    "Claim that's plausibly verifiable but easily inflated (customer counts, certifications, compliance).",
  /** proof_point category with weak supporting evidence. */
  PROOF_POINT_WEAK_EVIDENCE:
    "Proof point without strong supporting evidence.",
  /** Evidence quote too short or missing the numbers in the claim. */
  WEAK_EVIDENCE:
    "Evidence quote is too short or doesn't back up the numbers in the claim.",
  /** LLM extractor returned a high-risk classification. */
  HIGH_RISK_EXTRACTOR:
    "Flagged by the extractor as a higher-risk claim.",
  /** Policy statement extracted with low confidence. */
  POLICY_LOW_CONFIDENCE:
    "Policy statement extracted with low confidence — worth confirming.",
} as const;

export type ReviewReasonCode = keyof typeof REVIEW_REASONS;
