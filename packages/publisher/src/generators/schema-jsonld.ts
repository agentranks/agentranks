import { AgentRanksOutput, BusinessFact } from "@agentranks/core";

export interface SchemaOrgOutput {
  "@context": string;
  "@graph": unknown[];
}

/**
 * Generates schema.org JSON-LD from extracted business facts.
 * Includes Organization, Product, Service, FAQPage, and ItemList types.
 */
export function generateSchemaJsonLd(output: AgentRanksOutput): SchemaOrgOutput {
  const graph: unknown[] = [];

  // Organization
  graph.push(buildOrganization(output));

  // Products
  const productFacts = output.facts.filter((f) => f.category === "product");
  if (productFacts.length > 0) {
    graph.push(buildProductList(productFacts, output.business));
  }

  // Services
  const serviceFacts = output.facts.filter((f) => f.category === "service");
  if (serviceFacts.length > 0) {
    graph.push(buildServiceList(serviceFacts, output.business));
  }

  // FAQs
  const faqFacts = output.facts.filter((f) => f.category === "faq");
  if (faqFacts.length > 0) {
    graph.push(buildFaqPage(faqFacts, output.business));
  }

  // Pricing offers
  const pricingFacts = output.facts.filter((f) => f.category === "pricing");
  if (pricingFacts.length > 0) {
    for (const fact of pricingFacts) {
      graph.push(buildOffer(fact, output.business));
    }
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

function buildOrganization(output: AgentRanksOutput): unknown {
  const org: Record<string, unknown> = {
    "@type": "Organization",
    "@id": `${output.business.url}#organization`,
    name: output.business.name,
    url: output.business.url,
  };

  if (output.business.description) {
    org.description = output.business.description;
  }

  // Add contact info from location facts
  const contactFacts = output.facts.filter((f) => f.category === "location");
  if (contactFacts.length > 0) {
    const emails = contactFacts
      .map((f) => extractEmail(f.claim + " " + (f.detail ?? "")))
      .filter(Boolean);
    if (emails.length > 0) org.email = emails[0];

    const phones = contactFacts
      .map((f) => extractPhone(f.claim + " " + (f.detail ?? "")))
      .filter(Boolean);
    if (phones.length > 0) org.telephone = phones[0];
  }

  // SameAs from tech/general facts that mention social URLs
  const socialUrls = output.facts
    .flatMap((f) => extractSocialUrls(f.claim + " " + (f.detail ?? "")))
    .filter(Boolean);
  if (socialUrls.length > 0) {
    org.sameAs = [...new Set(socialUrls)];
  }

  return org;
}

function buildProductList(
  facts: BusinessFact[],
  business: { name: string; url: string }
): unknown {
  return {
    "@type": "ItemList",
    "@id": `${business.url}#products`,
    name: `${business.name} Products`,
    numberOfItems: facts.length,
    itemListElement: facts.map((fact, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "Product",
        name: fact.claim,
        description: fact.detail,
        url: fact.sourceUrl,
        brand: {
          "@type": "Organization",
          name: business.name,
        },
      },
    })),
  };
}

function buildServiceList(
  facts: BusinessFact[],
  business: { name: string; url: string }
): unknown {
  return {
    "@type": "ItemList",
    "@id": `${business.url}#services`,
    name: `${business.name} Services`,
    numberOfItems: facts.length,
    itemListElement: facts.map((fact, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "Service",
        name: fact.claim,
        description: fact.detail,
        url: fact.sourceUrl,
        provider: {
          "@type": "Organization",
          name: business.name,
        },
      },
    })),
  };
}

function buildFaqPage(
  facts: BusinessFact[],
  business: { name: string; url: string }
): unknown {
  return {
    "@type": "FAQPage",
    "@id": `${business.url}#faq`,
    name: `${business.name} FAQs`,
    mainEntity: facts.map((fact) => ({
      "@type": "Question",
      name: fact.claim,
      acceptedAnswer: {
        "@type": "Answer",
        text: fact.detail ?? fact.claim,
      },
    })),
  };
}

function buildOffer(
  fact: BusinessFact,
  business: { name: string; url: string }
): unknown {
  return {
    "@type": "Offer",
    description: fact.claim,
    url: fact.sourceUrl,
    seller: {
      "@type": "Organization",
      name: business.name,
    },
  };
}

// ─── Utility extractors ───────────────────────────────────────────────────────

function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}

function extractPhone(text: string): string | null {
  const match = text.match(/\+?[\d\s\-().]{7,}/);
  return match ? match[0].trim() : null;
}

function extractSocialUrls(text: string): string[] {
  const socialDomains = [
    "twitter.com",
    "x.com",
    "linkedin.com",
    "github.com",
    "facebook.com",
    "instagram.com",
    "youtube.com",
  ];
  const urls: string[] = [];
  const urlPattern = /https?:\/\/[^\s<>"']+/g;
  const matches = text.match(urlPattern) ?? [];
  for (const url of matches) {
    if (socialDomains.some((d) => url.includes(d))) {
      urls.push(url.replace(/[,.)]+$/, ""));
    }
  }
  return urls;
}
