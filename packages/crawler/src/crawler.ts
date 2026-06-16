import { Page } from "@agentranks/core";
import { Fetcher, FetcherOptions } from "./fetcher.js";
import { parsePage, isHtmlContent } from "./parser.js";

export interface CrawlerOptions extends FetcherOptions {
  maxPages?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  onPageCrawled?: (page: Page, progress: CrawlProgress) => void;
}

export interface CrawlProgress {
  crawled: number;
  queued: number;
  skipped: number;
  errors: number;
  maxPages: number;
}

export interface CrawlResult {
  pages: Page[];
  progress: CrawlProgress;
  errors: Array<{ url: string; error: string }>;
}

export async function crawlSite(
  startUrl: string,
  opts: CrawlerOptions = {}
): Promise<CrawlResult> {
  const maxPages = opts.maxPages ?? 50;
  const fetcher = new Fetcher({
    crawlDelay: opts.crawlDelay ?? 500,
    timeout: opts.timeout ?? 15_000,
    userAgent: opts.userAgent,
    maxRetries: opts.maxRetries ?? 2,
  });

  // Normalize start URL
  const base = new URL(startUrl);
  const normalizedStart = base.toString().replace(/\/$/, "");

  // Load robots.txt
  const robotsTxt = await fetcher.fetchRobotsTxt(startUrl);
  const robotsChecker = parseRobotsTxt(robotsTxt);

  const visited = new Set<string>();
  const queue: string[] = [normalizedStart];
  const pages: Page[] = [];
  const errors: Array<{ url: string; error: string }> = [];

  const progress: CrawlProgress = {
    crawled: 0,
    queued: 1,
    skipped: 0,
    errors: 0,
    maxPages,
  };

  while (queue.length > 0 && pages.length < maxPages) {
    const url = queue.shift()!;

    if (visited.has(url)) {
      progress.queued = Math.max(0, progress.queued - 1);
      continue;
    }
    visited.add(url);
    progress.queued = Math.max(0, progress.queued - 1);

    // Check robots.txt
    if (!robotsChecker(url)) {
      progress.skipped++;
      continue;
    }

    // Check exclude patterns
    if (shouldExclude(url, opts.excludePatterns ?? [])) {
      progress.skipped++;
      continue;
    }

    // Check include patterns (if specified, URL must match at least one)
    if (
      opts.includePatterns &&
      opts.includePatterns.length > 0 &&
      !shouldInclude(url, opts.includePatterns)
    ) {
      progress.skipped++;
      continue;
    }

    const result = await fetcher.fetch(url);

    if (result.error) {
      errors.push({ url, error: result.error });
      progress.errors++;
      continue;
    }

    if (result.statusCode < 200 || result.statusCode >= 400) {
      errors.push({ url, error: `HTTP ${result.statusCode}` });
      progress.errors++;
      continue;
    }

    if (!isHtmlContent(result.contentType)) {
      progress.skipped++;
      continue;
    }

    const parsed = parsePage(result.html, url);

    const page: Page = {
      url: result.url,
      title: parsed.title,
      description: parsed.description,
      html: result.html.slice(0, 200_000), // Cap HTML storage at 200k
      text: parsed.text,
      links: parsed.links,
      crawledAt: new Date().toISOString(),
      statusCode: result.statusCode,
    };

    pages.push(page);
    progress.crawled++;

    opts.onPageCrawled?.(page, { ...progress });

    // Enqueue discovered links
    for (const link of parsed.links) {
      if (!visited.has(link) && !queue.includes(link)) {
        queue.push(link);
        progress.queued++;
      }
    }
  }

  return { pages, progress, errors };
}

/**
 * Minimal robots.txt parser.
 * Returns a function that checks whether a URL path is allowed for our bot.
 */
function parseRobotsTxt(robotsTxt: string): (url: string) => boolean {
  const disallowedPaths: string[] = [];
  let inRelevantBlock = false;

  for (const rawLine of robotsTxt.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.toLowerCase().startsWith("user-agent:")) {
      const agent = line.slice("user-agent:".length).trim().toLowerCase();
      inRelevantBlock = agent === "*" || agent === "agentranks" || agent === "agentranksbot";
    } else if (inRelevantBlock && line.toLowerCase().startsWith("disallow:")) {
      const path = line.slice("disallow:".length).trim();
      if (path) disallowedPaths.push(path);
    }
  }

  return (url: string): boolean => {
    let pathname: string;
    try {
      pathname = new URL(url).pathname;
    } catch {
      return true;
    }
    return !disallowedPaths.some((p) => pathname.startsWith(p));
  };
}

function shouldExclude(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    try {
      return new RegExp(pattern, "i").test(url);
    } catch {
      return url.includes(pattern);
    }
  });
}

function shouldInclude(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    try {
      return new RegExp(pattern, "i").test(url);
    } catch {
      return url.includes(pattern);
    }
  });
}
