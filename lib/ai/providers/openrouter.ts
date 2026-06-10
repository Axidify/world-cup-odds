import type { LLMClient } from "../types";
import { getModelForProvider } from "../config";
import { createOpenAICompatibleClient } from "./openai-compatible";

export function createOpenRouterClient(): LLMClient {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  return createOpenAICompatibleClient({
    config: { provider: "openrouter", model: getModelForProvider("openrouter") },
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
      "X-Title": "World Cup Odds Calculator",
    },
  });
}
