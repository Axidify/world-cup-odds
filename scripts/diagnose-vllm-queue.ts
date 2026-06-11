import { loadEnvLocal } from "./load-env";

loadEnvLocal();

const VLLM = process.env.VLLM_BASE_URL!.replace(/\/$/, "");
const MODEL = process.env.VLLM_MODEL ?? "qwen-coder";

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  const t0 = Date.now();
  try {
    const result = await fn();
    console.log(`[OK]   ${label} — ${Date.now() - t0}ms`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[FAIL] ${label} — ${Date.now() - t0}ms — ${msg}`);
    return null;
  }
}

async function simplePing() {
  const res = await fetch(`${VLLM}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: "Reply with exactly: pong" }],
      max_tokens: 10,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content?.trim();
}

async function fullMatchAnalyze() {
  const { MATCH_ANALYSIS_SYSTEM_PROMPT, buildMatchUserPrompt } = await import("@/lib/ai/prompts");
  const { getMatch, getTeam } = await import("@/lib/data/load");
  const m = getMatch("grp-a-1")!;
  const user = buildMatchUserPrompt(m, getTeam(m.homeTeamId)!, getTeam(m.awayTeamId)!);

  const res = await fetch(`${VLLM}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: MATCH_ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
      max_tokens: Number(process.env.VLLM_MAX_TOKENS ?? 512),
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = j.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty content");
  return content.slice(0, 80);
}

async function appBulkStatus() {
  const app = process.env.APP_URL ?? "http://localhost:3001";
  const res = await fetch(`${app}/api/analyze/bulk`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  console.log("vLLM:", VLLM, "model:", MODEL);
  console.log("---");

  await timed("1. Simple ping (while idle)", simplePing);

  console.log("\n--- Starting long match analyze (may take 30-120s) ---");
  const analyzePromise = timed("2. Full match analyze", fullMatchAnalyze);

  await new Promise((r) => setTimeout(r, 2_000));
  await timed("3. Simple ping DURING analyze (queue test)", simplePing);

  const analyzeResult = await analyzePromise;

  console.log("\n--- After analyze finished ---");
  await timed("4. Simple ping (after analyze)", simplePing);

  try {
    const bulk = await appBulkStatus();
    const job = bulk.job as { status: string; completed: number; failed: number; current: string | null };
    console.log(`\nApp bulk job: status=${job.status} completed=${job.completed} failed=${job.failed} current=${job.current ?? ""}`);
  } catch (err) {
    console.log("\nApp bulk status unavailable:", err instanceof Error ? err.message : err);
  }

  console.log("\n--- Interpretation ---");
  if (analyzeResult) {
    console.log("Match analyze works when run alone — zombie queue may be cleared.");
  } else {
    console.log("Match analyze failed/timed out — vLLM may still be wedged or overloaded.");
  }
}

main();
