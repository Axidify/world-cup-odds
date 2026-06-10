import OpenAI from "openai";
import type { LLMClient, LLMConfig } from "../types";

type Options = {
  config: LLMConfig;
  apiKey: string;
  baseURL?: string;
  defaultHeaders?: Record<string, string>;
  maxTokens?: number;
  timeoutMs?: number;
  healthPath?: string;
};

export function createOpenAICompatibleClient(options: Options): LLMClient {
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    defaultHeaders: options.defaultHeaders,
    timeout: options.timeoutMs ?? 120_000,
  });

  const baseForHealth = (options.baseURL ?? "https://api.openai.com/v1").replace(/\/$/, "");

  return {
    config: options.config,
    async completeJSON(system, user) {
      const response = await client.chat.completions.create({
        model: options.config.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        max_tokens: options.maxTokens ?? 512,
        temperature: 0.3,
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from LLM");
      return content;
    },
    async healthCheck() {
      try {
        const res = await fetch(`${baseForHealth}/models`, {
          headers: { Authorization: `Bearer ${options.apiKey}` },
          signal: AbortSignal.timeout(5000),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
