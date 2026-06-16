import { Page, BusinessFact, ExtractionResult, RawFactSchema } from "@agentranks/core";
import { chatCompletion, LLMClientError } from "../client.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompts.js";
import { postProcessFacts, enrichFact } from "./postprocess.js";

export interface ExtractorConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  onProgress?: (current: number, total: number, url: string) => void;
}

export async function extractFactsFromPage(
  page: Page,
  config: ExtractorConfig
): Promise<ExtractionResult> {
  const now = new Date().toISOString();

  const userPrompt = buildUserPrompt({
    url: page.url,
    title: page.title,
    text: page.text,
  });

  let rawContent: string;
  let model: string;

  try {
    const result = await chatCompletion({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: config.temperature ?? 0.2,
      responseFormat: { type: "json_object" },
      disableThinking: true,
    });

    rawContent = result.content;
    model = result.model;
  } catch (err) {
    const message = err instanceof LLMClientError
      ? err.message
      : `Unexpected error: ${(err as Error).message}`;

    return {
      sourceUrl: page.url,
      facts: [],
      contentGaps: [],
      extractedAt: now,
      model: config.model,
      pageTitle: page.title,
      error: message,
    };
  }

  let parsed: unknown;
  try {
    const jsonStr = rawContent
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    return {
      sourceUrl: page.url,
      facts: [],
      contentGaps: [],
      extractedAt: now,
      model,
      pageTitle: page.title,
      error: `LLM returned invalid JSON: ${rawContent.slice(0, 200)}`,
    };
  }

  const container = (parsed as { facts?: unknown })?.facts;
  if (!Array.isArray(container)) {
    return {
      sourceUrl: page.url,
      facts: [],
      contentGaps: [],
      extractedAt: now,
      model,
      pageTitle: page.title,
      error: `LLM response missing "facts" array. Got: ${rawContent.slice(0, 300)}`,
    };
  }

  const validRawFacts = container
    .map((item) => RawFactSchema.safeParse(item))
    .filter((r) => r.success)
    .map((r) => r.data!);

  const { facts: processedFacts, contentGaps } = postProcessFacts(validRawFacts, page.url);
  const facts: BusinessFact[] = processedFacts.map((raw) => enrichFact(raw, page.url, now));

  return {
    sourceUrl: page.url,
    facts,
    contentGaps,
    extractedAt: now,
    model,
    pageTitle: page.title,
  };
}

export async function extractFactsFromPages(
  pages: Page[],
  config: ExtractorConfig
): Promise<ExtractionResult[]> {
  const results: ExtractionResult[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    config.onProgress?.(i + 1, pages.length, page.url);
    results.push(await extractFactsFromPage(page, config));
  }

  return results;
}
