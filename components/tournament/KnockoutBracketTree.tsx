"use client";

import { Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Flag } from "@/components/Flag";
import { BracketConnectors } from "@/components/tournament/BracketConnectors";
import { BracketMatchNode } from "@/components/tournament/BracketMatchNode";
import type { BracketMatchDisplay } from "@/lib/bracket/match-display";
import {
  BRACKET_ROUNDS,
  type BracketMetrics,
  MATCH_CARD_HEIGHT,
  bracketColumnLeftPx,
  bracketMatchTopPx,
  bracketTreeHeightPx,
  bracketTreeWidthPx,
  computeBracketMetrics,
} from "@/lib/bracket/tree-layout";
import type { Match, MatchStage } from "@/lib/types";

const HEADER_HEIGHT = 24;
const EXTRA_BOTTOM = 96;

type Champion = { name: string; flagCode: string; winPct?: number } | null;

type Props = {
  knockout: Match[];
  displays: Map<string, BracketMatchDisplay>;
  champion: Champion;
  championLabel: string;
};

export function KnockoutBracketTree({ knockout, displays, champion, championLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<BracketMetrics>(() =>
    computeBracketMetrics(bracketTreeWidthPx()),
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      setMetrics(computeBracketMetrics(el.clientWidth));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const matchesByStage = new Map<MatchStage, Match[]>();
  for (const round of BRACKET_ROUNDS) {
    matchesByStage.set(
      round.stage,
      knockout.filter((m) => m.stage === round.stage),
    );
  }
  const thirdPlace = knockout.filter((m) => m.stage === "third_place");
  const treeHeight = bracketTreeHeightPx();
  const width = bracketTreeWidthPx(metrics);
  const finalColumnIndex = BRACKET_ROUNDS.length - 1;
  const finalTop = bracketMatchTopPx(finalColumnIndex, 0);
  const belowFinalTop = finalTop + MATCH_CARD_HEIGHT + 16;

  return (
    <div
      ref={containerRef}
      className={`w-full ${metrics.overflows ? "scrollbar-themed overflow-x-auto" : ""}`}
    >
      <div
        className="relative"
        style={{ width, height: HEADER_HEIGHT + treeHeight + EXTRA_BOTTOM }}
      >
        {BRACKET_ROUNDS.map((round, roundIndex) => (
          <p
            key={round.stage}
            className="absolute top-0 text-center text-[10px] font-semibold uppercase tracking-widest text-text-muted"
            style={{
              left: bracketColumnLeftPx(roundIndex, metrics),
              width: metrics.columnWidth,
            }}
          >
            {round.label}
          </p>
        ))}

        <div className="absolute left-0 right-0" style={{ top: HEADER_HEIGHT }}>
          <BracketConnectors matchesByStage={matchesByStage} metrics={metrics} />

          {BRACKET_ROUNDS.map((round, roundIndex) => {
            const matches = matchesByStage.get(round.stage) ?? [];
            return matches.map((m, matchIndex) => {
              const display = displays.get(m.id);
              if (!display) return null;
              return (
                <div
                  key={m.id}
                  className="absolute"
                  style={{
                    left: bracketColumnLeftPx(roundIndex, metrics),
                    top: bracketMatchTopPx(roundIndex, matchIndex),
                  }}
                >
                  <BracketMatchNode match={display} columnWidth={metrics.columnWidth} />
                </div>
              );
            });
          })}

          {champion && (
            <div
              className="absolute"
              style={{
                left: bracketColumnLeftPx(finalColumnIndex, metrics),
                top: belowFinalTop,
                width: metrics.columnWidth,
              }}
            >
              <div className="flex items-start gap-2 rounded-lg border border-brand/40 bg-brand-tint/30 px-3 py-2">
                <Trophy size={16} className="mt-0.5 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-semibold uppercase leading-snug tracking-wide text-text-muted sm:tracking-widest">
                    {championLabel}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-bold leading-snug text-text">
                    <Flag code={champion.flagCode} alt="" size="sm" />
                    <span className="min-w-0 break-words">{champion.name}</span>
                    {champion.winPct != null ? (
                      <span className="num shrink-0 text-xs font-semibold text-brand">
                        {champion.winPct.toFixed(1)}%
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
            </div>
          )}

          {thirdPlace.map((m) => {
            const display = displays.get(m.id);
            if (!display) return null;
            return (
              <div
                key={m.id}
                className="absolute"
                style={{
                  left: bracketColumnLeftPx(finalColumnIndex - 1, metrics),
                  top: belowFinalTop,
                  width: metrics.columnWidth,
                }}
              >
                <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                  Third place
                </p>
                <BracketMatchNode match={display} columnWidth={metrics.columnWidth} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
