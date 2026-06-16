import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { liveScores } from "@/lib/db/schema";
import { clearLiveScores, upsertLiveScore } from "@/lib/results/live-scores/store";

describe("pruneLiveScores via clearLiveScores", () => {
  beforeEach(() => {
    const db = getDb();
    db.delete(liveScores).run();
  });

  it("drops stale in-play rows when the fixture left live tracking", () => {
    upsertLiveScore({
      matchId: "grp-g-2",
      homeScore: 2,
      awayScore: 2,
      status: "IN_PLAY",
    });

    clearLiveScores();
    expect(clearLiveScores).toBeDefined();
    const db = getDb();
    const rows = db.select().from(liveScores).all();
    expect(rows).toHaveLength(0);
  });
});
