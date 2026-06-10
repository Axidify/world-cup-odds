import Anthropic from "@anthropic-ai/sdk";
import type { LLMClient } from "../types";
import { getModelForProvider } from "../config";

export function createAnthropicClient(): LLMClient {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  const model = getModelForProvider("anthropic");
  const client = new Anthropic({ apiKey });

  return {
    config: { provider: "anthropic", model },
    async completeJSON(system, user) {
      const response = await client.messages.create({
        model,
        max_tokens: 512,
        temperature: 0.3,
        system,
        messages: [{ role: "user", content: user }],
      });
      const block = response.content.find((b) => b.type === "text");
      if (!block || block.type !== "text") throw new Error("Empty response from Anthropic");
      return block.text;
    },
    async healthCheck() {
      // Avoid billable API calls on poll — credentials present is sufficient here.
      return Boolean(apiKey);
    },
  };
}
