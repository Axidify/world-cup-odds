import { describe, it, expect } from "vitest";
import { formatBracketSlot } from "@/lib/utils/slots";

describe("formatBracketSlot", () => {
  it("formats winner slots", () => {
    expect(formatBracketSlot("W:r32-1")).toBe("Winner r32-1");
  });

  it("formats loser slots", () => {
    expect(formatBracketSlot("L:sf-1")).toBe("Loser sf-1");
  });
});
