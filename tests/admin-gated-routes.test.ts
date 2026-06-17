import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { POST as analyzeMatchPost } from "@/app/api/analyze/match/route";
import { PATCH as settingsLlmPatch } from "@/app/api/settings/llm/route";
import { POST as syncNewsPost } from "@/app/api/sync/news/route";

const TEST_PIN = "verify-test-pin";

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin-gated API routes", () => {
  const originalPin = process.env.ADMIN_PIN;
  const originalLlm = process.env.LLM_PROVIDER;
  const originalVllm = process.env.VLLM_BASE_URL;

  beforeEach(() => {
    process.env.ADMIN_PIN = TEST_PIN;
    process.env.LLM_PROVIDER = "vllm";
    process.env.VLLM_BASE_URL = "http://127.0.0.1:8001/v1";
    process.env.VLLM_MODEL = "test-model";
  });

  afterEach(() => {
    if (originalPin === undefined) delete process.env.ADMIN_PIN;
    else process.env.ADMIN_PIN = originalPin;
    if (originalLlm === undefined) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = originalLlm;
    if (originalVllm === undefined) delete process.env.VLLM_BASE_URL;
    else process.env.VLLM_BASE_URL = originalVllm;
  });

  describe("POST /api/analyze/match", () => {
    it("rejects missing pin", async () => {
      const res = await analyzeMatchPost(
        jsonRequest("http://localhost/api/analyze/match", "POST", { matchId: "grp-a-1" }),
      );
      expect(res.status).toBe(400);
    });

    it("rejects wrong pin", async () => {
      const res = await analyzeMatchPost(
        jsonRequest("http://localhost/api/analyze/match", "POST", {
          matchId: "grp-a-1",
          pin: "wrong",
        }),
      );
      expect(res.status).toBe(403);
      expect((await res.json()).error).toMatch(/invalid admin pin/i);
    });

    it("returns 503 when ADMIN_PIN is not configured", async () => {
      delete process.env.ADMIN_PIN;
      const res = await analyzeMatchPost(
        jsonRequest("http://localhost/api/analyze/match", "POST", {
          matchId: "grp-a-1",
          pin: "anything",
        }),
      );
      expect(res.status).toBe(503);
    });
  });

  describe("POST /api/sync/news", () => {
    it("rejects missing pin", async () => {
      const res = await syncNewsPost(
        jsonRequest("http://localhost/api/sync/news", "POST", { matchId: "grp-a-1" }),
      );
      expect(res.status).toBe(400);
    });

    it("rejects wrong pin before provider checks", async () => {
      const res = await syncNewsPost(
        jsonRequest("http://localhost/api/sync/news", "POST", {
          matchId: "grp-a-1",
          pin: "wrong",
        }),
      );
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/settings/llm", () => {
    it("rejects missing pin", async () => {
      const res = await settingsLlmPatch(
        jsonRequest("http://localhost/api/settings/llm", "PATCH", { provider: "vllm" }),
      );
      expect(res.status).toBe(400);
    });

    it("rejects wrong pin", async () => {
      const res = await settingsLlmPatch(
        jsonRequest("http://localhost/api/settings/llm", "PATCH", {
          provider: "vllm",
          pin: "wrong",
        }),
      );
      expect(res.status).toBe(403);
    });
  });
});
