import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  extractTitle,
  mdToHtml,
  buildHtml,
  buildSitemap,
  buildRobotsSuggested,
  buildDeployReport,
  runDeploy,
  AGENTRANKS_GENERATED_PATHS,
} from "@agentranks/publisher";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_URL = "https://example.com";

const SAMPLE_MD = `# Test Page Title

This is a paragraph with **bold** and _italic_ text.

## Section

- Item one
- Item two

\`\`\`js
const x = 1;
\`\`\`

> A blockquote line.
`;

const MINIMAL_INTENTS_JSON = (publishingMode = "public_indexable") =>
  JSON.stringify({
    generatedAt: "2026-06-01T00:00:00.000Z",
    business: { name: "Acme Corp", url: "https://example.com" },
    publishingMode,
    briefs: [
      {
        slug: "skill-gaps",
        publishingMode,
      },
    ],
  });

// ─── Temp directory helpers ────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agentranks-deploy-test-"));
}

function buildFakeInputDir(
  tmpDir: string,
  opts: {
    intentsPublishingMode?: string;
    skipIntentsJson?: boolean;
    skipSchemaJson?: boolean;
    includeIntentBrief?: boolean;
  } = {}
): string {
  const inputDir = path.join(tmpDir, "agentranks-output");
  const intentsDir = path.join(inputDir, "intents");
  fs.mkdirSync(intentsDir, { recursive: true });

  // Core markdown files
  const coreFiles = [
    "ai-profile.md",
    "services.md",
    "products.md",
    "pricing.md",
    "faqs.md",
    "policies.md",
    "use-cases.md",
    "differentiators.md",
  ];
  for (const file of coreFiles) {
    const title = file.replace(".md", "").replace(/-/g, " ");
    fs.writeFileSync(
      path.join(inputDir, file),
      `# ${title}\n\nSome content for ${file}.\n`,
      "utf-8"
    );
  }

  // Direct copy files
  fs.writeFileSync(
    path.join(inputDir, "llms.txt"),
    "# LLMs.txt\nBusiness info.\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(inputDir, "agentranks.json"),
    JSON.stringify({ version: "1" }),
    "utf-8"
  );

  if (!opts.skipSchemaJson) {
    fs.writeFileSync(
      path.join(inputDir, "schema.json"),
      JSON.stringify({ "@context": "https://schema.org", "@type": "Organization" }),
      "utf-8"
    );
  }

  // Intents files
  fs.writeFileSync(
    path.join(intentsDir, "index.md"),
    "# Intent Index\n\nList of all intent briefs.\n",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(intentsDir, "prompts.md"),
    "# AI Intent Prompts\n\nExample prompts.\n",
    "utf-8"
  );

  const publishingMode = opts.intentsPublishingMode ?? "public_indexable";

  if (!opts.skipIntentsJson) {
    fs.writeFileSync(
      path.join(intentsDir, "intents.json"),
      MINIMAL_INTENTS_JSON(publishingMode),
      "utf-8"
    );

    if (opts.includeIntentBrief !== false) {
      fs.writeFileSync(
        path.join(intentsDir, "skill-gaps.md"),
        "# When to recommend Acme for Skill Gaps\n\nContent here.\n",
        "utf-8"
      );
    }
  }

  return inputDir;
}

function buildDeployDirs(tmpDir: string): {
  inputDir: string;
  targetDir: string;
  configDir: string;
} {
  const inputDir = buildFakeInputDir(tmpDir, { includeIntentBrief: true });
  const targetDir = path.join(tmpDir, "agentranks-public");
  const configDir = path.join(tmpDir, ".agentranks");
  return { inputDir, targetDir, configDir };
}

// ─── extractTitle ─────────────────────────────────────────────────────────────

