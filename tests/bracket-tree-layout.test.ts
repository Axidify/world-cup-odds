import { describe, expect, it } from "vitest";
import {
  bracketMatchTopPx,
  bracketNaturalWidthPx,
  computeBracketMetrics,
  feederMatchIds,
} from "@/lib/bracket/tree-layout";

describe("bracket tree layout", () => {
  it("spaces R32 matches by one full pitch", () => {
    expect(bracketMatchTopPx(0, 0)).toBe(0);
    expect(bracketMatchTopPx(0, 1)).toBe(bracketMatchTopPx(0, 0) + 74);
  });

  it("centers a round between its two feeder matches", () => {
    const r16Center = bracketMatchTopPx(1, 0);
    const feederMid = (bracketMatchTopPx(0, 0) + bracketMatchTopPx(0, 1)) / 2;
    expect(r16Center).toBe(feederMid);
  });

  it("parses winner feeder slots", () => {
    expect(feederMatchIds("W:r32-1", "W:r32-2")).toEqual(["r32-1", "r32-2"]);
  });

  it("expands columns to fill a wide container", () => {
    const metrics = computeBracketMetrics(1500);
    expect(metrics.overflows).toBe(false);
    expect(metrics.treeWidth).toBe(1500);
    expect(metrics.columnWidth).toBeGreaterThan(184);
  });

  it("keeps natural width as the default minimum layout", () => {
    expect(bracketNaturalWidthPx()).toBe(1112);
  });
});
