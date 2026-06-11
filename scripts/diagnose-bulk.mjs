import { readFileSync } from "fs";

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const { getDb } = await import("../lib/db/index.ts");
getDb();

const { buildBulkAnalyzeQueue, countBulkTargets } = await import("../lib/ai/preanalyze.ts");
const { getBulkJobState } = await import("../lib/ai/bulk-job.ts");
const { resolveActiveProvider } = await import("../lib/ai/settings.ts");
const { analyzeMatch } = await import("../lib/ai/analyze-match.ts");
const { analyzePair } = await import("../lib/ai/analyze-pair.ts");

const provider = resolveActiveProvider();
const targets = countBulkTargets(false);
const queue = buildBulkAnalyzeQueue({ refresh: false, includeGaps: false });
const gapQueue = buildBulkAnalyzeQueue({ refresh: true, includeGaps: true }).filter(
  (item) => !queue.some((q) => q.label === item.label),
);

console.log("provider", provider);
console.log("targets", targets);
console.log("main queue", queue.length);
console.log("gap-only queue (refresh=true sample)", gapQueue.length);
console.log("last job", getBulkJobState());

// Retry first 5 from a fresh refresh queue to capture errors
const retryQueue = buildBulkAnalyzeQueue({ refresh: true, includeGaps: false }).slice(0, 8);
const errors = [];
let ok = 0;
for (const item of retryQueue) {
  try {
    if (item.kind === "match") await analyzeMatch(item.matchId, { refresh: true });
    else await analyzePair(item.homeTeamId, item.awayTeamId, item.stage, { refresh: true });
    ok += 1;
  } catch (e) {
    errors.push({ label: item.label, error: e.message });
  }
}
console.log("sample refresh", { ok, errors });
