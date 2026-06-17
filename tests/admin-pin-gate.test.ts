import { describe, expect, it, afterEach } from "vitest";
import {
  isAdminConfigured,
  rejectUnlessAdminPin,
  verifyAdminPin,
} from "@/lib/utils/admin";

describe("rejectUnlessAdminPin", () => {
  const original = process.env.ADMIN_PIN;

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_PIN;
    else process.env.ADMIN_PIN = original;
  });

  it("returns 503 when ADMIN_PIN is not configured", () => {
    delete process.env.ADMIN_PIN;
    const res = rejectUnlessAdminPin("anything");
    expect(res?.status).toBe(503);
  });

  it("returns 403 for wrong pin", () => {
    process.env.ADMIN_PIN = "secret-pin";
    const res = rejectUnlessAdminPin("wrong");
    expect(res?.status).toBe(403);
  });

  it("returns null for correct pin", () => {
    process.env.ADMIN_PIN = "secret-pin";
    expect(rejectUnlessAdminPin("secret-pin")).toBeNull();
    expect(verifyAdminPin("secret-pin")).toBe(true);
    expect(isAdminConfigured()).toBe(true);
  });
});
