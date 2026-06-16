import { marked } from "marked";

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Extract the first H1 from a Markdown string as the page title. */
export function extractTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "AgentRanks Page";
}

/** Convert Markdown to HTML using the `marked` package. */
export function mdToHtml(markdown: string): string {
  const result = marked.parse(markdown);
  return typeof result === "string" ? result : String(result);
}

/**
 * Wrap converted HTML in a minimal, readable HTML document.
 *
 * Includes charset, viewport, title, canonical, robots, generator meta,
 * optional schema.org JSON-LD in <head>, and minimal inline CSS.
 */
export function buildHtml(opts: {
  title: string;
  canonicalUrl: string;
  robotsContent: string;
  bodyHtml: string;
  schemaJsonLd?: string;
  deployedAt: string;
}): string {
  const { title, canonicalUrl, robotsContent, bodyHtml, schemaJsonLd, deployedAt } = opts;

  const schemaTag = schemaJsonLd
    ? `  <script type="application/ld+json">\n${schemaJsonLd}\n  </script>\n`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta name="robots" content="${robotsContent}">
  <meta name="generator" content="AgentRanks — generated at ${deployedAt}">
${schemaTag}  <style>
    body { max-width: 800px; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, -apple-system, sans-serif; line-height: 1.65; color: #1a1a1a; }
    h1 { font-size: 2rem; margin-top: 0; }
    h2 { font-size: 1.4rem; margin-top: 2rem; }
    h3 { font-size: 1.15rem; margin-top: 1.5rem; }
    p { margin: 0.75rem 0; }
    ul, ol { padding-left: 1.5rem; }
    li { margin: 0.25rem 0; }
    code { background: #f4f4f4; padding: 0.15em 0.35em; border-radius: 3px; font-size: 0.88em; font-family: ui-monospace, monospace; }
    pre { background: #f4f4f4; padding: 1em 1.25em; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; font-size: 0.875em; }
    blockquote { border-left: 3px solid #d0d0d0; margin: 1rem 0; padding: 0.5rem 1rem; color: #555; background: #fafafa; }
    a { color: #0057b8; }
    a:hover { color: #003d82; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #e0e0e0; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #f4f4f4; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}
