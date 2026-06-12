import { describe, it, expect } from "vitest";
import { teamNewsFingerprint } from "@/lib/news/store";

describe("news store", () => {
  it("fingerprints squad events for change detection", () => {
    const events = [{ type: "injury", player: "A", detail: "out" }];
    const a = teamNewsFingerprint(events);
    const b = teamNewsFingerprint(events);
    const c = teamNewsFingerprint([]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("treats event order as equivalent", () => {
    const a = teamNewsFingerprint([
      { type: "injury", player: "A", detail: "out" },
      { type: "return", player: "B", detail: "fit" },
    ]);
    const b = teamNewsFingerprint([
      { type: "return", player: "B", detail: "fit" },
      { type: "injury", player: "A", detail: "out" },
    ]);
    expect(a).toBe(b);
  });
});
