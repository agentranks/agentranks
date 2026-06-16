export { chatCompletion, LLMClientError } from "./client.js";
export type { ChatMessage, ChatCompletionOptions, ChatCompletionResult } from "./client.js";

export { extractFactsFromPage, extractFactsFromPages, mergeExtractionResults } from "./extractor/index.js";
export type { ExtractorConfig } from "./extractor/index.js";

export { SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";
