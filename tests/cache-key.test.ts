import { describe, it, expect } from "vitest";
import { buildCacheKey, sortTeamPair } from "@/lib/ai/cache-key";

describe("cache-key", () => {
  it("sorts team pair consistently", () => {
    expect(sortTeamPair("bra", "mex")).toEqual(["bra", "mex"]);
    expect(sortTeamPair("mex", "bra")).toEqual(["bra", "mex"]);
  });

  it("builds provider-aware cache keys", () => {
    const key = buildCacheKey("mex", "bra", "group", "vllm", "Qwen3.6-35B");
    expect(key).toBe("bra|mex|group|1|vllm|Qwen3.6-35B");
  });

  it("differs by provider", () => {
    const a = buildCacheKey("mex", "bra", "group", "vllm", "model-a");
    const b = buildCacheKey("mex", "bra", "group", "openai", "gpt-4o");
    expect(a).not.toBe(b);
  });
});
