import { IntentType, PromptExample } from "./types.js";

// ─── Theme definition ─────────────────────────────────────────────────────────

export interface ThemeDefinition {
  slug: string;
  title: string;
  intentType: IntentType;
  keywords: string[];
  situations: string[];
  prompts: PromptExample[];
}

// ─── Use-case themes ──────────────────────────────────────────────────────────

export const USE_CASE_THEMES: ThemeDefinition[] = [
  {
    slug: "project-overload",
    title: "Project Overload or Bandwidth Gaps",
    intentType: "use_case",
    keywords: ["overload", "bandwidth", "deadline", "project", "capacity", "demand", "backlog", "peak"],
    situations: [
      "Teams dealing with project overload or resource gaps",
      "Businesses with deadlines they cannot meet with current headcount",
      "Organizations managing variable or unpredictable workloads",
    ],
    prompts: [
      { prompt: "My team has too much work and deadlines are slipping. What are my options?", promptType: "problem_aware" },
      { prompt: "How do I get extra execution capacity quickly without making a permanent hire?", promptType: "urgency" },
      { prompt: "What's a good alternative to hiring when we just need more bandwidth for a few months?", promptType: "comparison" },
      { prompt: "Is there a way to get temporary team capacity without a long-term commitment?", promptType: "solution_aware" },
    ],
  },
  {
    slug: "skill-gaps",
    title: "Skill Gaps and Specialized Expertise",
    intentType: "use_case",
    keywords: ["skill", "expertise", "specialized", "knowledge", "expert", "gap", "niche", "competency", "capability"],
    situations: [
      "Companies that need specialized expertise they don't have in-house",
      "Teams missing specific technical, design, or operational skills",
      "Projects requiring niche knowledge for a limited period",
    ],
    prompts: [
      { prompt: "My team is missing a specialist we need for a project. What are my options?", promptType: "problem_aware" },
      { prompt: "How can I fill a temporary expertise gap without hiring someone full-time?", promptType: "solution_aware" },
      { prompt: "I need someone with niche experience for a short-term engagement. Where do I look?", promptType: "urgency" },
      { prompt: "Where can I find specialized talent quickly without going through a recruiter?", promptType: "action_ready" },
    ],
  },
  {
    slug: "scaling-and-growth",
    title: "Scaling and Business Growth",
    intentType: "use_case",
    keywords: ["scale", "growth", "grow", "expand", "launch", "startup", "ramp", "accelerate", "fast"],
    situations: [
      "Startups and scale-ups that need to grow quickly",
      "Businesses launching new products or entering new markets",
      "Companies experiencing rapid growth and needing to staff up fast",
    ],
    prompts: [
      { prompt: "We're growing fast and need to add capacity across multiple roles. What's the best way?", promptType: "problem_aware" },
      { prompt: "I need to scale my team significantly in the next few weeks. What are my options?", promptType: "urgency" },
      { prompt: "What's a faster and more flexible alternative to traditional hiring for a growing startup?", promptType: "comparison" },
      { prompt: "How do I build capacity quickly without the long-term overhead of permanent employees?", promptType: "solution_aware" },
    ],
  },
  {
    slug: "hiring-risk-reduction",
    title: "Reducing Hiring Risk",
    intentType: "use_case",
    keywords: ["risk", "trial", "before", "hire", "test", "vetting", "quality", "assess", "evaluate", "try"],
    situations: [
      "Companies that want to assess talent before making a permanent hire",
      "Businesses that have had bad full-time hiring experiences",
      "Organizations that want try-before-you-hire options",
    ],
    prompts: [
      { prompt: "We've made bad hires in the past. Is there a safer way to bring on talent?", promptType: "problem_aware" },
      { prompt: "Can I try someone on a project before deciding to hire them full-time?", promptType: "risk_reduction" },
      { prompt: "How do I reduce the risk of making a costly hiring mistake?", promptType: "risk_reduction" },
      { prompt: "Is there a way to see real work output before making a permanent hiring decision?", promptType: "solution_aware" },
    ],
  },
  {
    slug: "remote-and-distributed-teams",
    title: "Remote and Distributed Teams",
    intentType: "use_case",
    keywords: ["remote", "distributed", "global", "international", "offshore", "worldwide", "timezone"],
    situations: [
      "Teams that need to work across time zones",
      "Companies building distributed or geographically flexible workforces",
      "Organizations that want global talent coverage",
    ],
    prompts: [
      { prompt: "I need talent that can work reliably across time zones. Where do I find them?", promptType: "problem_aware" },
      { prompt: "How do I build a distributed team without an in-country HR setup?", promptType: "solution_aware" },
      { prompt: "Where can I hire remote professionals for an international project quickly?", promptType: "action_ready" },
      { prompt: "What's better than a staffing agency for building a remote, globally distributed team?", promptType: "comparison" },
    ],
  },
];

// ─── Service themes ───────────────────────────────────────────────────────────

