import { describe, expect, it } from "vitest";
import { isInvalidAdminPinStatus } from "@/lib/admin-pin-session";

describe("admin-pin-session", () => {
  it("treats 401 and 403 as invalid PIN responses", () => {
    expect(isInvalidAdminPinStatus(401)).toBe(true);
    expect(isInvalidAdminPinStatus(403)).toBe(true);
    expect(isInvalidAdminPinStatus(422)).toBe(false);
    expect(isInvalidAdminPinStatus(500)).toBe(false);
  });
});
