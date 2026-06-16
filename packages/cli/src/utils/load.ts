import fs from "fs";
import { z, ZodSchema } from "zod";
import {
  getFactsPath,
  getPagesPath,
  BusinessFactSchema,
  PageSchema,
} from "@agentranks/core";
import type { BusinessFact, Page } from "@agentranks/core";

/**
 * Load and parse a JSON file, optionally validating it with a Zod schema.
 * Throws a readable Error — does not call process.exit.
 */
export function loadJsonFile<T>(filePath: string, schema?: ZodSchema<T>): T {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    throw new Error(`Cannot read file: ${filePath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in file: ${filePath}`);
  }

  if (schema) {
    const result = schema.safeParse(parsed);
    if (!result.success) {
      const first = result.error.errors[0];
      throw new Error(
        `File validation failed (${filePath}): ${first?.message ?? "unknown error"}`
      );
    }
    return result.data;
  }

  return parsed as T;
}

/**
 * Load and validate agentranks.facts.json for the given cwd.
 * Throws a readable Error if the file is missing or invalid.
 */
export function loadFacts(cwd: string): BusinessFact[] {
  const factsPath = getFactsPath(cwd);
  if (!fs.existsSync(factsPath)) {
    throw new Error(
      `No facts found at ${factsPath} — run agentranks extract first.`
    );
  }
  return loadJsonFile(factsPath, z.array(BusinessFactSchema));
}

/**
 * Load and validate agentranks.pages.json for the given cwd.
 * Throws a readable Error if the file is missing or invalid.
 */
export function loadPages(cwd: string): Page[] {
  const pagesPath = getPagesPath(cwd);
  if (!fs.existsSync(pagesPath)) {
    throw new Error(
      `No pages found at ${pagesPath} — run agentranks scan first.`
    );
  }
  return loadJsonFile(pagesPath, z.array(PageSchema));
}
