import cron from "node-cron";
import { loadEnvLocal } from "./load-env";

loadEnvLocal();

async function main() {
  const { getDb } = await import("@/lib/db");
  getDb();

  const { isSearchConfigured } = await import("@/lib/search/provider");
  if (!isSearchConfigured()) {
    console.warn("[poller] No search API configured — results/news jobs will no-op until TAVILY_API_KEY is set.");
  }

  const { isProviderReady } = await import("@/lib/ai/settings");
  if (!isProviderReady()) {
    console.warn("[poller] No LLM configured — news extraction will fail until LLM_PROVIDER is set.");
  }

  const intervalMin = Number(process.env.RESULTS_POLL_INTERVAL_MINUTES ?? 15);
  const cronExpr = `*/${Math.max(1, Math.min(intervalMin, 59))} * * * *`;

  const { runResultsPollJob } = await import("@/lib/jobs/poll-results");
  const { runNewsPollJob } = await import("@/lib/jobs/poll-news");

  const newsHours = Number(process.env.NEWS_POLL_INTERVAL_HOURS ?? 6);
  const newsCron = `0 */${Math.max(1, Math.min(newsHours, 23))} * * *`;

  console.log(`[poller] Starting results poller (every ${intervalMin} min)`);
  console.log(`[poller] Starting news poller (every ${newsHours} h)`);

  const runResults = async (backfill = false) => {
    try {
      const summary = await runResultsPollJob({ backfill });
      console.log(
        `[poller] results: polled=${summary.polled} confirmed=${summary.confirmed} synced=${summary.synced} failed=${summary.failed}`,
      );
    } catch (err) {
      console.error("[poller] results job failed:", err);
    }
  };

  const runNews = async () => {
    try {
      const summary = await runNewsPollJob();
      console.log(
        `[poller] news: polled=${summary.polled} synced=${summary.synced} skipped=${summary.skipped} failed=${summary.failed}`,
      );
    } catch (err) {
      console.error("[poller] news job failed:", err);
    }
  };

  await runResults(true);
  await runNews();
  cron.schedule(cronExpr, () => void runResults(false));
  cron.schedule(newsCron, () => void runNews());
  console.log("[poller] Scheduled. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("[poller] Fatal:", err);
  process.exit(1);
});
