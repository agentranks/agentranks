import fs from "fs";
import path from "path";
import crypto from "node:crypto";
import chalk from "chalk";
import ora from "ora";
import { loadConfig, CONFIG_DIR, getDeployDir } from "@agentranks/core";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubmitOptions {
  /** Submit to IndexNow. */
  indexnow?: boolean;
  /** IndexNow API key (overrides key file). */
  key?: string;
  /** Path to file containing the IndexNow API key. */
  keyFile?: string;
  /** Override host (default: derived from baseUrl). */
  host?: string;
  /** Print payload without making network calls. */
  dryRun?: boolean;
  /** Override IndexNow endpoint (for testing). */
  endpoint?: string;
}

export interface IndexNowReport {
  submittedAt: string;
  endpoint: string;
  host: string;
  keyFile: string;
  urlCount: number;
  submitted: number;
  failed: number;
  status: number | null;
  statusText: string;
  dryRun: boolean;
  urls: string[];
}

const INDEXNOW_DEFAULT_ENDPOINT = "https://api.indexnow.org/IndexNow";
const SUBMIT_SUBDIR = "submit";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Read URLs from deploy.json (publicUrls) or fall back to submit-urls.txt. */
function loadUrls(deployDir: string): { urls: string[]; source: string } {
  const deployJsonPath = path.join(deployDir, "deploy.json");
  if (fs.existsSync(deployJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(deployJsonPath, "utf-8")) as {
        publicUrls?: string[];
      };
      if (Array.isArray(data.publicUrls) && data.publicUrls.length > 0) {
        return { urls: data.publicUrls, source: "deploy.json" };
      }
    } catch {
      // fall through to submit-urls.txt
    }
  }

  const submitUrlsPath = path.join(deployDir, "submit-urls.txt");
  if (fs.existsSync(submitUrlsPath)) {
    const urls = fs
      .readFileSync(submitUrlsPath, "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    return { urls, source: "submit-urls.txt" };
  }

  return { urls: [], source: "none" };
}

