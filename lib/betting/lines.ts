import { getPredictionForPair, toMatchView } from "@/lib/ai/predictions";
import { getTeam } from "@/lib/data/load";
import { getResolvedMatch } from "@/lib/data/resolved";
import { getLatestSimulation, isSimulationStale } from "@/lib/sim/simulation-cache";
import { computeAdvanceProbs } from "@/lib/sim/match-outcomes";
import { applyNewsImpactToView } from "@/lib/news/impact";
import { probabilityToDecimalOdds } from "./odds";
import { isKnockoutStage } from "./locks";

export type MatchOddsLine = {
  selection: "home" | "draw" | "away";
  label: string;
  probabilityPct: number;
  decimalOdds: number;
};

export type MatchOddsSnapshot = {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  stage: string;
  lines: MatchOddsLine[];
};

export function getMatchOddsSnapshot(matchId: string): MatchOddsSnapshot | null {
  const match = getResolvedMatch(matchId);
  if (!match || match.homeTeamId === "TBD" || match.awayTeamId === "TBD") return null;

  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  if (!home || !away) return null;

  const prediction = getPredictionForPair(match.homeTeamId, match.awayTeamId, match.stage);
  if (!prediction || prediction.stale === 1) return null;

  const view = applyNewsImpactToView(
    toMatchView(prediction, match.homeTeamId, match.awayTeamId, true),
    match.homeTeamId,
    match.awayTeamId,
  );
  const knockout = isKnockoutStage(match.stage);

  // Knockout bets are on advancing: redistribute the draw probability mass
  // (ET/pens) so the two lines reflect true advance probabilities.
  const { advanceHome, advanceAway } = computeAdvanceProbs(
    view.homeWinPct,
    view.drawPct,
    view.awayWinPct,
  );
  const homePct = knockout ? advanceHome : view.homeWinPct;
  const awayPct = knockout ? advanceAway : view.awayWinPct;

  const lines: MatchOddsLine[] = [
    {
      selection: "home",
      label: knockout ? `${home.name} advance` : `${home.name} win`,
      probabilityPct: homePct,
      decimalOdds: probabilityToDecimalOdds(homePct),
    },
    {
      selection: "away",
      label: knockout ? `${away.name} advance` : `${away.name} win`,
      probabilityPct: awayPct,
      decimalOdds: probabilityToDecimalOdds(awayPct),
    },
  ];

  if (!knockout) {
    lines.splice(1, 0, {
      selection: "draw",
      label: "Draw",
      probabilityPct: view.drawPct,
      decimalOdds: probabilityToDecimalOdds(view.drawPct),
    });
  }

  return {
    matchId,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    stage: match.stage,
    lines,
  };
}

export function getChampionOddsLine(teamId: string): {
  teamId: string;
  probabilityPct: number;
  decimalOdds: number;
  simulationStale: boolean;
} | null {
  const simulation = getLatestSimulation();
  if (!simulation) return null;
  const simulationStale = isSimulationStale();
  const probabilityPct = simulation.championOdds[teamId];
  if (probabilityPct == null || probabilityPct <= 0) return null;
  return {
    teamId,
    probabilityPct,
    decimalOdds: probabilityToDecimalOdds(probabilityPct),
    simulationStale,
  };
}
