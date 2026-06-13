import type { LLMClient } from "./types";

export type LlmCallLog = {
  provider: string;
  model: string;
  ok: boolean;
  durationMs: number;
  error?: string;
};

export function logLlmCall(entry: LlmCallLog): void {
  const parts = [
    "[llm]",
    `provider=${entry.provider}`,
    `model=${entry.model}`,
    `ok=${entry.ok}`,
    `durationMs=${entry.durationMs}`,
  ];
  if (entry.error) parts.push(`error=${JSON.stringify(entry.error)}`);
  console.log(parts.join(" "));
}

export type BulkLlmSummary = {
  status: "completed" | "failed" | "cancelled";
  provider: string | null;
  model: string | null;
  analyzed: number;
  failed: number;
  total: number;
  durationMs: number;
};

export function logBulkLlmSummary(entry: BulkLlmSummary): void {
  console.log(
    [
      "[llm:bulk]",
      `status=${entry.status}`,
      `provider=${entry.provider ?? "—"}`,
      `model=${entry.model ?? "—"}`,
      `analyzed=${entry.analyzed}`,
      `failed=${entry.failed}`,
      `total=${entry.total}`,
      `durationMs=${entry.durationMs}`,
    ].join(" "),
  );
}

export function wrapLlmClientWithLogging(client: LLMClient): LLMClient {
  return {
    config: client.config,
    healthCheck: () => client.healthCheck(),
    async completeJSON(system, user) {
      const started = Date.now();
      try {
        const content = await client.completeJSON(system, user);
        logLlmCall({
          provider: client.config.provider,
          model: client.config.model,
          ok: true,
          durationMs: Date.now() - started,
        });
        return content;
      } catch (err) {
        logLlmCall({
          provider: client.config.provider,
          model: client.config.model,
          ok: false,
          durationMs: Date.now() - started,
          error: err instanceof Error ? err.message : "LLM request failed",
        });
        throw err;
      }
    },
  };
}
