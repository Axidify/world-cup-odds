#!/usr/bin/env node
/** One-shot results backfill — use after fixture fixes or deploy. */
import { loadEnvLocal } from "./load-env.ts";

loadEnvLocal();

const { getDb } = await import("../lib/db/index.ts");
getDb();

const { runResultsPollJob } = await import("../lib/jobs/poll-results.ts");
const summary = await runResultsPollJob({ backfill: true });
console.log("[backfill-results]", summary);
