export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" | "text" };
  /** Disable thinking/reasoning mode. Pass true for DeepSeek V4 models to force non-thinking output. */
  disableThinking?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export class LLMClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = "LLMClientError";
  }
}

/**
 * Minimal OpenAI-compatible chat completions client.
 * Works with OpenAI, DeepSeek, Ollama, and any compatible endpoint.
 */
export async function chatCompletion(
  opts: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const url = `${opts.baseUrl.replace(/\/$/, "")}/chat/completions`;

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
  };

  if (opts.maxTokens !== undefined) {
    body.max_tokens = opts.maxTokens;
  }

  if (opts.responseFormat) {
    body.response_format = opts.responseFormat;
  }

  if (opts.disableThinking) {
    body.thinking = { type: "disabled" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);

  let response: Response;
  try {
    response = await globalThis.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw new LLMClientError(
      `LLM request failed: ${(err as Error).message}`
    );
  } finally {
    clearTimeout(timer);
  }

  const rawBody = await response.text();

  if (!response.ok) {
    throw new LLMClientError(
      `LLM API error: HTTP ${response.status} from ${url}`,
      response.status,
      rawBody
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new LLMClientError(
      `LLM returned non-JSON response: ${rawBody.slice(0, 200)}`
    );
  }

  const d = data as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = d?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new LLMClientError(
      `LLM response missing content. Got: ${rawBody.slice(0, 300)}`
    );
  }

  return {
    content,
    model: d?.model ?? opts.model,
    promptTokens: d?.usage?.prompt_tokens ?? 0,
    completionTokens: d?.usage?.completion_tokens ?? 0,
  };
}
