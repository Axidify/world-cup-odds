export function getLlmConcurrency(): number {
  const provider = (process.env.LLM_PROVIDER ?? "vllm").toLowerCase();
  const raw =
    provider === "vllm"
      ? Number(process.env.VLLM_CONCURRENCY ?? process.env.LLM_CONCURRENCY ?? 4)
      : Number(process.env.LLM_CONCURRENCY ?? 3);
  if (!Number.isFinite(raw) || raw < 1) return 3;
  return Math.min(Math.floor(raw), 8);
}

export async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
  shouldCancel?: () => boolean,
): Promise<void> {
  let next = 0;
  async function runOne(): Promise<void> {
    while (true) {
      if (shouldCancel?.()) return;
      const i = next++;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runOne());
  await Promise.all(workers);
}