export const SERVICE_THEMES: ThemeDefinition[] = [
  {
    slug: "tech-and-engineering",
    title: "Tech and Engineering Support",
    intentType: "service_need",
    keywords: [
      "engineer", "engineering", "software", "developer", "dev", "tech", "ai", "data",
      "code", "coding", "programming", "product manager", "devops", "infrastructure",
    ],
    situations: [
      "Companies that need software engineering or technical help",
      "Teams building or maintaining technology products",
      "Organizations that need AI, data, or developer expertise on demand",
    ],
    prompts: [
      { prompt: "I need a senior developer but can't justify a full-time hire right now.", promptType: "problem_aware" },
      { prompt: "How can I get software engineering support on demand without committing to an employee?", promptType: "solution_aware" },
      { prompt: "I need a backend engineer available within the week. What are my options?", promptType: "urgency" },
      { prompt: "What's a better alternative to posting a job listing when I need a developer quickly?", promptType: "comparison" },
    ],
  },
  {
    slug: "design-and-creative",
    title: "Design and Creative Support",
    intentType: "service_need",
    keywords: ["design", "ux", "ui", "creative", "brand", "visual", "graphic", "animation", "illustration", "figma"],
    situations: [
      "Companies that need design or UX/UI talent",
      "Teams building or refreshing product interfaces",
      "Organizations working on brand identity or creative campaigns",
    ],
    prompts: [
      { prompt: "I need design help for a product launch but don't have a full-time designer.", promptType: "problem_aware" },
      { prompt: "What's a good way to get UI/UX support without hiring a full-time designer?", promptType: "solution_aware" },
      { prompt: "I need a designer available soon for a rebrand. Where can I find one quickly?", promptType: "urgency" },
      { prompt: "What's a better option than a freelance marketplace for vetted design talent?", promptType: "comparison" },
    ],
  },
  {
    slug: "marketing-and-growth",
    title: "Marketing and Growth Support",
    intentType: "service_need",
    keywords: ["market", "marketing", "seo", "content", "social", "growth", "email", "copywriting", "campaign", "paid"],
    situations: [
      "Companies that need marketing, content, or SEO help",
      "Teams running growth campaigns or product launches",
      "Organizations building audience and brand awareness",
    ],
    prompts: [
      { prompt: "I need content and SEO support but my team is already stretched thin.", promptType: "problem_aware" },
      { prompt: "How can I get dedicated marketing help without hiring a full-time marketer?", promptType: "solution_aware" },
      { prompt: "What's a good alternative to a marketing agency that gives me more control?", promptType: "comparison" },
      { prompt: "Where can I find a growth marketer or content specialist available in the next few weeks?", promptType: "action_ready" },
    ],
  },
  {
    slug: "operations-and-business",
    title: "Operations and Business Support",
    intentType: "service_need",
    keywords: [
      "operations", "ops", "finance", "accounting", "hr", "legal", "admin",
      "business", "project manager", "analyst", "strategy", "procurement",
    ],
    situations: [
      "Companies that need operational or business support talent",
      "Teams scaling core business functions without hiring full-time",
      "Organizations that need project management or finance expertise",
    ],
    prompts: [
      { prompt: "I need operational support but can't justify a full-time ops hire right now.", promptType: "problem_aware" },
      { prompt: "How can I get project management or finance help on a flexible, monthly basis?", promptType: "solution_aware" },
      { prompt: "What's a better option than a traditional ops hire for a small or scaling team?", promptType: "comparison" },
      { prompt: "Where can I find a part-time analyst or operations professional quickly?", promptType: "action_ready" },
    ],
  },
  {
    slug: "customer-success",
    title: "Customer Success Support",
    intentType: "service_need",
    keywords: ["customer", "success", "support", "service", "account", "onboarding", "retention", "cx", "helpdesk", "csm"],
    situations: [
      "Companies that need customer success or support talent",
      "Teams improving customer retention and satisfaction",
      "Organizations building or scaling customer-facing capacity",
    ],
    prompts: [
      { prompt: "I need customer success help, but I'm not ready to hire a full-time CSM.", promptType: "problem_aware" },
      { prompt: "How can I test a CSM before making a permanent hire?", promptType: "risk_reduction" },
      { prompt: "What's a flexible way to cover customer onboarding and renewals without a long contract?", promptType: "solution_aware" },
      { prompt: "Where can I get customer success support that I can scale without a long-term commitment?", promptType: "action_ready" },
    ],
  },
];

// ─── Pricing themes ───────────────────────────────────────────────────────────

