import { afterEach, describe, expect, it } from "vitest";
import { normalizeAppBaseUrl, resolveAppBaseUrl } from "@/lib/ai/trigger-bulk-analyze";

describe("resolveAppBaseUrl", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("adds https when APP_URL is a bare hostname", () => {
    process.env.APP_URL = "world-cup-odds-production.up.railway.app";
    expect(resolveAppBaseUrl()).toBe("https://world-cup-odds-production.up.railway.app");
  });

  it("keeps an explicit https URL", () => {
    process.env.APP_URL = "https://world-cup-odds-production.up.railway.app/";
    expect(resolveAppBaseUrl()).toBe("https://world-cup-odds-production.up.railway.app");
  });

  it("uses http for localhost without a scheme", () => {
    expect(normalizeAppBaseUrl("localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeAppBaseUrl("127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
  });
});
