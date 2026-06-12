import { Flag } from "@/components/Flag";
import { Card } from "@/components/ui/Card";
import { getTeamMap } from "@/lib/data/load";
import type { ChampionUpdateContext } from "@/lib/sim/champion-update";
import { formatUtcDateTime } from "@/lib/utils/dates";

type Props = {
  context: ChampionUpdateContext;
};

function statusTitle(context: ChampionUpdateContext): string {
  switch (context.status) {
    case "no_simulation":
      return "No simulation yet";
    case "baseline":
      return "Baseline odds";
    case "stale":
      return context.pipelineActive ? "Updating odds…" : "Odds pending update";
    case "updated":
      return "Odds updated";
  }
}

export function ChampionOddsUpdate({ context }: Props) {
  if (context.status === "no_simulation") {
    return (
      <Card className="mt-4 border-border bg-surface-2/50 p-4">
        <p className="text-sm font-semibold text-text">{statusTitle(context)}</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-text-muted">
          {context.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </Card>
    );
  }

  const teamMap = getTeamMap();
  const borderClass =
    context.status === "stale"
      ? "border-money/40 bg-money-tint/20"
      : context.status === "updated"
        ? "border-brand/40 bg-brand-tint/20"
        : "border-border bg-surface-2/50";

  return (
    <Card className={`mt-4 p-4 ${borderClass}`} role="status">
      <p className="text-sm font-semibold text-text">{statusTitle(context)}</p>

      {context.status === "stale" && context.before && (
        <p className="mt-1 text-xs text-text-muted">
          <span className="font-semibold text-text">Before update:</span> odds from{" "}
          {formatUtcDateTime(context.before.runAt)} UTC
          {context.afterOdds === null && " (still shown in the table below)"}
        </p>
      )}

      {context.status === "updated" && context.before && context.after && (
        <p className="mt-1 text-xs text-text-muted">
          <span className="font-semibold text-text">Before:</span>{" "}
          {formatUtcDateTime(context.before.runAt)} UTC ·{" "}
          <span className="font-semibold text-text">After:</span>{" "}
          {formatUtcDateTime(context.after.runAt)} UTC
        </p>
      )}

      <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-text-muted">
        {context.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>

      {context.confirmedTriggers.length > 0 && (
        <div className="mt-3 rounded-lg border border-border bg-surface/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Results that drove the change
          </p>
          <ul className="mt-2 space-y-1 text-xs text-text">
            {context.confirmedTriggers.map((r) => (
              <li key={r.matchId}>
                <span className="font-semibold">{r.label}</span>
                <span className="num text-text-muted"> · {r.score} FT</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {context.topMovers.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Biggest shifts
          </p>
          <ul className="mt-2 space-y-2">
            {context.topMovers.map((m) => {
              const team = teamMap.get(m.teamId);
              const sign = m.delta > 0 ? "+" : "";
              return (
                <li
                  key={m.teamId}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    {team && <Flag code={team.flagCode} alt={team.name} size="sm" />}
                    {team?.name ?? m.teamId.toUpperCase()}
                  </span>
                  <span className="num shrink-0 text-text-muted">
                    {m.before.toFixed(2)}% → {m.after.toFixed(2)}%
                    <span
                      className={`ml-2 font-semibold ${m.delta > 0 ? "text-win" : m.delta < 0 ? "text-loss" : ""}`}
                    >
                      {sign}
                      {m.delta.toFixed(2)}%
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