/** Extract hostname from a URL string. */
function extractHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Generate a random alphanumeric IndexNow key (32 hex chars). */
function generateKey(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** Resolve or generate the IndexNow key. Returns { key, keyPath, generated }. */
function resolveKey(
  opts: Pick<SubmitOptions, "key" | "keyFile">,
  submitDir: string
): { key: string; keyPath: string; generated: boolean } {
  if (opts.key) {
    const keyPath = path.join(submitDir, "indexnow-key.txt");
    return { key: opts.key, keyPath, generated: false };
  }

  if (opts.keyFile) {
    const absPath = path.resolve(opts.keyFile);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Key file not found: ${absPath}`);
    }
    const key = fs.readFileSync(absPath, "utf-8").trim();
    if (!key) throw new Error(`Key file is empty: ${absPath}`);
    return { key, keyPath: absPath, generated: false };
  }

  // Auto-generate a key
  const key = generateKey();
  const keyPath = path.join(submitDir, "indexnow-key.txt");
  return { key, keyPath, generated: true };
}

function buildIndexNowPayload(host: string, key: string, baseUrl: string, urls: string[]) {
  const normalized = baseUrl.replace(/\/$/, "");
  return {
    host,
    key,
    keyLocation: `${normalized}/${key}.txt`,
    urlList: urls,
  };
}

function buildReport(report: IndexNowReport): string {
  const lines: string[] = [];

  lines.push("# AgentRanks IndexNow Submit Report");
  lines.push("");
  lines.push(`**Submitted at:** ${report.submittedAt}`);
  lines.push(`**Dry run:** ${report.dryRun ? "Yes" : "No"}`);
  lines.push(`**Endpoint:** ${report.endpoint}`);
  lines.push(`**Host:** ${report.host}`);
  lines.push("");
  lines.push("## Results");
  lines.push("");
  lines.push(`- Total URLs: ${report.urlCount}`);
  lines.push(`- Submitted: ${report.submitted}`);
  lines.push(`- Failed: ${report.failed}`);
  if (report.status !== null) {
    lines.push(`- HTTP status: ${report.status} ${report.statusText}`);
  }
  lines.push("");
  lines.push("## Key Verification");
  lines.push("");
  lines.push(
    `Your IndexNow key file must be reachable at:\n` +
      `\`https://${report.host}/${report.keyFile}.txt\`\n\n` +
      `Upload the file \`.agentranks/submit/${report.keyFile}.txt\` ` +
      `(which contains just the key string) to that URL before submitting.`
  );
  lines.push("");
  lines.push("## URLs Submitted");
  lines.push("");
  for (const url of report.urls) {
    lines.push(`- ${url}`);
  }
  lines.push("");

  return lines.join("\n");
}

// ─── Main Command ─────────────────────────────────────────────────────────────

export async function runSubmit(
  opts: SubmitOptions = {},
  cwd: string = process.cwd()
): Promise<void> {
  console.log(chalk.bold.cyan("\n  AgentRanks Submit\n"));

  if (!opts.indexnow) {
    console.error(
      chalk.red(
        "  ✗ No submission method specified.\n" +
          "    Use --indexnow to submit URLs to IndexNow.\n"
      )
    );
    process.exit(1);
  }

  const config = loadConfig(cwd);
  const deployDir = getDeployDir(cwd);
  const submitDir = path.join(cwd, CONFIG_DIR, SUBMIT_SUBDIR);

  // ── Load URLs ──────────────────────────────────────────────────────────────

  const { urls, source } = loadUrls(deployDir);

  if (urls.length === 0) {
    console.error(
      chalk.red(
        "  ✗ No URLs found to submit.\n" +
          "    Run agentranks deploy first to generate deploy.json or submit-urls.txt.\n"
      )
    );
    process.exit(1);
  }

  console.log(chalk.white(`  URLs loaded from:  ${chalk.bold(source)} (${urls.length} URLs)`));

  // ── Determine host ─────────────────────────────────────────────────────────

  const baseUrl = config.baseUrl;
  const host = opts.host ?? extractHost(baseUrl);

  console.log(chalk.white(`  Host:             ${chalk.bold(host)}`));
  console.log(chalk.white(`  Base URL:         ${chalk.bold(baseUrl)}`));

  // ── Resolve key ────────────────────────────────────────────────────────────

  let keyInfo: { key: string; keyPath: string; generated: boolean };
  try {
    keyInfo = resolveKey(opts, submitDir);
  } catch (err) {
    console.error(chalk.red(`  ✗ Key error: ${(err as Error).message}\n`));
    process.exit(1);
  }

  const { key, generated } = keyInfo;
  const endpoint = opts.endpoint ?? INDEXNOW_DEFAULT_ENDPOINT;

  if (generated) {
    console.log(
      chalk.yellow(
        `\n  ⚠ No key provided — generated a new key: ${chalk.bold(key)}\n` +
          `    Key saved to: .agentranks/submit/indexnow-key.txt\n` +
          `    Key file to upload: .agentranks/submit/${key}.txt\n` +
          `    You must upload this file to: https://${host}/${key}.txt\n` +
          `    before IndexNow will accept submissions.\n`
      )
    );
  }

  console.log(chalk.white(`  Endpoint:         ${chalk.bold(endpoint)}`));

  if (opts.dryRun) {
    console.log(chalk.yellow("  ⚠ Dry run — no network calls will be made.\n"));
  }

  // ── Build payload ──────────────────────────────────────────────────────────

  const payload = buildIndexNowPayload(host, key, baseUrl, urls);

  if (opts.dryRun) {
    console.log(chalk.bold("  IndexNow payload that would be submitted:\n"));
    console.log(chalk.gray(JSON.stringify(payload, null, 2)));
    console.log("");
  }

  // ── Submit (unless dry-run) ────────────────────────────────────────────────

  const submittedAt = new Date().toISOString();
  let httpStatus: number | null = null;
  let httpStatusText = "";
  let submitted = 0;
  let failed = 0;

  if (!opts.dryRun) {
    const spinner = ora({
      text: `Submitting ${urls.length} URL(s) to IndexNow...`,
      color: "cyan",
    }).start();

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });

      httpStatus = response.status;
      httpStatusText = response.statusText;
      spinner.stop();

      if (response.status === 200 || response.status === 202) {
        submitted = urls.length;
        console.log(
          chalk.green(
            `  ✓ Submitted ${submitted} URL(s) — HTTP ${response.status} ${response.statusText}\n`
          )
        );
      } else {
        failed = urls.length;
        const body = await response.text().catch(() => "");
        console.log(
          chalk.red(
            `  ✗ Submission failed — HTTP ${response.status} ${response.statusText}\n` +
              (body ? `    Response: ${body.slice(0, 200)}\n` : "")
          )
        );
      }
    } catch (err) {
      spinner.stop();
      failed = urls.length;
      console.error(
        chalk.red(
          `  ✗ Network error during submission: ${(err as Error).message}\n` +
            "    Check your internet connection and the endpoint URL.\n"
        )
      );
    }
  }

  // ── Write key files and report ─────────────────────────────────────────────

  if (!opts.dryRun) {
    fs.mkdirSync(submitDir, { recursive: true });

    if (generated) {
      fs.writeFileSync(path.join(submitDir, "indexnow-key.txt"), key + "\n", "utf-8");
      // Key file that the user uploads to their site
      fs.writeFileSync(path.join(submitDir, `${key}.txt`), key + "\n", "utf-8");
    }

    const report: IndexNowReport = {
      submittedAt,
      endpoint,
      host,
      keyFile: key,
      urlCount: urls.length,
      submitted,
      failed,
      status: httpStatus,
      statusText: httpStatusText,
      dryRun: false,
      urls,
    };

    const reportJsonPath = path.join(submitDir, "indexnow-report.json");
    const reportMdPath = path.join(submitDir, "indexnow-report.md");
    fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2) + "\n", "utf-8");
    fs.writeFileSync(reportMdPath, buildReport(report), "utf-8");

    console.log(
      chalk.gray(`  Report: .agentranks/submit/indexnow-report.md\n`)
    );
  }

  if (generated && !opts.dryRun) {
    console.log(chalk.white("  Next steps:"));
    console.log(
      chalk.gray(
        `    1. Upload .agentranks/submit/${key}.txt to https://${host}/${key}.txt`
      )
    );
    console.log(
      chalk.gray(
        "    2. Rerun agentranks submit --indexnow --key " + key + " to verify acceptance"
      )
    );
    console.log("");
  }
}
