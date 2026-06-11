import { and, count, desc, eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { actualResults } from "@/lib/db/schema";

export function getLatestConfirmedAt(): string | null {
  const db = getDb();
  const row = db
    .select({ confirmedAt: actualResults.confirmedAt })
    .from(actualResults)
    .where(eq(actualResults.confirmed, 1))
    .orderBy(desc(actualResults.confirmedAt))
    .limit(1)
    .get();
  return row?.confirmedAt ?? null;
}

export function countConfirmedSince(sinceIso: string): number {
  const db = getDb();
  const row = db
    .select({ n: count() })
    .from(actualResults)
    .where(and(eq(actualResults.confirmed, 1), gt(actualResults.confirmedAt, sinceIso)))
    .get();
  return row?.n ?? 0;
}
