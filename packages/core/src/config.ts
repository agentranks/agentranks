import fs from "fs";
import path from "path";
import { AgentRanksConfig, AgentRanksConfigSchema } from "./schemas.js";

export const CONFIG_DIR = ".agentranks";
export const CONFIG_FILE = "config.json";
export const PAGES_FILE = "pages.json";
export const FACTS_FILE = "agentranks.facts.json";
export const CONTENT_GAPS_FILE = "content-gaps.json";
export const REVIEW_JSON_FILE = "review.json";
export const REVIEW_MD_FILE = "review.md";
export const SCORE_JSON_FILE = "score.json";
export const SCORE_MD_FILE = "score.md";

// ─── Output directory constants ───────────────────────────────────────────────

/** Default output directory (relative to cwd) produced by `agentranks generate`. */
export const OUTPUT_DIR_DEFAULT = "agentranks-output";
/** Default deploy target directory (relative to cwd) produced by `agentranks deploy`. */
export const DEPLOY_TARGET_DEFAULT = "agentranks-public";
/** Sub-directory within output dir that holds intent briefs. */
export const INTENTS_SUBDIR = "intents";
/** Sub-directory within CONFIG_DIR that holds deploy artifacts. */
export const DEPLOY_SUBDIR = "deploy";

export function getConfigPath(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_DIR, CONFIG_FILE);
}

export function getPagesPath(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_DIR, PAGES_FILE);
}

export function getFactsPath(cwd: string = process.cwd()): string {
  return path.join(cwd, FACTS_FILE);
}

export function getContentGapsPath(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_DIR, CONTENT_GAPS_FILE);
}

export function getReviewJsonPath(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_DIR, REVIEW_JSON_FILE);
}

export function getReviewMdPath(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_DIR, REVIEW_MD_FILE);
}

export function getScoreJsonPath(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_DIR, SCORE_JSON_FILE);
}

export function getScoreMdPath(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_DIR, SCORE_MD_FILE);
}

// ─── Output / deploy path helpers ────────────────────────────────────────────

/**
 * Resolve the agentranks-output directory.
 * Prefers an explicit override, then `config.output.dir`, then `OUTPUT_DIR_DEFAULT`.
 */
export function getOutputDir(
  cwd: string,
  config?: { output?: { dir?: string } },
  override?: string
): string {
  return path.join(cwd, override ?? config?.output?.dir ?? OUTPUT_DIR_DEFAULT);
}

/** Resolve the intents sub-directory inside an output directory. */
export function getIntentsDir(outputDir: string): string {
  return path.join(outputDir, INTENTS_SUBDIR);
}

/** Resolve `.agentranks/deploy/` — the folder for deploy artifacts. */
export function getDeployDir(cwd: string): string {
  return path.join(cwd, CONFIG_DIR, DEPLOY_SUBDIR);
}

/**
 * Resolve the deploy target directory.
 * Prefers an explicit override, then `DEPLOY_TARGET_DEFAULT`.
 */
export function getDeployTargetDir(cwd: string, override?: string): string {
  return path.join(cwd, override ?? DEPLOY_TARGET_DEFAULT);
}

export function loadConfig(cwd: string = process.cwd()): AgentRanksConfig {
  const configPath = getConfigPath(cwd);

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `No AgentRanks config found at ${configPath}.\n` +
        `Run "agentranks init" to create one.`
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (err) {
    throw new Error(
      `Failed to parse config file at ${configPath}: ${(err as Error).message}`
    );
  }

  const result = AgentRanksConfigSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.errors
      .map((e) => `  ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid config at ${configPath}:\n${messages}`);
  }

  return result.data;
}

export function saveConfig(
  config: AgentRanksConfig,
  cwd: string = process.cwd()
): void {
  const configDir = path.join(cwd, CONFIG_DIR);
  fs.mkdirSync(configDir, { recursive: true });

  const configPath = getConfigPath(cwd);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function configExists(cwd: string = process.cwd()): boolean {
  return fs.existsSync(getConfigPath(cwd));
}

export function resolveLLMConfig(config: AgentRanksConfig): {
  baseUrl: string;
  model: string;
  apiKey: string;
  maxTokens: number | undefined;
  temperature: number;
} {
  const envMaxTokens = process.env.AGENTRANKS_LLM_MAX_TOKENS
    ? parseInt(process.env.AGENTRANKS_LLM_MAX_TOKENS, 10) || undefined
    : undefined;

  return {
    baseUrl:
      config.llm?.baseUrl ??
      process.env.AGENTRANKS_LLM_BASE_URL ??
      "https://api.deepseek.com/v1",
    model:
      config.llm?.model ??
      process.env.AGENTRANKS_LLM_MODEL ??
      "deepseek-v4-pro",
    apiKey:
      config.llm?.apiKey ?? process.env.AGENTRANKS_LLM_API_KEY ?? "",
    maxTokens: config.llm?.maxTokens ?? envMaxTokens,
    temperature: config.llm?.temperature ?? 0.2,
  };
}
