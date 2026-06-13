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

export function predictedScoreFromProbs(
  probs: EloMatchProbs,
  eloHome?: number,
  eloAway?: number,
): string {
  if (probs.drawPct >= probs.homeWinPct && probs.drawPct >= probs.awayWinPct) {
    return probs.drawPct >= 22 ? "1-1" : "0-0";
  }
  const homeFav = probs.homeWinPct >= probs.awayWinPct;
  const gap =
    eloHome != null && eloAway != null ? Math.abs(eloHome - eloAway) : 80;

  if (homeFav) {
    if (gap >= 280) return "3-0";
    if (gap >= 200) return "3-1";
    if (gap >= 130) return "2-0";
    return "2-1";
  }
  if (gap >= 280) return "0-3";
  if (gap >= 200) return "1-3";
  if (gap >= 130) return "0-2";
  return "1-2";
}
