type Props = {
  homeLabel: string;
  awayLabel: string;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
};

export function ProbabilityBars({
  homeLabel,
  awayLabel,
  homeWinPct,
  drawPct,
  awayWinPct,
}: Props) {
  const max = Math.max(homeWinPct, drawPct, awayWinPct, 1);

  return (
    <div className="space-y-4">
      {[
        { label: homeLabel, pct: homeWinPct, color: "from-brand-strong to-brand" },
        { label: "Draw", pct: drawPct, color: "from-draw/80 to-draw" },
        { label: awayLabel, pct: awayWinPct, color: "from-brand-strong to-brand" },
      ].map(({ label, pct, color }) => (
        <div key={label}>
          <div className="mb-1 flex justify-between text-xs font-semibold">
            <span>{label}</span>
            <span className="num">{pct.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${color}`}
              style={{ width: `${(pct / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
