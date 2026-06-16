import { FactCategorySchema } from "@agentranks/core";

export const VALID_CATEGORIES = new Set<string>(FactCategorySchema.options);

/** Patterns that always escalate a fact into the `claim` category at high risk. */
export const CLAIM_ESCALATION_PATTERNS: RegExp[] = [
  /\bROI\b/,
  /\bchurn reduction\b/i,
  /\bNRR improvement\b/i,
  /\bpass rate\b/i,
  /\bonly platform\b/i,
  /\bbest\b/i,
  /\bworld.?class\b/i,
  /\belite\b/i,
  /\bproven track record\b/i,
  /\bindustry.?leading\b/i,
  /\btop.?tier\b/i,
  /\btop.?rated\b/i,
  /\bno quality compromises?\b/i,
  /\d+(\.\d+)?\/5\s*(rating|stars?)?/i,
  /\d[\d,]+\s*\+?\s*(clients?|customers?|companies|enterprises?)\b/i,
  /\d[\d,]+\s*\+?\s*hours?\b/i,
  /\d[\d,]+\s*\+?\s*(professionals?|talent|experts?)\b/i,
  /enterprise.?grade security/i,
  /\bSOC\s*2\b/i,
  /\bGDPR.compliant\b/i,
  /\bISO\s*\d+\b/i,
  /\bhipaa\b/i,
  /\bSLA guarantee\b/i,
  /\b(guaranteed|guarantee)\b/i,
  /\b\d+%\s*(uptime|availability)\b/i,
  /\bcase stud(y|ies)\b/i,
  /\btestimon/i,
];

/** Patterns that escalate to medium risk. */
export const MEDIUM_RISK_PATTERNS: RegExp[] = [
  /\d[\d,]+\s*\+?\s*(users?|customers?|clients?)\b/i,
  /\baverage\s+rating\b/i,
  /\bcertif(ied|ication)\b/i,
  /\bcomplian(t|ce)\b/i,
  /\bsecure\b/i,
  /\bsecurity\b/i,
  /\baudit(ed)?\b/i,
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
