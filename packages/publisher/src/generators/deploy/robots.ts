/** Build a suggested robots.txt block for the user to merge into their site. */
export function buildRobotsSuggested(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, "");
  return [
    "User-agent: *",
    "Allow: /ai/",
    "Allow: /ai-profile/",
    "Allow: /services/",
    "Allow: /products/",
    "Allow: /pricing/",
    "Allow: /faqs/",
    "Allow: /policies/",
    "Allow: /use-cases/",
    "Allow: /differentiators/",
    "Allow: /llms.txt",
    "Allow: /agentranks.json",
    "Allow: /schema.json",
    `Sitemap: ${normalized}/ai/sitemap.xml`,
    "",
  ].join("\n");
}
