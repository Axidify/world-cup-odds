import { Flag } from "@/components/Flag";
import { GroupFixtureRow } from "@/components/GroupFixtureRow";
import { Card } from "@/components/ui/Card";
import type { GroupAssignment, GroupStanding, Match, PlayedMatchResult, Team } from "@/lib/types";

type Props = {
  group: GroupAssignment;
  teams: Team[];
  fixtures: Match[];
  standings?: GroupStanding[];
  confirmedScores?: Map<string, PlayedMatchResult>;
  projectedScores?: Map<string, PlayedMatchResult>;
  showProjectedScores?: boolean;
  showFixtures?: boolean;
};

function standingRowClass(position: number): string {
  if (position <= 2) return "bg-brand-tint/40";
  if (position === 3) return "border border-dashed border-brand/50";
  return "opacity-70";
}

export function GroupCard({
  group,
  teams,
  fixtures,
  standings,
  confirmedScores,
  projectedScores,
  showProjectedScores = false,
  showFixtures = true,
}: Props) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const groupFixtures = fixtures.filter((f) => f.group === group.group);
  const standingByTeam = new Map(standings?.map((s) => [s.teamId, s]));

  return (
    <Card className="p-4">
      <h3 className="mb-3 flex items-center gap-2 font-[family-name:var(--font-archivo)] text-sm font-bold">
        Group {group.group}
        <span className="num text-[11px] font-normal text-text-muted">· {groupFixtures.length} fixtures</span>
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-text-muted">
            <th className="pb-2 text-left font-semibold">Team</th>
            {standings ? (
              <>
                <th className="pb-2 text-right font-semibold">P</th>
                <th className="pb-2 text-right font-semibold">GD</th>
                <th className="pb-2 text-right font-semibold">Pts</th>
              </>
            ) : (
              <th className="pb-2 text-right font-semibold">FIFA</th>
            )}
          </tr>
        </thead>
        <tbody>
          {(standings
            ? [...standings].sort((a, b) => a.position - b.position)
            : group.teamIds.map((teamId) => ({ teamId, position: 0, played: 0, goalDifference: 0, points: 0 }))
          ).map((row) => {
            const t = teamMap.get(row.teamId);
            if (!t) return null;
            const s = standingByTeam.get(t.id);
            return (
              <tr
                key={t.id}
                className={`border-t border-border ${s ? standingRowClass(s.position) : ""}`}
              >
                <td className="py-2 pl-2">
                  <span className="flex items-center gap-2 font-semibold">
                    <Flag code={t.flagCode} alt={t.name} size="sm" />
                    {t.name}
                  </span>
                </td>
                {s ? (
                  <>
                    <td className="num py-2 text-right text-text-muted">{s.played}</td>
                    <td className="num py-2 text-right text-text-muted">
                      {s.goalDifference > 0 ? "+" : ""}
                      {s.goalDifference}
                    </td>
                    <td className="num py-2 text-right font-semibold">{s.points}</td>
                  </>
                ) : (
                  <td className="num py-2 text-right text-text-muted">#{t.fifaRank}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {showFixtures && (
      <div className="mt-2 border-t border-border pt-2">
        {groupFixtures.map((m) => {
          const home = teamMap.get(m.homeTeamId as string);
          const away = teamMap.get(m.awayTeamId as string);
          const result = confirmedScores?.get(m.id);
          const projected = showProjectedScores ? projectedScores?.get(m.id) : undefined;
          return (
            <GroupFixtureRow
              key={m.id}
              matchId={m.id}
              homeLabel={home?.name ?? "TBD"}
              awayLabel={away?.name ?? "TBD"}
              kickoffIso={m.date}
              confirmed={result}
              projected={projected}
            />
          );
        })}
      </div>
      )}
    </Card>
  );
}
