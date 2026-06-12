import { expectedHomeScore } from "@/lib/calibration/elo";

/** Group-stage draw % — lower when Elo gap is large (closer games draw more often). */
export function groupDrawPct(eloHome: number, eloAway: number): number {
  const gap = Math.abs(eloHome - eloAway);
  const base = 26;
  const min = 12;
  return Math.max(min, Math.round((base - gap * 0.035) * 10) / 10);
}

export type EloMatchProbs = {
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
};

/** Win/draw/loss % for a neutral group-stage match from Elo ratings. */
export function eloGroupMatchProbs(
  eloHome: number,
  eloAway: number,
): EloMatchProbs {
  const pHome = expectedHomeScore(eloHome, eloAway);
  const drawPct = groupDrawPct(eloHome, eloAway);
  const remain = 100 - drawPct;
  const homeWin = Math.round(pHome * remain * 10) / 10;
  const awayWin = Math.round((1 - pHome) * remain * 10) / 10;
  const draw = Math.round((100 - homeWin - awayWin) * 10) / 10;
  return { homeWinPct: homeWin, drawPct: draw, awayWinPct: awayWin };
}

const KNOCKOUT_DRAW_PCT = 10;

/** Knockout: small draw slice (ET/pens path); remainder split by Elo. */
export function eloKnockoutMatchProbs(
  eloHome: number,
  eloAway: number,
): EloMatchProbs {
  const pHome = expectedHomeScore(eloHome, eloAway);
  const remain = 100 - KNOCKOUT_DRAW_PCT;
  const homeWin = Math.round(pHome * remain * 10) / 10;
  const awayWin = Math.round((1 - pHome) * remain * 10) / 10;
  return {
    homeWinPct: homeWin,
    drawPct: KNOCKOUT_DRAW_PCT,
    awayWinPct: awayWin,
  };
}

export function predictedScoreFromProbs(probs: EloMatchProbs): string {
  if (probs.drawPct >= probs.homeWinPct && probs.drawPct >= probs.awayWinPct) {
    return "1-1";
  }
  return probs.homeWinPct >= probs.awayWinPct ? "2-1" : "1-2";
}
