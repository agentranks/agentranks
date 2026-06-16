import { setTimeout as sleep } from "timers/promises";

export interface FetchResult {
  url: string;
  html: string;
  statusCode: number;
  contentType: string;
  error?: string;
}

export interface FetcherOptions {
  crawlDelay?: number;
  timeout?: number;
  userAgent?: string;
  maxRetries?: number;
}

const DEFAULT_USER_AGENT =
  "AgentRanksBot/0.2 (+https://github.com/agentranks/agentranks; AI crawler for structured business data)";

export class Fetcher {
  private readonly crawlDelay: number;
  private readonly timeout: number;
  private readonly userAgent: string;
  private readonly maxRetries: number;
  private lastFetchTime = 0;

  constructor(opts: FetcherOptions = {}) {
    this.crawlDelay = opts.crawlDelay ?? 500;
    this.timeout = opts.timeout ?? 15_000;
    this.userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;
    this.maxRetries = opts.maxRetries ?? 2;
  }

  async fetch(url: string): Promise<FetchResult> {
    await this.rateLimit();

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);

        const response = await globalThis.fetch(url, {
          headers: {
            "User-Agent": this.userAgent,
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          signal: controller.signal,
          redirect: "follow",
        });

        clearTimeout(timer);

        const contentType = response.headers.get("content-type") ?? "";
        const html = await response.text();

        return {
          url: response.url, // Follows redirects
          html,
          statusCode: response.status,
          contentType,
        };
      } catch (err) {
        if (attempt === this.maxRetries) {
          const msg = (err as Error).message ?? String(err);
          return {
            url,
            html: "",
            statusCode: 0,
            contentType: "",
            error: `Fetch failed after ${this.maxRetries + 1} attempts: ${msg}`,
          };
        }
        await sleep(1000 * (attempt + 1));
      }
    }

    return { url, html: "", statusCode: 0, contentType: "", error: "Unknown fetch error" };
  }

  async fetchRobotsTxt(baseUrl: string): Promise<string> {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString();
    try {
      const result = await this.fetch(robotsUrl);
      if (result.statusCode === 200) return result.html;
    } catch {
      // robots.txt is optional
    }
    return "";
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastFetchTime;
    if (elapsed < this.crawlDelay) {
      await sleep(this.crawlDelay - elapsed);
    }
    this.lastFetchTime = Date.now();
  }
}
