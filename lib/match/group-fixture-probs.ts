import { resolveActiveProvider } from "@/lib/ai/settings";
import { getFixtures } from "@/lib/data/load";
import { resolveFixtureProbabilities } from "@/lib/predictions/resolve-fixture-probs";

export type FixtureWinProbs = { home: number; draw: number; away: number };

export function resolveFixtureWinProbs(
  homeTeamId: string,
  awayTeamId: string,
  stage: string,
  kickoffIso: string,
): FixtureWinProbs | null {
  const provider = resolveActiveProvider();
  if (!provider) return null;

  const resolved = resolveFixtureProbabilities(homeTeamId, awayTeamId, stage, {
    provider,
    kickoffIso,
  });
  if (!resolved) return null;

  return {
    home: Math.round(resolved.homeWinPct),
    draw: Math.round(resolved.drawPct),
    away: Math.round(resolved.awayWinPct),
  };
}

export function buildGroupFixtureProbs(): Record<string, FixtureWinProbs> {
  const provider = resolveActiveProvider();
  if (!provider) return {};

  const out: Record<string, FixtureWinProbs> = {};
  for (const m of getFixtures()) {
    if (m.homeTeamId === "TBD" || m.awayTeamId === "TBD") continue;
    const resolved = resolveFixtureProbabilities(m.homeTeamId, m.awayTeamId, "group", {
      provider,
      kickoffIso: m.date,
    });
    if (!resolved) continue;
    out[m.id] = {
      home: Math.round(resolved.homeWinPct),
      draw: Math.round(resolved.drawPct),
      away: Math.round(resolved.awayWinPct),
    };
  }
  return out;
}

export function formatFixtureWinProbs(probs: FixtureWinProbs): string {
  const favorite =
    probs.home >= probs.draw && probs.home >= probs.away
      ? `H ${probs.home}%`
      : probs.away >= probs.draw
        ? `A ${probs.away}%`
        : `D ${probs.draw}%`;
  return favorite;
}
