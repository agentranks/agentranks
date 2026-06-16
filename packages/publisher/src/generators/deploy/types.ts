// ─── Deploy types ─────────────────────────────────────────────────────────────

export interface DeployOptions {
  /** Absolute path to agentranks-output/ directory. */
  inputDir: string;
  /** Absolute path to the deploy target directory (e.g. agentranks-public/). */
  targetDir: string;
  /** Canonical base URL for the deployed site (e.g. https://example.com). */
  baseUrl: string;
  /** Absolute path to .agentranks/ config directory (for deploy/ sub-folder). */
  configDir: string;
  /** Add noindex meta for public_noindex pages. Default false. */
  includeNoindex?: boolean;
  /** Print planned output without writing files. Default false. */
  dryRun?: boolean;
  /** Remove previously generated AgentRanks paths before writing. Default false. */
  clean?: boolean;
  /** Allow deploying private_export intent briefs. Default false. */
  force?: boolean;
}

export interface DeployResult {
  deployedAt: string;
  baseUrl: string;
  target: string;
  sitemapUrl: string;
  deployedFiles: string[];
  publicUrls: string[];
  warnings: string[];
  publishingModes: string[];
}

/** Shape of the intents.json file used during deploy. */
export interface IntentsJsonShape {
  briefs: Array<{ slug: string; publishingMode: string }>;
}
