import { describe, it, expect } from "vitest";
import { teamNewsFingerprint } from "@/lib/news/store";

describe("news store", () => {
  it("fingerprints squad news for change detection", () => {
    const a = teamNewsFingerprint(
      [{ type: "injury", player: "A", detail: "out" }],
      "One injury",
    );
    const b = teamNewsFingerprint(
      [{ type: "injury", player: "A", detail: "out" }],
      "One injury",
    );
    const c = teamNewsFingerprint([], "No news");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
