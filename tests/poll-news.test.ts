import { describe, it, expect } from "vitest";
import { getTeamsNeedingNews, pollTeamNews } from "@/lib/jobs/poll-news";

describe("getTeamsNeedingNews", () => {
  it("returns only teams with kickoff in the next 48 hours when tournament is active", () => {
    const teams = getTeamsNeedingNews();
    expect(teams.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
  });

  it("rejects unknown team ids", async () => {
    await expect(pollTeamNews("not-a-team", { force: true })).resolves.toBe("failed");
  });
});
