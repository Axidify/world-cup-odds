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
  const resultsIntervalMs = Math.max(1, intervalMin) * 60 * 1000;

  const { runResultsPollJob } = await import("@/lib/jobs/poll-results");
  const { runNewsPollJob } = await import("@/lib/jobs/poll-news");
  const { getResultsPollPlan } = await import("@/lib/jobs/poll-schedule");

  const newsHours = Number(process.env.NEWS_POLL_INTERVAL_HOURS ?? 6);
  const newsCron = `0 */${Math.max(1, Math.min(newsHours, 23))} * * *`;

  console.log(
    `[poller] Results poller schedule-aware (every ${intervalMin} min when matches need scores)`,
  );
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

  const { runStartupPipeline } = await import("@/lib/pipeline/auto-pipeline");
  const { getPipelineConfig } = await import("@/lib/pipeline/config");
  const pipeline = getPipelineConfig();
  if (pipeline.enabled) {
    console.log(
      `[poller] Auto-pipeline on (simulate=${pipeline.simulateOnResults}, analyze=${pipeline.analyzeMissing})`,
    );
    void runStartupPipeline().catch((err) => {
      console.error("[poller] Startup pipeline failed:", err);
    });
  }

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const scheduleResultsLoop = async () => {
    for (;;) {
      const plan = getResultsPollPlan(resultsIntervalMs);
      if (plan.shouldPoll) {
        await runResults(false);
      } else {
        const wake = new Date(plan.nextPollAt).toISOString();
        console.log(`[poller] results idle — ${plan.reason}; next check ${wake}`);
      }
      await sleep(plan.delayMs);
    }
  };

  cron.schedule(newsCron, () => void runNews());
  void scheduleResultsLoop();
  console.log("[poller] Scheduled. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("[poller] Fatal:", err);
  process.exit(1);
});
