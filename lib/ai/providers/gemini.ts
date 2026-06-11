import { GoogleGenAI } from "@google/genai";
import type { LLMClient } from "../types";
import { getModelForProvider } from "../config";

export function createGeminiClient(): LLMClient {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  const model = getModelForProvider("gemini");
  const maxOutputTokens = Number(process.env.GEMINI_MAX_TOKENS ?? 2048);
  const client = new GoogleGenAI({ apiKey });

  return {
    config: { provider: "gemini", model },
    async completeJSON(system, user) {
      const response = await client.models.generateContent({
        model,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          temperature: 0.3,
          maxOutputTokens,
          // Gemini 3 "thinking" can consume the whole output budget and truncate JSON.
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      const text = response.text;
      if (!text) throw new Error("Empty response from Gemini");
      return text;
    },
    async healthCheck() {
      try {
        await client.models.get({ model });
        return true;
      } catch {
        return false;
      }
    },
  };
}
