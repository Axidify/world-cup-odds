/**
 * Seed group-stage predictions from Elo (no external LLM).
 * Useful when vLLM is down or to demo the simulation pipeline.
 */
import { loadEnvLocal } from "./load-env";
import { getModelForProvider } from "@/lib/ai/config";
import { savePrediction } from "@/lib/ai/predictions";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { expectedHomeScore, getEloMap } from "@/lib/calibration/elo";
import { getFixtures } from "@/lib/data/load";

loadEnvLocal();

const GROUP_DRAW_PCT = 25;

function eloGroupProbs(homeId: string, awayId: string, elo: Map<string, number>) {
  const pHome = expectedHomeScore(elo.get(homeId) ?? 1500, elo.get(awayId) ?? 1500);
  const remain = 100 - GROUP_DRAW_PCT;
  const homeWin = Math.round(pHome * remain * 10) / 10;
  const awayWin = Math.round((1 - pHome) * remain * 10) / 10;
  const draw = Math.round((GROUP_DRAW_PCT + (100 - homeWin - awayWin - GROUP_DRAW_PCT)) * 10) / 10;
  const total = homeWin + draw + awayWin;
  return {
    homeWinPct: Math.round((homeWin / total) * 1000) / 10,
    drawPct: Math.round((draw / total) * 1000) / 10,
    awayWinPct: Math.round((awayWin / total) * 1000) / 10,
  };
}

function main() {
  const provider = resolveActiveProvider();
  if (!provider) {
    console.error("No LLM_PROVIDER set");
    process.exit(1);
  }
  const model = getModelForProvider(provider);
  const elo = getEloMap();
  let count = 0;

  for (const m of getFixtures()) {
    if (m.homeTeamId === "TBD" || m.awayTeamId === "TBD") continue;
    const probs = eloGroupProbs(m.homeTeamId, m.awayTeamId, elo);
    const score =
      probs.homeWinPct >= probs.awayWinPct
        ? probs.homeWinPct > probs.drawPct
          ? "2-1"
          : "1-1"
        : "1-2";
    savePrediction({
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      stage: "group",
      provider,
      model,
      ...probs,
      predictedScore: score,
      keyFactors: ["Elo-seeded (no LLM)"],
      analysis: "Seeded from Elo ratings for offline simulation.",
    });
    count += 1;
  }

  console.log(JSON.stringify({ seeded: count, provider, model }, null, 2));
}

main();
