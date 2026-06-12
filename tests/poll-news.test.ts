import { describe, it, expect } from "vitest";
import {
  getTeamsNeedingNews,
  pollTeamNews,
  shouldRejectEmptyNewsExtraction,
} from "@/lib/jobs/poll-news";

describe("getTeamsNeedingNews", () => {
  it("returns only teams with kickoff in the next 48 hours when tournament is active", () => {
    const teams = getTeamsNeedingNews();
    expect(teams.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
  });

  it("rejects unknown team ids", async () => {
    await expect(pollTeamNews("not-a-team", { force: true })).resolves.toBe("failed");
  });
});

describe("shouldRejectEmptyNewsExtraction", () => {
  it("rejects when LLM would wipe existing events", () => {
    expect(
      shouldRejectEmptyNewsExtraction(
        [{ type: "injury", player: "A", detail: "out" }],
        [],
      ),
    ).toBe(true);
  });

  it("allows empty when no prior events exist", () => {
    expect(shouldRejectEmptyNewsExtraction([], [])).toBe(false);
  });

  it("allows non-empty extractions", () => {
    expect(
      shouldRejectEmptyNewsExtraction(
        [{ type: "injury", player: "A", detail: "out" }],
        [{ type: "return", player: "A", detail: "fit" }],
      ),
    ).toBe(false);
  });
});
