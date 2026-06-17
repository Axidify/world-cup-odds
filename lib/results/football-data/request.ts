const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function parseFootballData429WaitMs(message: string): number | null {
  const m = message.match(/Wait (\d+) seconds?/i);
  if (!m) return null;
  const sec = Number(m[1]);
  return Number.isFinite(sec) && sec > 0 ? sec * 1000 : null;
}

export function isFootballData429Error(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429");
}

/** Retry football-data fetches when rate-limited (free tier is 10 req/min). */
export async function withFootballDataRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isFootballData429Error(err) || attempt === maxAttempts) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      const wait = parseFootballData429WaitMs(msg) ?? 60_000;
      console.warn(
        `[poller] football-data rate limit — retry ${attempt}/${maxAttempts - 1} in ${Math.ceil(wait / 1000)}s`,
      );
      await sleep(wait + 500);
    }
  }
  throw lastErr;
}
