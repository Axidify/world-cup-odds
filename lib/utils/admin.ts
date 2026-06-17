import { NextResponse } from "next/server";

export function verifyAdminPin(pin: string | undefined | null): boolean {
  const expected = process.env.ADMIN_PIN?.trim();
  if (!expected) return false;
  return pin === expected;
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PIN?.trim());
}

/** Returns a JSON error response when PIN is missing/invalid; null when authorized. */
export function rejectUnlessAdminPin(pin: string | undefined | null): NextResponse | null {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "ADMIN_PIN is not configured" }, { status: 503 });
  }
  if (!verifyAdminPin(pin)) {
    return NextResponse.json({ error: "Invalid admin PIN" }, { status: 403 });
  }
  return null;
}
