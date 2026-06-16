import * as cheerio from "cheerio";

export interface ParsedPage {
  title: string;
  description: string;
  text: string;
  links: string[];
  metaKeywords: string;
  h1: string[];
  h2: string[];
}

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "nav",
  "footer",
  "header",
  "[aria-hidden='true']",
  ".cookie-banner",
  "#cookie-notice",
  ".advertisement",
  ".ads",
];

export function parsePage(html: string, baseUrl: string): ParsedPage {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || $("h1").first().text().trim();

  const description =
    $('meta[name="description"]').attr("content")?.trim() ??
    $('meta[property="og:description"]').attr("content")?.trim() ??
    "";

  const metaKeywords =
    $('meta[name="keywords"]').attr("content")?.trim() ?? "";

  // Extract headings before removing elements
  const h1 = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const h2 = $("h2")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  // Extract links before removing noise
  const base = new URL(baseUrl);
  const links: string[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    try {
      const resolved = new URL(href, baseUrl);
      // Only follow same-origin links with http/https
      if (
        resolved.hostname === base.hostname &&
        (resolved.protocol === "http:" || resolved.protocol === "https:")
      ) {
        // Normalize: strip hash and trailing slash from path
        resolved.hash = "";
        const normalized = resolved.toString().replace(/\/$/, "");
        if (!seen.has(normalized)) {
          seen.add(normalized);
          links.push(normalized);
        }
      }
    } catch {
      // Ignore invalid URLs
    }
  });

  // Remove noisy elements before extracting text
  $(NOISE_SELECTORS.join(", ")).remove();

  // Extract clean readable text
  const text = extractText($);

  return { title, description, text, links, metaKeywords, h1, h2 };
}

function extractText($: cheerio.CheerioAPI): string {
  const body = $("body");
  if (!body.length) return $("*").text().replace(/\s+/g, " ").trim();

  const lines: string[] = [];

  const blockTags = new Set([
    "p", "div", "section", "article", "main", "aside",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "li", "dt", "dd", "td", "th", "blockquote",
    "pre", "code",
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(el: any): void {
    const node = $(el);
    const tag = (el.tagName as string | undefined)?.toLowerCase();

    if (!tag) {
      // Text node
      const text = (el.data as string | undefined)?.trim();
      if (text && text.length > 1) lines.push(text);
      return;
    }

    if (blockTags.has(tag)) {
      const text = node.text().replace(/\s+/g, " ").trim();
      if (text.length > 2) lines.push(text);
    } else {
      node.contents().each((_: number, child: unknown) => walk(child));
    }
  }

  body.children().each((_: number, el: unknown) => walk(el));

  // Deduplicate adjacent identical lines and join
  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped[deduped.length - 1] !== line) {
      deduped.push(line);
    }
  }

  return deduped.join("\n").slice(0, 50_000); // Cap per-page text at 50k chars
}

export function isHtmlContent(contentType: string): boolean {
  return contentType.includes("text/html") || contentType.includes("application/xhtml");
}