describe("extractTitle", () => {
  it("extracts first H1 from markdown", () => {
    const md = "# My Page Title\n\nSome content.";
    assert.equal(extractTitle(md), "My Page Title");
  });

  it("strips leading # and whitespace", () => {
    const md = "#   Padded Title  \n\nBody.";
    assert.equal(extractTitle(md), "Padded Title");
  });

  it("returns fallback when no H1 present", () => {
    const md = "## Section without H1\n\nContent.";
    assert.equal(extractTitle(md), "AgentRanks Page");
  });

  it("returns fallback for empty string", () => {
    assert.equal(extractTitle(""), "AgentRanks Page");
  });
});

// ─── mdToHtml ─────────────────────────────────────────────────────────────────

describe("mdToHtml", () => {
  it("converts H1 heading to <h1>", () => {
    const html = mdToHtml("# Hello World");
    assert.ok(html.includes("<h1>"), "should contain <h1>");
    assert.ok(html.includes("Hello World"), "should contain heading text");
  });

  it("converts bold to <strong>", () => {
    const html = mdToHtml("**bold text**");
    assert.ok(html.includes("<strong>bold text</strong>"), "should convert bold");
  });

  it("converts unordered list to <ul>", () => {
    const html = mdToHtml("- item one\n- item two");
    assert.ok(html.includes("<ul>"), "should contain <ul>");
    assert.ok(html.includes("<li>item one</li>"), "should contain list items");
  });

  it("converts blockquote to <blockquote>", () => {
    const html = mdToHtml("> A quote");
    assert.ok(html.includes("<blockquote>"), "should contain <blockquote>");
  });

  it("converts inline code to <code>", () => {
    const html = mdToHtml("Use `marked` package.");
    assert.ok(html.includes("<code>marked</code>"), "should convert inline code");
  });

  it("converts fenced code block to <pre><code>", () => {
    const html = mdToHtml("```js\nconst x = 1;\n```");
    assert.ok(html.includes("<pre>"), "should contain <pre>");
    assert.ok(html.includes("<code"), "should contain <code element (may include class attribute)");
  });

  it("returns non-empty string for full sample markdown", () => {
    const html = mdToHtml(SAMPLE_MD);
    assert.ok(html.length > 0, "should return non-empty string");
    assert.ok(html.includes("<h1>"), "should contain h1");
    assert.ok(html.includes("<h2>"), "should contain h2");
    assert.ok(html.includes("<ul>"), "should contain ul");
    assert.ok(html.includes("<blockquote>"), "should contain blockquote");
    assert.ok(html.includes("<pre>"), "should contain pre");
  });
});

// ─── buildHtml ────────────────────────────────────────────────────────────────

describe("buildHtml", () => {
  const base = {
    title: "Test Page",
    canonicalUrl: "https://example.com/test/",
    robotsContent: "index, follow",
    bodyHtml: "<p>Body content</p>",
    deployedAt: "2026-06-01T00:00:00.000Z",
  };

  it("includes charset meta tag", () => {
    const html = buildHtml(base);
    assert.ok(html.includes('<meta charset="utf-8">'));
  });

  it("includes viewport meta tag", () => {
    const html = buildHtml(base);
    assert.ok(html.includes('<meta name="viewport"'));
  });

  it("includes title element", () => {
    const html = buildHtml(base);
    assert.ok(html.includes("<title>Test Page</title>"));
  });

  it("includes canonical link", () => {
    const html = buildHtml(base);
    assert.ok(html.includes('rel="canonical"'));
    assert.ok(html.includes("https://example.com/test/"));
  });

  it("includes robots meta", () => {
    const html = buildHtml(base);
    assert.ok(html.includes('name="robots"'));
    assert.ok(html.includes("index, follow"));
  });

  it("includes generator meta with timestamp", () => {
    const html = buildHtml(base);
    assert.ok(html.includes('name="generator"'));
    assert.ok(html.includes("AgentRanks"));
    assert.ok(html.includes("2026-06-01T00:00:00.000Z"));
  });

  it("includes body content", () => {
    const html = buildHtml(base);
    assert.ok(html.includes("<p>Body content</p>"));
  });

  it("includes inline CSS", () => {
    const html = buildHtml(base);
    assert.ok(html.includes("<style>"));
    assert.ok(html.includes("max-width"));
    assert.ok(html.includes("font-family"));
    assert.ok(html.includes("line-height"));
  });

  it("does not include JSON-LD script when schemaJsonLd is undefined", () => {
    const html = buildHtml(base);
    assert.ok(
      !html.includes("application/ld+json"),
      "should not include JSON-LD script"
    );
  });

  it("includes JSON-LD script when schemaJsonLd is provided", () => {
    const schemaJsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
    });
    const html = buildHtml({ ...base, schemaJsonLd });
    assert.ok(html.includes('type="application/ld+json"'), "should include JSON-LD script tag");
    assert.ok(html.includes("https://schema.org"), "should include schema content");
  });

  it("sets noindex meta when robotsContent is noindex", () => {
    const html = buildHtml({ ...base, robotsContent: "noindex, follow" });
    assert.ok(html.includes("noindex, follow"));
  });

  it("escapes HTML entities in title", () => {
    const html = buildHtml({ ...base, title: 'Page <script> & "quoted"' });
    assert.ok(
      html.includes("&lt;script&gt;"),
      "should escape < and > in title"
    );
    assert.ok(html.includes("&amp;"), "should escape & in title");
  });
});

