import { describe, it, expect } from "vitest";
import { runPool } from "@/lib/utils/concurrency";

describe("runPool", () => {
  it("runs all items with bounded concurrency", async () => {
    const order: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;

    await runPool(
      [0, 1, 2, 3, 4, 5],
      2,
      async (n) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        order.push(n);
        inFlight -= 1;
      },
    );

    expect(order.sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it("stops scheduling when shouldCancel returns true", async () => {
    const seen: number[] = [];
    await runPool(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      3,
      async (n) => {
        seen.push(n);
        await new Promise((r) => setTimeout(r, 1));
      },
      () => seen.length >= 4,
    );

    expect(seen.length).toBeGreaterThanOrEqual(4);
    expect(seen.length).toBeLessThan(10);
  });
});
