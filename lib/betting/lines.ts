import { getPredictionForPair, toMatchView } from "@/lib/ai/predictions";
import { getMatch, getTeam } from "@/lib/data/load";
import { getLatestSimulation } from "@/lib/sim/simulation-cache";
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
  const match = getMatch(matchId);
  if (!match || match.homeTeamId === "TBD" || match.awayTeamId === "TBD") return null;

  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  if (!home || !away) return null;

  const prediction = getPredictionForPair(match.homeTeamId, match.awayTeamId, match.stage);
  if (!prediction || prediction.stale === 1) return null;

  const view = toMatchView(prediction, match.homeTeamId, match.awayTeamId, true);
  const knockout = isKnockoutStage(match.stage);

  const lines: MatchOddsLine[] = [
    {
      selection: "home",
      label: `${home.name} win`,
      probabilityPct: view.homeWinPct,
      decimalOdds: probabilityToDecimalOdds(view.homeWinPct),
    },
    {
      selection: "away",
      label: `${away.name} win`,
      probabilityPct: view.awayWinPct,
      decimalOdds: probabilityToDecimalOdds(view.awayWinPct),
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
} | null {
  const simulation = getLatestSimulation();
  if (!simulation) return null;
  const probabilityPct = simulation.championOdds[teamId];
  if (probabilityPct == null || probabilityPct <= 0) return null;
  return {
    teamId,
    probabilityPct,
    decimalOdds: probabilityToDecimalOdds(probabilityPct),
  };
}
