import { resolveActiveProvider } from "@/lib/ai/settings";
import { getFixtures } from "@/lib/data/load";
import { orientProbabilities } from "@/lib/sim/match-outcomes";
import { loadPredictionStore } from "@/lib/sim/prediction-store";

export type FixtureWinProbs = { home: number; draw: number; away: number };

export function buildGroupFixtureProbs(): Record<string, FixtureWinProbs> {
  const provider = resolveActiveProvider();
  if (!provider) return {};

  try {
    const store = loadPredictionStore(provider);
    const out: Record<string, FixtureWinProbs> = {};
    for (const m of getFixtures()) {
      if (m.homeTeamId === "TBD" || m.awayTeamId === "TBD") continue;
      try {
        const pred = store.get(m.homeTeamId, m.awayTeamId, "group", m.id);
        const probs = orientProbabilities(pred, m.homeTeamId);
        out[m.id] = {
          home: Math.round(probs.homeWinPct),
          draw: Math.round(probs.drawPct),
          away: Math.round(probs.awayWinPct),
        };
      } catch {
        // missing prediction
      }
    }
    return out;
  } catch {
    return {};
  }
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
