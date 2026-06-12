"use client";

import {
  BRACKET_ROUNDS,
  type BracketMetrics,
  MATCH_CARD_HEIGHT,
  bracketColumnLeftPx,
  bracketMatchTopPx,
  bracketTreeHeightPx,
  bracketTreeWidthPx,
  feederMatchIds,
} from "@/lib/bracket/tree-layout";
import type { Match } from "@/lib/types";

type Props = {
  matchesByStage: Map<string, Match[]>;
  metrics: BracketMetrics;
};

export function BracketConnectors({ matchesByStage, metrics }: Props) {
  const height = bracketTreeHeightPx();
  const width = bracketTreeWidthPx(metrics);

  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  for (let r = 0; r < BRACKET_ROUNDS.length - 1; r++) {
    const current = matchesByStage.get(BRACKET_ROUNDS[r].stage) ?? [];
    const next = matchesByStage.get(BRACKET_ROUNDS[r + 1].stage) ?? [];
    const x1 = bracketColumnLeftPx(r, metrics) + metrics.columnWidth;
    const x2 = bracketColumnLeftPx(r + 1, metrics);
    const midX = x1 + metrics.columnGap / 2;

    for (let j = 0; j < next.length; j++) {
      const child = next[j];
      const feederIds = feederMatchIds(child.homeSlot, child.awaySlot);
      const parentYs = feederIds
        .map((id) => {
          const i = current.findIndex((m) => m.id === id);
          if (i < 0) return null;
          return bracketMatchTopPx(r, i) + MATCH_CARD_HEIGHT / 2;
        })
        .filter((y): y is number => y != null);

      if (parentYs.length === 0) continue;

      const childY = bracketMatchTopPx(r + 1, j) + MATCH_CARD_HEIGHT / 2;
      const yMin = Math.min(...parentYs);
      const yMax = Math.max(...parentYs);

      for (const y of parentYs) {
        lines.push({ x1, y1: y, x2: midX, y2: y });
      }
      if (yMin !== yMax) {
        lines.push({ x1: midX, y1: yMin, x2: midX, y2: yMax });
      }
      lines.push({ x1: midX, y1: childY, x2, y2: childY });
    }
  }

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={width}
      height={height}
      aria-hidden
    >
      {lines.map((line, idx) => (
        <path
          key={idx}
          d={`M ${line.x1} ${line.y1} H ${line.x2} V ${line.y2}`}
          fill="none"
          stroke="oklch(0.45 0.02 250 / 0.5)"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}
