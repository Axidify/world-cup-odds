import { sortTeamPair } from "@/lib/ai/cache-key";
import { getFixtures } from "@/lib/data/load";
import type { LLMProvider, MissingPairing, PlayedMatchResult } from "@/lib/types";
import { runModalTournament } from "@/lib/simulator";
import {
  createSyntheticPredictionStore,
  type PredictionStore,
} from "@/lib/sim/prediction-store";

function pairingKey(home: string, away: string, stage: string): string {
  const [a, b] = sortTeamPair(home, away);
  return `${a}|${b}|${stage}`;
}

/** Records all cache misses while using synthetic preds so the modal path can continue. */
export function createGapAnalysisStore(
  real: PredictionStore,
  provider: LLMProvider,
): { store: PredictionStore; missing: MissingPairing[] } {
  const synthetic = createSyntheticPredictionStore(provider);
  const missing: MissingPairing[] = [];
  const seen = new Set<string>();

  function record(home: string, away: string, stage: string, matchId?: string) {
    const key = pairingKey(home, away, stage);
    if (seen.has(key) || real.has(home, away, stage)) return;
    seen.add(key);
    missing.push({ homeTeamId: home, awayTeamId: away, stage, matchId });
  }

  const store: PredictionStore = {
    get(homeTeamId, awayTeamId, stage, matchId) {
      if (real.has(homeTeamId, awayTeamId, stage)) {
        return real.get(homeTeamId, awayTeamId, stage, matchId);
      }
      record(homeTeamId, awayTeamId, stage, matchId);
      return synthetic.get(homeTeamId, awayTeamId, stage, matchId);
    },
    has(homeTeamId, awayTeamId, stage) {
      return real.has(homeTeamId, awayTeamId, stage);
    },
    listMissing() {
      return [...missing];
    },
  };

  return { store, missing };
}

/** Enumerate all group gaps + knockout gaps along the modal bracket path. */
export function collectMissingPairings(
  store: PredictionStore,
  provider: LLMProvider,
  confirmed: Map<string, PlayedMatchResult> = new Map(),
): MissingPairing[] {
  const missing: MissingPairing[] = [];
  const seen = new Set<string>();

  for (const m of getFixtures()) {
    if (confirmed.has(m.id)) continue;
    if (m.homeTeamId === "TBD" || m.awayTeamId === "TBD") continue;
    const key = pairingKey(m.homeTeamId, m.awayTeamId, "group");
    if (!seen.has(key) && !store.has(m.homeTeamId, m.awayTeamId, "group")) {
      seen.add(key);
      missing.push({
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        stage: "group",
        matchId: m.id,
      });
    }
  }

  const { store: gapStore, missing: pathMissing } = createGapAnalysisStore(store, provider);
  runModalTournament(gapStore, confirmed);
  for (const m of pathMissing) {
    const key = pairingKey(m.homeTeamId, m.awayTeamId, m.stage);
    if (!seen.has(key)) {
      seen.add(key);
      missing.push(m);
    }
  }

  return missing;
}
