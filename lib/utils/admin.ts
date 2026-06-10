export function verifyAdminPin(pin: string | undefined | null): boolean {
  const expected = process.env.ADMIN_PIN?.trim();
  if (!expected) return false;
  return pin === expected;
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PIN?.trim());
}
