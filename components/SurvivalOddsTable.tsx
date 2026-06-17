import { Flag } from "@/components/Flag";
import { Card } from "@/components/ui/Card";
import type { Team } from "@/lib/types";
import type { SurvivalOddsMap } from "@/lib/sim/survival-stages";
import { SURVIVAL_STAGES, SURVIVAL_STAGE_LABELS } from "@/lib/sim/survival-stages";

type Props = {
  teams: Team[];
  survival: SurvivalOddsMap | null;
  championOdds: Record<string, number> | null;
  limit?: number;
};

export function SurvivalOddsTable({ teams, survival, championOdds, limit = 20 }: Props) {
  if (!survival) return null;

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const ranked = Object.entries(championOdds ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  return (
    <Card className="mt-8 overflow-hidden">
      <div className="border-b border-border bg-surface-2 px-4 py-3">
        <h2 className="text-sm font-bold">Tournament depth</h2>
        <p className="mt-1 text-xs text-text-muted">
          % of simulations where each team reaches each round. The Champion column matches the main
          table&apos;s Current % (wins the final).
        </p>
      </div>
      <div className="scrollbar-themed overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-text-muted">
              <th className="px-4 py-3 font-semibold">Team</th>
              {SURVIVAL_STAGES.map((stage) => (
                <th key={stage} className="px-3 py-3 text-right font-semibold">
                  {SURVIVAL_STAGE_LABELS[stage]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.map((teamId) => {
              const team = teamMap.get(teamId);
              const row = survival[teamId];
              if (!team || !row) return null;
              return (
                <tr key={teamId} className="border-t border-border">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2 font-semibold">
                      <Flag code={team.flagCode} alt={team.name} size="sm" />
                      {team.name}
                    </span>
                  </td>
                  {SURVIVAL_STAGES.map((stage) => {
                    const value =
                      stage === "champion" && championOdds?.[teamId] != null
                        ? championOdds[teamId]
                        : row[stage];
                    return (
                    <td key={stage} className="num px-3 py-2.5 text-right text-text-muted">
                      {value.toFixed(1)}%
                    </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
