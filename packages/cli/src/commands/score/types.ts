// ─── Score report types ───────────────────────────────────────────────────────

export interface CategoryScores {
  companyProfile: number;
  serviceProduct: number;
  pricingClarity: number;
  faqCoverage: number;
  policyClarity: number;
  useCaseCoverage: number;
  differentiatorQuality: number;
  evidenceQuality: number;
  riskBurden: number;
  outputReadiness: number;
}

export interface FactCounts {
  totalFacts: number;
  publishableFacts: number;
  approvedFacts: number;
  extractedFacts: number;
  needsReviewFacts: number;
  rejectedFacts: number;
  highRiskFacts: number;
  lowPriorityFacts: number;
}

export interface ScoreReport {
  overallScore: number;
  categoryScores: CategoryScores;
  missingSections: string[];
  notPublishableSections: string[];
  weakSections: string[];
  healthySections: string[];
  counts: FactCounts;
  recommendations: string[];
}

export type SectionStatus = "healthy" | "weak" | "notPublishable" | "missing";

// ─── Section definitions ──────────────────────────────────────────────────────

export interface SectionDef {
  name: string;
  label: string;
  categories: string[];
  threshold: number;
}

export const SECTIONS: SectionDef[] = [
  { name: "company_profile", label: "Company Profile",    categories: ["company_profile"],        threshold: 1 },
  { name: "service_product", label: "Service/Product",   categories: ["service", "product"],      threshold: 3 },
  { name: "pricing",         label: "Pricing",            categories: ["pricing"],                 threshold: 2 },
  { name: "faq",             label: "FAQ",                categories: ["faq"],                     threshold: 3 },
  { name: "policy",          label: "Policy/Limitation",  categories: ["policy", "limitation"],    threshold: 2 },
  { name: "use_case",        label: "Use Cases",          categories: ["use_case"],                threshold: 3 },
  { name: "differentiator",  label: "Differentiators",    categories: ["differentiator"],          threshold: 2 },
];
