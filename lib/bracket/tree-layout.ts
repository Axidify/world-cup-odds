import type { MatchStage } from "@/lib/types";

export type BracketRoundDef = {
  stage: MatchStage;
  label: string;
  column: number;
};

/** Main knockout path columns (third place rendered separately). */
export const BRACKET_ROUNDS: BracketRoundDef[] = [
  { stage: "r32", label: "Round of 32", column: 1 },
  { stage: "r16", label: "Round of 16", column: 2 },
  { stage: "qf", label: "Quarter-finals", column: 3 },
  { stage: "sf", label: "Semi-finals", column: 4 },
  { stage: "final", label: "Final", column: 5 },
];

/** Single source of truth for bracket geometry (shared by tree + connectors). */
export const COLUMN_WIDTH = 184;
export const COLUMN_GAP = 48;
export const MATCH_CARD_HEIGHT = 56;
export const MATCH_VERTICAL_GAP = 18;

export type BracketMetrics = {
  columnWidth: number;
  columnGap: number;
  treeWidth: number;
  overflows: boolean;
};

const MIN_COLUMN_WIDTH = 128;
const MIN_COLUMN_GAP = 28;

/** Natural width at default column/gap sizes. */
export function bracketNaturalWidthPx(): number {
  return (
    BRACKET_ROUNDS.length * COLUMN_WIDTH + (BRACKET_ROUNDS.length - 1) * COLUMN_GAP
  );
}

/** Size columns to fill `containerWidth`; only overflow on very narrow viewports. */
export function computeBracketMetrics(containerWidth: number): BracketMetrics {
  const rounds = BRACKET_ROUNDS.length;
  const gaps = rounds - 1;
  const width = Math.max(containerWidth, 1);
  const minTreeWidth = rounds * MIN_COLUMN_WIDTH + gaps * MIN_COLUMN_GAP;

  if (width < minTreeWidth) {
    return {
      columnWidth: MIN_COLUMN_WIDTH,
      columnGap: MIN_COLUMN_GAP,
      treeWidth: minTreeWidth,
      overflows: true,
    };
  }

  const columnGap = width >= 960 ? COLUMN_GAP : MIN_COLUMN_GAP;
  const columnWidth = (width - gaps * columnGap) / rounds;

  return {
    columnWidth,
    columnGap,
    treeWidth: width,
    overflows: false,
  };
}

/** Half the pitch between adjacent R32 matches. */
const UNIT = (MATCH_CARD_HEIGHT + MATCH_VERTICAL_GAP) / 2;

/** Vertical offset (px) for match `matchIndex` in round `roundIndex` (0 = R32). */
export function bracketMatchTopPx(roundIndex: number, matchIndex: number): number {
  return UNIT * (matchIndex * 2 ** (roundIndex + 1) + (2 ** roundIndex - 1));
}

/** Left offset (px) of a round column. */
export function bracketColumnLeftPx(roundIndex: number, metrics?: BracketMetrics): number {
  const columnWidth = metrics?.columnWidth ?? COLUMN_WIDTH;
  const columnGap = metrics?.columnGap ?? COLUMN_GAP;
  return roundIndex * (columnWidth + columnGap);
}

/** Total height of the main bracket column area (R32 drives max height). */
export function bracketTreeHeightPx(r32Count = 16): number {
  return bracketMatchTopPx(0, r32Count) + MATCH_CARD_HEIGHT;
}

/** Total width spanned by all round columns. */
export function bracketTreeWidthPx(metrics?: BracketMetrics): number {
  if (metrics) return metrics.treeWidth;
  return bracketNaturalWidthPx();
}

export function feederMatchIds(homeSlot?: string, awaySlot?: string): string[] {
  const ids: string[] = [];
  for (const slot of [homeSlot, awaySlot]) {
    if (!slot) continue;
    if (slot.startsWith("W:") || slot.startsWith("L:")) ids.push(slot.slice(2));
  }
  return ids;
}