// ─── buildSitemap ─────────────────────────────────────────────────────────────

describe("buildSitemap", () => {
  const entries = [
    { url: "https://example.com/ai-profile/", lastmod: "2026-06-01" },
    { url: "https://example.com/ai/intents/skill-gaps/", lastmod: "2026-06-01" },
  ];

  it("produces valid XML declaration", () => {
    const xml = buildSitemap(entries);
    assert.ok(xml.startsWith('<?xml version="1.0"'));
  });

  it("includes all URLs", () => {
    const xml = buildSitemap(entries);
    assert.ok(xml.includes("https://example.com/ai-profile/"));
    assert.ok(xml.includes("https://example.com/ai/intents/skill-gaps/"));
  });

  it("each URL has a <lastmod> element", () => {
    const xml = buildSitemap(entries);
    const lastmodCount = (xml.match(/<lastmod>/g) ?? []).length;
    assert.equal(lastmodCount, 2);
  });

  it("uses trailing slash URLs consistently", () => {
    const xml = buildSitemap(entries);
    assert.ok(xml.includes("https://example.com/ai-profile/"));
    assert.ok(xml.includes("https://example.com/ai/intents/skill-gaps/"));
  });

  it("each slug appears exactly once in sitemap", () => {
    const xml = buildSitemap(entries);
    const matches = xml.match(/ai\/intents\/skill-gaps\//g) ?? [];
    assert.equal(matches.length, 1, "each intent slug should appear exactly once");
  });
});

// ─── buildRobotsSuggested ─────────────────────────────────────────────────────

describe("buildRobotsSuggested", () => {
  it("includes User-agent: *", () => {
    const robots = buildRobotsSuggested(BASE_URL);
    assert.ok(robots.includes("User-agent: *"));
  });

  it("includes correct sitemap URL", () => {
    const robots = buildRobotsSuggested(BASE_URL);
    assert.ok(
      robots.includes("Sitemap: https://example.com/ai/sitemap.xml"),
      "should include sitemap URL with correct base"
    );
  });

  it("handles base URL with trailing slash", () => {
    const robots = buildRobotsSuggested("https://example.com/");
    assert.ok(
      robots.includes("Sitemap: https://example.com/ai/sitemap.xml"),
      "should strip trailing slash from base URL"
    );
  });

  it("includes all AgentRanks Allow directives", () => {
    const robots = buildRobotsSuggested(BASE_URL);
    const expectedAllows = [
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
    ];
    for (const allow of expectedAllows) {
      assert.ok(robots.includes(allow), `should include "${allow}"`);
    }
  });
});

// ─── buildDeployReport ────────────────────────────────────────────────────────

describe("buildDeployReport", () => {
  const sampleResult = {
    deployedAt: "2026-06-01T00:00:00.000Z",
    baseUrl: BASE_URL,
    target: "/tmp/agentranks-public",
    sitemapUrl: "https://example.com/ai/sitemap.xml",
    deployedFiles: ["/tmp/agentranks-public/llms.txt"],
    publicUrls: ["https://example.com/llms.txt", "https://example.com/ai-profile/"],
    warnings: ["schema.json not found"],
    publishingModes: ["public_indexable"],
  };

  it("includes sitemap URL", () => {
    const report = buildDeployReport(sampleResult);
    assert.ok(report.includes("https://example.com/ai/sitemap.xml"));
  });

  it("includes deployed at timestamp", () => {
    const report = buildDeployReport(sampleResult);
    assert.ok(report.includes("2026-06-01T00:00:00.000Z"));
  });

  it("includes next-step instructions", () => {
    const report = buildDeployReport(sampleResult);
    assert.ok(report.includes("Next Steps"), "should have Next Steps section");
    assert.ok(
      report.includes("Google Search Console"),
      "should mention Google Search Console"
    );
    assert.ok(
      report.includes("Indexing is not instant") || report.includes("indexing is not instant"),
      "should note indexing is not instant"
    );
    assert.ok(
      report.includes("same content") || report.includes("honest documents"),
      "should note humans and crawlers see the same content"
    );
  });

  it("includes warnings when present", () => {
    const report = buildDeployReport(sampleResult);
    assert.ok(report.includes("schema.json not found"));
    assert.ok(report.includes("Warnings"));
  });

  it("includes public URLs", () => {
    const report = buildDeployReport(sampleResult);
    assert.ok(report.includes("https://example.com/ai-profile/"));
  });
});

// ─── runDeploy — integration tests ───────────────────────────────────────────

describe("runDeploy — full integration", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = makeTmpDir();
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes all expected core output files", async () => {
    const sub = path.join(tmpDir, "full");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });

    // Direct copies
    assert.ok(fs.existsSync(path.join(targetDir, "llms.txt")), "llms.txt");
    assert.ok(fs.existsSync(path.join(targetDir, "agentranks.json")), "agentranks.json");
    assert.ok(fs.existsSync(path.join(targetDir, "schema.json")), "schema.json");

    // Core Markdown → HTML
    const corePages = [
      "ai-profile", "services", "products", "pricing",
      "faqs", "policies", "use-cases", "differentiators",
    ];
    for (const page of corePages) {
      const htmlPath = path.join(targetDir, page, "index.html");
      assert.ok(fs.existsSync(htmlPath), `${page}/index.html should exist`);
    }

    // Intent pages
    assert.ok(
      fs.existsSync(path.join(targetDir, "ai", "intents", "index.html")),
      "ai/intents/index.html"
    );
    assert.ok(
      fs.existsSync(path.join(targetDir, "ai", "intents", "prompts", "index.html")),
      "ai/intents/prompts/index.html"
    );
    assert.ok(
      fs.existsSync(path.join(targetDir, "ai", "intents", "skill-gaps", "index.html")),
      "ai/intents/skill-gaps/index.html"
    );

    // Sitemap
    assert.ok(
      fs.existsSync(path.join(targetDir, "ai", "sitemap.xml")),
      "ai/sitemap.xml"
    );

    // .agentranks/deploy/ artifacts
    assert.ok(
      fs.existsSync(path.join(configDir, "deploy", "submit-urls.txt")),
      "deploy/submit-urls.txt"
    );
    assert.ok(
      fs.existsSync(path.join(configDir, "deploy", "robots-suggested.txt")),
      "deploy/robots-suggested.txt"
    );
    assert.ok(
      fs.existsSync(path.join(configDir, "deploy", "deploy-report.md")),
      "deploy/deploy-report.md"
    );
    assert.ok(
      fs.existsSync(path.join(configDir, "deploy", "deploy.json")),
      "deploy/deploy.json"
    );
  });

  it("direct copies produce identical content for llms.txt, agentranks.json, schema.json", async () => {
    const sub = path.join(tmpDir, "copies");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });

    const srcLlms = fs.readFileSync(path.join(inputDir, "llms.txt"), "utf-8");
    const destLlms = fs.readFileSync(path.join(targetDir, "llms.txt"), "utf-8");
    assert.equal(srcLlms, destLlms, "llms.txt content should match");

    const srcJson = fs.readFileSync(path.join(inputDir, "agentranks.json"), "utf-8");
    const destJson = fs.readFileSync(path.join(targetDir, "agentranks.json"), "utf-8");
    assert.equal(srcJson, destJson, "agentranks.json content should match");

    const srcSchema = fs.readFileSync(path.join(inputDir, "schema.json"), "utf-8");
    const destSchema = fs.readFileSync(path.join(targetDir, "schema.json"), "utf-8");
    assert.equal(srcSchema, destSchema, "schema.json content should match");
  });

  it("converts all core Markdown files to HTML pages", async () => {
    const sub = path.join(tmpDir, "md-conversion");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });

    const corePages = [
      "ai-profile", "services", "products", "pricing",
      "faqs", "policies", "use-cases", "differentiators",
    ];
    for (const page of corePages) {
      const html = fs.readFileSync(
        path.join(targetDir, page, "index.html"),
        "utf-8"
      );
      assert.ok(html.includes("<!DOCTYPE html>"), `${page}: should be HTML document`);
      assert.ok(html.includes("<h1>"), `${page}: should contain H1`);
      assert.ok(html.includes("<body>"), `${page}: should contain body`);
    }
  });

  it("converts intent Markdown files to HTML pages", async () => {
    const sub = path.join(tmpDir, "intent-conversion");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });

    const intentHtml = fs.readFileSync(
      path.join(targetDir, "ai", "intents", "skill-gaps", "index.html"),
      "utf-8"
    );
    assert.ok(intentHtml.includes("<!DOCTYPE html>"));
    assert.ok(intentHtml.includes("Acme") || intentHtml.includes("Skill Gaps"));
  });

  it("dry-run writes no files", async () => {
    const sub = path.join(tmpDir, "dry-run");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    const result = await runDeploy({
      inputDir,
      targetDir,
      baseUrl: BASE_URL,
      configDir,
      dryRun: true,
    });

    assert.ok(result.deployedFiles.length > 0, "dry-run should report planned files");
    assert.ok(
      !fs.existsSync(path.join(targetDir, "llms.txt")),
      "dry-run should not write llms.txt"
    );
    assert.ok(
      !fs.existsSync(path.join(targetDir, "ai-profile", "index.html")),
      "dry-run should not write HTML files"
    );
    assert.ok(
      !fs.existsSync(path.join(configDir, "deploy", "deploy.json")),
      "dry-run should not write deploy.json"
    );
  });

  it("sitemap contains correct trailing-slash URLs", async () => {
    const sub = path.join(tmpDir, "sitemap");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });

    const sitemap = fs.readFileSync(
      path.join(targetDir, "ai", "sitemap.xml"),
      "utf-8"
    );

    const expectedPaths = [
      "/ai-profile/",
      "/services/",
      "/products/",
      "/pricing/",
      "/faqs/",
      "/policies/",
      "/use-cases/",
      "/differentiators/",
      "/ai/intents/",
      "/ai/intents/prompts/",
      "/ai/intents/skill-gaps/",
    ];
    for (const urlPath of expectedPaths) {
      assert.ok(
        sitemap.includes(`${BASE_URL}${urlPath}`),
        `sitemap should include ${urlPath}`
      );
    }
  });

  it("canonical URL in HTML matches sitemap URL", async () => {
    const sub = path.join(tmpDir, "canonical");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });

    const html = fs.readFileSync(
      path.join(targetDir, "ai-profile", "index.html"),
      "utf-8"
    );
    const sitemap = fs.readFileSync(
      path.join(targetDir, "ai", "sitemap.xml"),
      "utf-8"
    );

    const canonicalMatch = html.match(/href="([^"]+)"/);
    const canonicalUrl = canonicalMatch?.[1];
    assert.ok(canonicalUrl, "should have canonical href");
    assert.ok(
      sitemap.includes(canonicalUrl),
      `canonical URL ${canonicalUrl} should appear in sitemap`
    );
  });

  it("each intent slug appears exactly once in sitemap", async () => {
    const sub = path.join(tmpDir, "slug-once");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });

    const sitemap = fs.readFileSync(
      path.join(targetDir, "ai", "sitemap.xml"),
      "utf-8"
    );
    const matches = sitemap.match(/ai\/intents\/skill-gaps\//g) ?? [];
    assert.equal(matches.length, 1, "skill-gaps should appear exactly once in sitemap");
  });

  it("each public URL appears exactly once in submit-urls.txt", async () => {
    const sub = path.join(tmpDir, "submit-urls");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    const result = await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });
    const submitUrls = fs.readFileSync(
      path.join(configDir, "deploy", "submit-urls.txt"),
      "utf-8"
    );

    const lines = submitUrls.split("\n").filter(Boolean);
    const unique = new Set(lines);
    assert.equal(lines.length, unique.size, "no duplicate URLs in submit-urls.txt");
    assert.equal(
      lines.length,
      result.publicUrls.length,
      "submit-urls.txt should contain every public URL"
    );
  });

  it("robots-suggested.txt contains correct sitemap URL", async () => {
    const sub = path.join(tmpDir, "robots");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });

    const robots = fs.readFileSync(
      path.join(configDir, "deploy", "robots-suggested.txt"),
      "utf-8"
    );
    assert.ok(
      robots.includes("Sitemap: https://example.com/ai/sitemap.xml"),
      "robots-suggested.txt should contain sitemap URL"
    );
  });

  it("public_indexable pages do NOT include noindex meta", async () => {
    const sub = path.join(tmpDir, "no-noindex");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });

    const html = fs.readFileSync(
      path.join(targetDir, "ai", "intents", "skill-gaps", "index.html"),
      "utf-8"
    );
    assert.ok(!html.includes("noindex"), "public_indexable pages should not include noindex");
    assert.ok(html.includes("index, follow"), "should have index, follow robots meta");
  });

  it("noindex meta included only for public_noindex pages when --include-noindex", async () => {
    const sub = path.join(tmpDir, "noindex");
    fs.mkdirSync(sub);
    const inputDir = buildFakeInputDir(sub, {
      intentsPublishingMode: "public_noindex",
      includeIntentBrief: true,
    });
    const targetDir = path.join(sub, "agentranks-public");
    const configDir = path.join(sub, ".agentranks");

    await runDeploy({
      inputDir,
      targetDir,
      baseUrl: BASE_URL,
      configDir,
      includeNoindex: true,
    });

    const html = fs.readFileSync(
      path.join(targetDir, "ai", "intents", "skill-gaps", "index.html"),
      "utf-8"
    );
    assert.ok(
      html.includes("noindex, follow"),
      "public_noindex page should have noindex meta when --include-noindex is used"
    );
  });

  it("public_noindex pages do NOT get noindex meta when --include-noindex is absent", async () => {
    const sub = path.join(tmpDir, "noindex-absent");
    fs.mkdirSync(sub);
    const inputDir = buildFakeInputDir(sub, {
      intentsPublishingMode: "public_noindex",
      includeIntentBrief: true,
    });
    const targetDir = path.join(sub, "agentranks-public");
    const configDir = path.join(sub, ".agentranks");

    await runDeploy({
      inputDir,
      targetDir,
      baseUrl: BASE_URL,
      configDir,
      includeNoindex: false,
    });

    const html = fs.readFileSync(
      path.join(targetDir, "ai", "intents", "skill-gaps", "index.html"),
      "utf-8"
    );
    assert.ok(
      !html.includes("noindex"),
      "public_noindex page should NOT have noindex when --include-noindex is not used"
    );
  });

  it("blocks private_export briefs without --force", async () => {
    const sub = path.join(tmpDir, "block-private");
    fs.mkdirSync(sub);
    const inputDir = buildFakeInputDir(sub, {
      intentsPublishingMode: "private_export",
      includeIntentBrief: true,
    });
    const targetDir = path.join(sub, "agentranks-public");
    const configDir = path.join(sub, ".agentranks");

    await assert.rejects(
      () => runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir }),
      (err: Error) => {
        assert.ok(err.message.includes("private_export"), "error should mention private_export");
        assert.ok(
          err.message.includes("--force") || err.message.includes("force"),
          "error should mention --force option"
        );
        assert.ok(
          err.message.includes("agentranks intents"),
          "error should suggest rerunning intents"
        );
        return true;
      }
    );
  });

  it("allows private_export briefs with --force", async () => {
    const sub = path.join(tmpDir, "force-private");
    fs.mkdirSync(sub);
    const inputDir = buildFakeInputDir(sub, {
      intentsPublishingMode: "private_export",
      includeIntentBrief: true,
    });
    const targetDir = path.join(sub, "agentranks-public");
    const configDir = path.join(sub, ".agentranks");

    const result = await runDeploy({
      inputDir,
      targetDir,
      baseUrl: BASE_URL,
      configDir,
      force: true,
    });

    assert.ok(result.deployedFiles.length > 0, "should deploy files with --force");
    assert.ok(
      fs.existsSync(path.join(targetDir, "ai", "intents", "skill-gaps", "index.html")),
      "intent brief should be deployed with --force"
    );
  });

  it("--clean only removes AgentRanks-generated paths, not unrelated files", async () => {
    const sub = path.join(tmpDir, "clean");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    // Pre-create a non-AgentRanks file in targetDir
    fs.mkdirSync(targetDir, { recursive: true });
    const unrelatedFile = path.join(targetDir, "index.html");
    fs.writeFileSync(unrelatedFile, "<html>My app</html>", "utf-8");

    // Pre-populate an AgentRanks-generated path
    const prevAiProfile = path.join(targetDir, "ai-profile", "index.html");
    fs.mkdirSync(path.dirname(prevAiProfile), { recursive: true });
    fs.writeFileSync(prevAiProfile, "<html>old</html>", "utf-8");

    await runDeploy({
      inputDir,
      targetDir,
      baseUrl: BASE_URL,
      configDir,
      clean: true,
    });

    // Unrelated file should survive
    assert.ok(
      fs.existsSync(unrelatedFile),
      "unrelated index.html should not be removed by --clean"
    );

    // AgentRanks-generated file should be freshly written
    const newAiProfile = fs.readFileSync(prevAiProfile, "utf-8");
    assert.ok(
      newAiProfile.includes("<!DOCTYPE html>"),
      "ai-profile/index.html should be regenerated after --clean"
    );
    assert.ok(
      !newAiProfile.includes("<html>old</html>"),
      "old content should be replaced after --clean"
    );
  });

  it("schema.json is inlined in ai-profile/index.html", async () => {
    const sub = path.join(tmpDir, "schema-inline");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });

    const html = fs.readFileSync(
      path.join(targetDir, "ai-profile", "index.html"),
      "utf-8"
    );
    assert.ok(
      html.includes('type="application/ld+json"'),
      "ai-profile should have JSON-LD script tag"
    );
    assert.ok(
      html.includes("https://schema.org"),
      "ai-profile should include schema.org context"
    );
  });

  it("schema.json is inlined in services/index.html", async () => {
    const sub = path.join(tmpDir, "schema-services");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });

    const html = fs.readFileSync(
      path.join(targetDir, "services", "index.html"),
      "utf-8"
    );
    assert.ok(html.includes('type="application/ld+json"'));
  });

  it("schema.json is inlined in pricing/index.html", async () => {
    const sub = path.join(tmpDir, "schema-pricing");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });

    const html = fs.readFileSync(
      path.join(targetDir, "pricing", "index.html"),
      "utf-8"
    );
    assert.ok(html.includes('type="application/ld+json"'));
  });

  it("schema.json is inlined in faqs/index.html", async () => {
    const sub = path.join(tmpDir, "schema-faqs");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });

    const html = fs.readFileSync(
      path.join(targetDir, "faqs", "index.html"),
      "utf-8"
    );
    assert.ok(html.includes('type="application/ld+json"'));
  });

  it("schema.json is NOT inlined in products/index.html", async () => {
    const sub = path.join(tmpDir, "schema-not-products");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });

    const html = fs.readFileSync(
      path.join(targetDir, "products", "index.html"),
      "utf-8"
    );
    assert.ok(
      !html.includes('type="application/ld+json"'),
      "products page should NOT have inline JSON-LD"
    );
  });

  it("warn when schema.json is missing, but continue deploy", async () => {
    const sub = path.join(tmpDir, "no-schema");
    fs.mkdirSync(sub);
    const inputDir = buildFakeInputDir(sub, { skipSchemaJson: true, includeIntentBrief: true });
    const targetDir = path.join(sub, "agentranks-public");
    const configDir = path.join(sub, ".agentranks");

    const result = await runDeploy({
      inputDir,
      targetDir,
      baseUrl: BASE_URL,
      configDir,
    });

    assert.ok(result.warnings.some((w) => w.includes("schema.json")), "should warn about missing schema.json");
    assert.ok(
      fs.existsSync(path.join(targetDir, "ai-profile", "index.html")),
      "deploy should still produce HTML even without schema.json"
    );
  });

  it("deploy-report.md contains sitemap URL and next-step instructions", async () => {
    const sub = path.join(tmpDir, "report-check");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });

    const report = fs.readFileSync(
      path.join(configDir, "deploy", "deploy-report.md"),
      "utf-8"
    );
    assert.ok(report.includes("https://example.com/ai/sitemap.xml"), "report should include sitemap URL");
    assert.ok(report.includes("Next Steps") || report.includes("next step"), "report should include next steps");
    assert.ok(
      report.includes("Google Search Console"),
      "report should mention Google Search Console"
    );
  });

  it("deploy.json manifest contains correct URL list", async () => {
    const sub = path.join(tmpDir, "manifest");
    fs.mkdirSync(sub);
    const { inputDir, targetDir, configDir } = buildDeployDirs(sub);

    await runDeploy({ inputDir, targetDir, baseUrl: BASE_URL, configDir });

    const manifest = JSON.parse(
      fs.readFileSync(path.join(configDir, "deploy", "deploy.json"), "utf-8")
    );

    assert.ok(typeof manifest.deployedAt === "string", "deployedAt should be string");
    assert.equal(manifest.baseUrl, BASE_URL, "baseUrl should match");
    assert.ok(typeof manifest.sitemapUrl === "string", "sitemapUrl should be present");
    assert.ok(Array.isArray(manifest.deployedFiles), "deployedFiles should be array");
    assert.ok(Array.isArray(manifest.publicUrls), "publicUrls should be array");
    assert.ok(Array.isArray(manifest.warnings), "warnings should be array");
    assert.ok(Array.isArray(manifest.publishingModes), "publishingModes should be array");

    // All expected page URLs present
    assert.ok(
      manifest.publicUrls.includes("https://example.com/ai-profile/"),
      "publicUrls should include ai-profile"
    );
    assert.ok(
      manifest.publicUrls.includes("https://example.com/ai/intents/skill-gaps/"),
      "publicUrls should include intent slug URL"
    );
  });

  it("AGENTRANKS_GENERATED_PATHS covers all deployed top-level paths", () => {
    const expected = [
      "llms.txt", "agentranks.json", "schema.json",
      "ai-profile", "services", "products", "pricing",
      "faqs", "policies", "use-cases", "differentiators", "ai",
    ];
    for (const p of expected) {
      assert.ok(
        AGENTRANKS_GENERATED_PATHS.includes(p),
        `AGENTRANKS_GENERATED_PATHS should include "${p}"`
      );
    }
  });
});
