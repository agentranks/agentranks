import fs from "fs";
import path from "path";
import { DEPLOY_SUBDIR } from "@agentranks/core";
import { DeployOptions, DeployResult, IntentsJsonShape } from "./types.js";
import { AGENTRANKS_GENERATED_PATHS, CORE_MD_PAGES, DIRECT_COPY_FILES } from "./paths.js";
import { extractTitle, mdToHtml, buildHtml } from "./markdown-html.js";
import { buildSitemap } from "./sitemap.js";
import { buildRobotsSuggested } from "./robots.js";
import { buildDeployReport } from "./report.js";

export type { DeployOptions, DeployResult } from "./types.js";
export { AGENTRANKS_GENERATED_PATHS } from "./paths.js";
export { buildHtml, extractTitle, mdToHtml } from "./markdown-html.js";
export { buildSitemap } from "./sitemap.js";
export { buildRobotsSuggested } from "./robots.js";
export { buildDeployReport } from "./report.js";

/**
 * Run the full AgentRanks deploy pipeline.
 *
 * Reads from `inputDir` (agentranks-output/), converts Markdown to HTML,
 * copies static files, generates sitemap + robots suggestion + submit-urls,
 * and writes everything to `targetDir` (agentranks-public/).
 *
 * Does NOT call an LLM, does NOT submit to Google, does NOT modify the user's
 * existing robots.txt or sitemap.xml.
 */
