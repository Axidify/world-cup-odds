import { getDb } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

const KEYS = {
  results: "poller_results_at",
  news: "poller_news_at",
} as const;

export type PollerKind = keyof typeof KEYS;

export function recordPollerRun(kind: PollerKind): void {
  const db = getDb();
  const now = new Date().toISOString();
  const key = KEYS[kind];
  db.insert(appSettings)
    .values({ key, value: now, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: now, updatedAt: now },
    })
    .run();
}

export function getPollerStatus(): {
  lastResultsPollAt: string | null;
  lastNewsPollAt: string | null;
} {
  const db = getDb();
  const rows = db.select().from(appSettings).all();
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    lastResultsPollAt: byKey.get(KEYS.results) ?? null,
    lastNewsPollAt: byKey.get(KEYS.news) ?? null,
  };
}
