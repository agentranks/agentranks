import { DeployResult } from "./types.js";

/** Build a human-readable Markdown deploy report. */
export function buildDeployReport(result: DeployResult): string {
  const {
    deployedAt, baseUrl, target, sitemapUrl,
    deployedFiles, publicUrls, warnings, publishingModes,
  } = result;

  const lines: string[] = [];

  lines.push("# AgentRanks Deploy Report");
  lines.push("");
  lines.push(`**Deployed at:** ${deployedAt}`);
  lines.push(`**Target directory:** \`${target}\``);
  lines.push(`**Base URL:** ${baseUrl}`);
  lines.push(`**Sitemap URL:** ${sitemapUrl}`);
  lines.push("");

  if (publishingModes.length > 0) {
    lines.push("## Publishing Modes Detected");
    lines.push("");
    for (const mode of publishingModes) {
      const label =
        mode === "public_indexable"
          ? "✓ Indexable"
          : mode === "public_noindex"
          ? "⚠ Noindex"
          : "⚠ Private export (force-deployed)";
      lines.push(`- ${label}: \`${mode}\``);
    }
    lines.push("");
  }

  if (warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const w of warnings) {
      lines.push(`- ⚠ ${w}`);
    }
    lines.push("");
  }

  lines.push("## Files Written");
  lines.push("");
  for (const f of deployedFiles) {
    lines.push(`- \`${f}\``);
  }
  lines.push("");

  lines.push("## Public URLs");
  lines.push("");
  for (const u of publicUrls) {
    lines.push(`- ${u}`);
  }
  lines.push("");

  lines.push("## Indexability");
  lines.push("");
  if (publishingModes.includes("public_indexable")) {
    lines.push("- `public_indexable` pages: `index, follow` — eligible for search and AI indexing.");
  }
  if (publishingModes.includes("public_noindex")) {
    lines.push("- `public_noindex` pages: `noindex, follow` — accessible but not indexed by default.");
    lines.push("  To make them indexable, rerun: `agentranks intents --publishing-mode public_indexable` then redeploy.");
  }
  if (publishingModes.includes("private_export")) {
    lines.push("- `private_export` pages were force-deployed. These were not intended for public indexing.");
  }
  lines.push("");

  lines.push("## Next Steps");
  lines.push("");
  lines.push(
    "1. **Copy `agentranks-public/` to your website.** " +
      "Upload the contents to your server's public root or CDN. " +
      "The folder structure maps directly to URL paths."
  );
  lines.push(
    "2. **Verify URLs return HTTP 200.** " +
      "Test each URL in the list above before submitting to search engines."
  );
  lines.push(
    "3. **Add the sitemap to Google Search Console.**\n" +
      "   Visit Search Console → Sitemaps → Submit:\n" +
      `   \`${sitemapUrl}\``
  );
  lines.push(
    "4. **Use URL Inspection for key pages.** " +
      "Use Google Search Console's URL Inspection tool to request indexing for " +
      "`/ai-profile/`, `/services/`, and your top intent pages."
  );
  lines.push(
    "5. **Optionally submit URLs to Bing / IndexNow later.** " +
      "Use `.agentranks/deploy/submit-urls.txt` with `agentranks submit --indexnow`."
  );
  lines.push(
    "6. **Indexing is not instant.** " +
      "Google typically crawls new pages within days to weeks. " +
      "Monitor coverage in Search Console."
  );
  lines.push(
    "7. **Humans and crawlers see the same content.** " +
      "These pages are honest documents accessible to all visitors — no cloaking."
  );
  lines.push("");

  return lines.join("\n");
}