export async function runDeploy(opts: DeployOptions): Promise<DeployResult> {
  const {
    inputDir, targetDir, baseUrl, configDir,
    includeNoindex = false, dryRun = false, clean = false, force = false,
  } = opts;

  const deployedAt = new Date().toISOString();
  const warnings: string[] = [];
  const deployedFiles: string[] = [];
  const publicUrls: string[] = [];
  const publishingModes = new Set<string>();
  const normalizedBase = baseUrl.replace(/\/$/, "");

  // ── Load intents.json ───────────────────────────────────────────────────────

  const intentsJsonPath = path.join(inputDir, "intents", "intents.json");
  let intentsOutput: IntentsJsonShape | null = null;

  if (fs.existsSync(intentsJsonPath)) {
    try {
      intentsOutput = JSON.parse(fs.readFileSync(intentsJsonPath, "utf-8")) as IntentsJsonShape;
    } catch {
      warnings.push("Could not parse intents/intents.json — intent pages will be skipped.");
    }
  }

  // ── Block private_export unless --force ────────────────────────────────────

  if (intentsOutput) {
    const privateExportBriefs = intentsOutput.briefs.filter(
      (b) => b.publishingMode === "private_export"
    );
    if (privateExportBriefs.length > 0 && !force) {
      throw new Error(
        `${privateExportBriefs.length} intent brief(s) have publishingMode "private_export" and cannot be deployed.\n\n` +
          `Options:\n` +
          `  1. Rerun: agentranks intents --publishing-mode public_indexable\n` +
          `  2. Deploy with --force to include private_export briefs anyway`
      );
    }
  }

  // ── Load schema.json ────────────────────────────────────────────────────────

  const schemaJsonPath = path.join(inputDir, "schema.json");
  let schemaJsonLd: string | undefined;

  if (fs.existsSync(schemaJsonPath)) {
    try {
      const raw = fs.readFileSync(schemaJsonPath, "utf-8");
      JSON.parse(raw);
      schemaJsonLd = raw.trim();
    } catch {
      warnings.push("schema.json is invalid JSON — schema.org JSON-LD will not be inlined.");
    }
  } else {
    warnings.push("schema.json not found in input directory — run agentranks generate first.");
  }

  // ── Clean: only remove AgentRanks-generated paths ───────────────────────────

  if (clean && !dryRun) {
    for (const relPath of AGENTRANKS_GENERATED_PATHS) {
      const fullPath = path.join(targetDir, relPath);
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    }
  }

  // ── File write helpers ─────────────────────────────────────────────────────

  function writeFile(filePath: string, content: string): void {
    if (!dryRun) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, "utf-8");
    }
    deployedFiles.push(filePath);
  }

  function copyFileSafe(srcPath: string, destPath: string): void {
    if (!dryRun) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
    deployedFiles.push(destPath);
  }

  // ── Direct copies ──────────────────────────────────────────────────────────

  for (const filename of DIRECT_COPY_FILES) {
    const srcPath = path.join(inputDir, filename);
    if (fs.existsSync(srcPath)) {
      copyFileSafe(srcPath, path.join(targetDir, filename));
      publicUrls.push(`${normalizedBase}/${filename}`);
    } else {
      warnings.push(`${filename} not found in input directory — run agentranks generate first.`);
    }
  }

  // ── Core Markdown pages ────────────────────────────────────────────────────

  for (const page of CORE_MD_PAGES) {
    const srcPath = path.join(inputDir, page.file);
    if (!fs.existsSync(srcPath)) {
      warnings.push(`${page.file} not found in input directory — skipping.`);
      continue;
    }

    const markdown = fs.readFileSync(srcPath, "utf-8");
    const canonicalUrl = `${normalizedBase}/${page.urlPath}`;
    publishingModes.add("public_indexable");

    const html = buildHtml({
      title: extractTitle(markdown),
      canonicalUrl,
      robotsContent: "index, follow",
      bodyHtml: mdToHtml(markdown),
      schemaJsonLd: page.inlineSchema ? schemaJsonLd : undefined,
      deployedAt,
    });

    writeFile(path.join(targetDir, page.urlPath, "index.html"), html);
    publicUrls.push(canonicalUrl);
  }

  // ── Intent index page ──────────────────────────────────────────────────────

  const intentsDir = path.join(inputDir, "intents");
  const intentsIndexMdPath = path.join(intentsDir, "index.md");

  if (fs.existsSync(intentsIndexMdPath)) {
    const markdown = fs.readFileSync(intentsIndexMdPath, "utf-8");
    const canonicalUrl = `${normalizedBase}/ai/intents/`;
    publishingModes.add("public_indexable");

    const html = buildHtml({
      title: extractTitle(markdown),
      canonicalUrl,
      robotsContent: "index, follow",
      bodyHtml: mdToHtml(markdown),
      deployedAt,
    });

    writeFile(path.join(targetDir, "ai", "intents", "index.html"), html);
    publicUrls.push(canonicalUrl);
  } else {
    warnings.push("intents/index.md not found — run agentranks intents first.");
  }

  // ── Intent prompts page ────────────────────────────────────────────────────

  const promptsMdPath = path.join(intentsDir, "prompts.md");

  if (fs.existsSync(promptsMdPath)) {
    const markdown = fs.readFileSync(promptsMdPath, "utf-8");
    const canonicalUrl = `${normalizedBase}/ai/intents/prompts/`;
    publishingModes.add("public_indexable");

    const html = buildHtml({
      title: extractTitle(markdown),
      canonicalUrl,
      robotsContent: "index, follow",
      bodyHtml: mdToHtml(markdown),
      deployedAt,
    });

    writeFile(path.join(targetDir, "ai", "intents", "prompts", "index.html"), html);
    publicUrls.push(canonicalUrl);
  }

  // ── Individual intent briefs ───────────────────────────────────────────────

  if (intentsOutput) {
    for (const brief of intentsOutput.briefs) {
      const briefMdPath = path.join(intentsDir, `${brief.slug}.md`);

      if (!fs.existsSync(briefMdPath)) {
        warnings.push(`Intent brief file "${brief.slug}.md" not found — skipping.`);
        continue;
      }

      const markdown = fs.readFileSync(briefMdPath, "utf-8");
      const canonicalUrl = `${normalizedBase}/ai/intents/${brief.slug}/`;
      publishingModes.add(brief.publishingMode);

      const robotsContent =
        brief.publishingMode === "public_noindex" && includeNoindex
          ? "noindex, follow"
          : "index, follow";

      const html = buildHtml({
        title: extractTitle(markdown),
        canonicalUrl,
        robotsContent,
        bodyHtml: mdToHtml(markdown),
        deployedAt,
      });

      writeFile(path.join(targetDir, "ai", "intents", brief.slug, "index.html"), html);
      publicUrls.push(canonicalUrl);
    }
  }

  // ── Sitemap ────────────────────────────────────────────────────────────────

  const lastmod = deployedAt.slice(0, 10);
  const sitemapXml = buildSitemap(publicUrls.map((url) => ({ url, lastmod })));
  writeFile(path.join(targetDir, "ai", "sitemap.xml"), sitemapXml);
  const sitemapUrl = `${normalizedBase}/ai/sitemap.xml`;

  // ── .agentranks/deploy/ artifacts ──────────────────────────────────────────

  const deployDir = path.join(configDir, DEPLOY_SUBDIR);
  const publishingModesArr = Array.from(publishingModes);

  writeFile(path.join(deployDir, "submit-urls.txt"), publicUrls.join("\n") + "\n");
  writeFile(path.join(deployDir, "robots-suggested.txt"), buildRobotsSuggested(baseUrl));

  const deployResult: DeployResult = {
    deployedAt,
    baseUrl,
    target: targetDir,
    sitemapUrl,
    deployedFiles,
    publicUrls,
    warnings,
    publishingModes: publishingModesArr,
  };

  writeFile(
    path.join(deployDir, "deploy.json"),
    JSON.stringify(deployResult, null, 2) + "\n"
  );

  writeFile(path.join(deployDir, "deploy-report.md"), buildDeployReport(deployResult));

  return deployResult;
}
