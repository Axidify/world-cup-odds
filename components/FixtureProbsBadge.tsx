import type { FixtureWinProbs } from "@/lib/match/group-fixture-probs";
import { favoriteFixtureOutcome, teamAbbrev } from "@/lib/match/fixture-probs-display";

type Props = {
  probs: FixtureWinProbs;
  homeLabel: string;
  awayLabel: string;
};

function segmentBarClass(side: "home" | "draw" | "away", favoriteSide: "home" | "draw" | "away"): string {
  if (side === "draw") {
    return favoriteSide === "draw" ? "bg-brand" : "bg-draw";
  }
  return side === favoriteSide ? "bg-brand" : "bg-text-muted/45";
}

export function FixtureProbsBadge({ probs, homeLabel, awayLabel }: Props) {
  const favorite = favoriteFixtureOutcome(probs);
  const homeShort = teamAbbrev(homeLabel);
  const awayShort = teamAbbrev(awayLabel);

  const favoriteLabel =
    favorite.side === "home"
      ? homeShort
      : favorite.side === "away"
        ? awayShort
        : "Draw";

  const tooltip = `${homeLabel} ${probs.home}% · Draw ${probs.draw}% · ${awayLabel} ${probs.away}%`;

  return (
    <span
      className="flex shrink-0 items-center gap-2"
      title={tooltip}
    >
      <span
        className="flex h-1.5 w-14 overflow-hidden rounded-full bg-surface-2 sm:w-16"
        aria-hidden
      >
        <span
          className={`h-full ${segmentBarClass("home", favorite.side)}`}
          style={{ width: `${probs.home}%` }}
        />
        <span
          className={`h-full ${segmentBarClass("draw", favorite.side)}`}
          style={{ width: `${probs.draw}%` }}
        />
        <span
          className={`h-full ${segmentBarClass("away", favorite.side)}`}
          style={{ width: `${probs.away}%` }}
        />
      </span>
      <span className="num text-[10px] font-bold leading-none text-brand sm:text-xs">
        {favoriteLabel} {favorite.pct}%
      </span>
    </span>
  );
}
