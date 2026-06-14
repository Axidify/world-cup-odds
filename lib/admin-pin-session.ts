const STORAGE_KEY = "wc-admin-pin";

/** Cached admin PIN for the current browser tab session (sessionStorage). */
export function getAdminPinSession(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminPinSession(pin: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, pin);
  } catch {
    // ignore quota / private mode
  }
}

export function clearAdminPinSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isInvalidAdminPinStatus(status: number): boolean {
  return status === 401 || status === 403;
}
