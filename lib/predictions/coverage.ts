import type { LLMProvider } from "@/lib/types";
import { getFixtures } from "@/lib/data/load";
import { getConfirmedResults } from "@/lib/sim/actual-results";
import { lookupPredictionTiered } from "@/lib/predictions/lookup";

export type PredictionCoverage = {
  total: number;
  fresh: number;
  stale: number;
  eloSeed: number;
  missing: number;
};

/** Group-fixture prediction coverage for the active provider. */
export function getPredictionCoverage(provider: LLMProvider): PredictionCoverage {
  const out: PredictionCoverage = {
    total: 0,
    fresh: 0,
    stale: 0,
    eloSeed: 0,
    missing: 0,
  };

  const confirmed = getConfirmedResults();

  for (const m of getFixtures()) {
    if (m.homeTeamId === "TBD" || m.awayTeamId === "TBD") continue;
    if (confirmed.has(m.id)) continue;
    out.total += 1;

    const hit = lookupPredictionTiered(m.homeTeamId, m.awayTeamId, "group", provider, {
      allowEloFallback: false,
    });
    if (!hit) {
      out.missing += 1;
      continue;
    }
    if (hit.tier === "stale") {
      out.stale += 1;
    } else if (hit.prediction.source === "elo_seed") {
      out.eloSeed += 1;
    } else {
      out.fresh += 1;
    }
  }

  return out;
}
