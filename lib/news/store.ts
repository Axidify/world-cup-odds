import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { newsCache, teamEvents } from "@/lib/db/schema";

export type TeamEventRow = {
  id: string;
  teamId: string;
  type: string;
  player: string | null;
  detail: string | null;
  source: string | null;
  fetchedAt: string;
};

export type TeamNewsSummary = {
  teamId: string;
  events: TeamEventRow[];
  summary: string | null;
  fetchedAt: string | null;
};

export function getTeamEvents(teamId: string): TeamEventRow[] {
  const db = getDb();
  return db
    .select()
    .from(teamEvents)
    .where(eq(teamEvents.teamId, teamId))
    .all()
    .map((row) => ({
      id: row.id,
      teamId: row.teamId,
      type: row.type,
      player: row.player,
      detail: row.detail,
      source: row.source,
      fetchedAt: row.fetchedAt,
    }))
    .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
}

export function getLatestFetchAt(teamId: string): string | null {
  const db = getDb();
  const cached = db
    .select()
    .from(newsCache)
    .where(eq(newsCache.queryHash, `team:${teamId}`))
    .get();
  if (cached?.fetchedAt) return cached.fetchedAt;

  const events = getTeamEvents(teamId);
  return events[0]?.fetchedAt ?? null;
}

export function replaceTeamEvents(
  teamId: string,
  events: Array<{
    type: string;
    player?: string | null;
    detail?: string | null;
    source?: string | null;
  }>,
  fetchedAt: string,
): TeamEventRow[] {
  const db = getDb();
  db.delete(teamEvents).where(eq(teamEvents.teamId, teamId)).run();

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    db.insert(teamEvents)
      .values({
        id: `${teamId}-${fetchedAt}-${i}`,
        teamId,
        type: e.type,
        player: e.player ?? null,
        detail: e.detail ?? null,
        source: e.source ?? null,
        fetchedAt,
      })
      .run();
  }

  return getTeamEvents(teamId);
}

export function getTeamNewsSummaryText(teamId: string): string | null {
  const db = getDb();
  const row = db.select().from(newsCache).where(eq(newsCache.queryHash, `team:${teamId}`)).get();
  return row?.summary ?? null;
}

export function setTeamNewsSummary(teamId: string, summary: string, fetchedAt: string): void {
  const db = getDb();
  db.insert(newsCache)
    .values({
      queryHash: `team:${teamId}`,
      snippets: null,
      summary,
      fetchedAt,
    })
    .onConflictDoUpdate({
      target: newsCache.queryHash,
      set: { summary, fetchedAt },
    })
    .run();
}

export function teamNewsFingerprint(
  events: Array<{ type: string; player: string | null; detail: string | null }>,
  summary: string,
): string {
  return JSON.stringify({
    summary,
    events: events.map((e) => ({ type: e.type, player: e.player, detail: e.detail })),
  });
}

export function getTeamNewsSummary(teamId: string): TeamNewsSummary {
  const events = getTeamEvents(teamId);
  return {
    teamId,
    events,
    summary: getTeamNewsSummaryText(teamId),
    fetchedAt: getLatestFetchAt(teamId),
  };
}
