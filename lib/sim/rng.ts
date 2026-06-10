/** Mulberry32 — fast seeded PRNG for reproducible Monte Carlo. */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getSimulationSeed(): number {
  const raw = Number(process.env.SIMULATION_SEED ?? 42);
  return Number.isFinite(raw) ? raw : 42;
}

export function rollPercent(rng: () => number): number {
  return rng() * 100;
}
