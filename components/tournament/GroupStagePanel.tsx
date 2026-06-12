"use client";

import Link from "next/link";
import { Flag } from "@/components/Flag";
import type { GroupAssignment, GroupStanding, Team } from "@/lib/types";

type Props = {
  groups: GroupAssignment[];
  teams: Team[];
  standingsByGroup?: Record<string, GroupStanding[]>;
  layout?: "sidebar" | "grid";
};

function standingRowClass(position: number): string {
  if (position <= 2) return "text-brand";
  if (position === 3) return "text-text-muted";
  return "text-text-muted/70";
}

export function GroupStagePanel({
  groups,
  teams,
  standingsByGroup,
  layout = "sidebar",
}: Props) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const isGrid = layout === "grid";

  return (
    <div className={isGrid ? "w-full" : "shrink-0 md:w-56 lg:w-64"}>
      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        Group stage
      </h2>
      <div
        className={
          isGrid
            ? "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6"
            : "mt-3 max-h-[70vh] space-y-3 overflow-y-auto pr-1 md:max-h-none"
        }
      >
        {groups.map((g) => {
          const standings = standingsByGroup?.[g.group];
          const rows = standings
            ? [...standings].sort((a, b) => a.position - b.position)
            : g.teamIds.map((teamId, i) => ({
                teamId,
                position: i + 1,
                played: 0,
                points: 0,
                goalDifference: 0,
                group: g.group,
              }));

          return (
            <div key={g.group} className="rounded-lg border border-border bg-surface-2/50 p-2">
              <Link
                href="/groups"
                className="text-xs font-bold text-brand hover:underline"
              >
                Group {g.group}
              </Link>
              <ol className="mt-1.5 space-y-1">
                {rows.map((row) => {
                  const team = teamMap.get(row.teamId);
                  if (!team) return null;
                  return (
                    <li
                      key={row.teamId}
                      className={`flex items-center justify-between gap-2 text-[11px] ${standingRowClass(row.position)}`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="num w-3 shrink-0 text-[10px] opacity-70">{row.position}</span>
                        <Flag code={team.flagCode} alt={team.name} size="sm" />
                        <span className="truncate font-semibold">{team.name}</span>
                      </span>
                      {standings ? (
                        <span className="num shrink-0 text-[10px] font-semibold">{row.points} pts</span>
                      ) : (
                        <span className="num shrink-0 text-[10px] opacity-60">#{team.fifaRank}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}
