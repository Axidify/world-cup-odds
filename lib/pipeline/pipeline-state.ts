import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

const SETTINGS_KEY = "auto_pipeline";

export type PipelineStatus = "idle" | "scheduled" | "running" | "completed" | "failed" | "skipped";

export type PipelineState = {
  status: PipelineStatus;
  trigger: string | null;
  step: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
};

const IDLE: PipelineState = {
  status: "idle",
  trigger: null,
  step: null,
  startedAt: null,
  finishedAt: null,
  error: null,
};

export function getPipelineState(): PipelineState {
  try {
    const db = getDb();
    const row = db.select().from(appSettings).where(eq(appSettings.key, SETTINGS_KEY)).get();
    if (!row?.value) return { ...IDLE };
    return { ...IDLE, ...JSON.parse(row.value) } as PipelineState;
  } catch {
    return { ...IDLE };
  }
}

export function writePipelineState(patch: Partial<PipelineState>): void {
  const db = getDb();
  const now = new Date().toISOString();
  const next = { ...getPipelineState(), ...patch };
  db.insert(appSettings)
    .values({ key: SETTINGS_KEY, value: JSON.stringify(next), updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: JSON.stringify(next), updatedAt: now },
    })
    .run();
}