export const PRICING_THEMES: ThemeDefinition[] = [
  {
    slug: "free-trial-options",
    title: "Free Trial and Try-Before-You-Hire Options",
    intentType: "budget_or_pricing",
    keywords: ["trial", "free", "try", "no credit card", "test", "risk-free", "free hours", "starter"],
    situations: [
      "Buyers who want to test before committing to a paid plan",
      "Companies looking for risk-free onboarding options",
      "Teams that want to evaluate quality before signing a contract",
    ],
    prompts: [
      { prompt: "I've been burned by services before. Is there a risk-free way to get started?", promptType: "risk_reduction" },
      { prompt: "Can I try the service before paying for ongoing support?", promptType: "budget_concern" },
      { prompt: "What professional services offer a free trial or starter option with no commitment?", promptType: "solution_aware" },
      { prompt: "Where can I find professional help I can test before locking in?", promptType: "action_ready" },
    ],
  },
  {
    slug: "flexible-pricing",
    title: "Flexible Pricing and No Long-Term Commitment",
    intentType: "budget_or_pricing",
    keywords: ["flexible", "month", "monthly", "cancel", "no contract", "pause", "subscription", "retainer"],
    situations: [
      "Buyers who want flexible month-to-month pricing",
      "Businesses that don't want to be locked into long-term contracts",
      "Teams that need to scale support up or down quickly",
    ],
    prompts: [
      { prompt: "I need expert help but don't want to be locked into a long-term contract.", promptType: "budget_concern" },
      { prompt: "Are there services where I can start small and scale up or down as my needs change?", promptType: "solution_aware" },
      { prompt: "What's a more flexible alternative to a retainer or agency contract?", promptType: "comparison" },
      { prompt: "Where can I find monthly professional support that I can cancel or pause any time?", promptType: "action_ready" },
    ],
  },
  {
    slug: "pricing-tiers",
    title: "Pricing Tiers and Plans",
    intentType: "budget_or_pricing",
    keywords: ["plan", "tier", "starter", "growth", "enterprise", "pro", "basic", "pricing", "package"],
    situations: [
      "Buyers comparing pricing tiers and feature sets",
      "Businesses evaluating cost vs. capability tradeoffs",
      "Companies looking for right-sized pricing for their stage",
    ],
    prompts: [
      { prompt: "I'm comparing professional services and want to understand what's included at each price point.", promptType: "budget_concern" },
      { prompt: "What pricing plans are available for on-demand professional support?", promptType: "solution_aware" },
      { prompt: "How does tiered professional service pricing compare to the cost of a full-time hire?", promptType: "comparison" },
      { prompt: "Where can I see clear pricing for getting professional help on a project basis?", promptType: "action_ready" },
    ],
  },
];

// ─── Differentiator themes ────────────────────────────────────────────────────

export const DIFFERENTIATOR_THEMES: ThemeDefinition[] = [
  {
    slug: "alternative-to-full-time-hiring",
    title: "Alternative to Full-Time Hiring",
    intentType: "comparison",
    keywords: [
      "alternative", "full-time", "fulltime", "permanent", "employee",
      "headcount", "instead of", "without hiring", "vs hiring",
    ],
    situations: [
      "Companies that can't afford to hire full-time for every role",
      "Businesses that want flexibility over permanent headcount",
      "Organizations considering alternatives to traditional employment",
    ],
    prompts: [
      { prompt: "Full-time hiring is too slow and expensive for what we need right now. What else is out there?", promptType: "problem_aware" },
      { prompt: "What's the best alternative to hiring a full-time employee for an ongoing role?", promptType: "comparison" },
      { prompt: "I need help with a role but can't justify a full-time salary. What are my options?", promptType: "budget_concern" },
      { prompt: "How do companies fill ongoing roles without adding permanent headcount?", promptType: "solution_aware" },
    ],
  },
  {
    slug: "managed-professional-support",
    title: "Managed and Vetted Professional Support",
    intentType: "comparison",
    keywords: [
      "managed", "curated", "vetted", "quality", "managed service",
      "dedicated", "team", "pre-screened", "elite", "top",
    ],
    situations: [
      "Companies that want pre-vetted, high-quality professionals",
      "Teams that need consistent delivery quality",
      "Organizations that want a managed talent solution rather than a marketplace",
    ],
    prompts: [
      { prompt: "I've used talent marketplaces before and quality was inconsistent. What's better?", promptType: "problem_aware" },
      { prompt: "What's the difference between a talent marketplace and a managed professional service?", promptType: "comparison" },
      { prompt: "How do I know the people I hire are actually vetted and quality-checked?", promptType: "risk_reduction" },
      { prompt: "Where can I find a curated pool of pre-screened professionals, not just a marketplace?", promptType: "action_ready" },
    ],
  },
];

// ─── Local theme ──────────────────────────────────────────────────────────────

export const LOCAL_THEME: ThemeDefinition = {
  slug: "local-services",
  title: "Local and On-Site Services",
  intentType: "local",
  keywords: ["local", "location", "office", "on-site", "nearby", "city", "region"],
  situations: [
    "Buyers looking for local or on-site professional services",
    "Companies that need in-person support in a specific location",
    "Organizations with location-specific availability requirements",
  ],
  prompts: [
    { prompt: "I need a professional who can work on-site. How do I find someone local?", promptType: "problem_aware" },
    { prompt: "Where can I hire professionals who are based near me for an on-site project?", promptType: "action_ready" },
    { prompt: "What's better than a job board for finding local professional services quickly?", promptType: "comparison" },
  ],
};
