import { GroupCard } from "@/components/GroupCard";
import { SimulationPanel } from "@/components/SimulationPanel";
import { getLatestSimulation, isSimulationStale } from "@/lib/sim/simulation-cache";
import { getGroups, getTeams, getFixtures } from "@/lib/data/load";

export const dynamic = "force-dynamic";

export default function GroupsPage() {
  const groups = getGroups();
  const teams = getTeams();
  const fixtures = getFixtures();
  const simulation = getLatestSimulation();
  const stale = isSimulationStale();
  const standingsByGroup = simulation?.predictedPath.groupStandings;

  return (
    <div>
      <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Group Stage</p>
      <h1 className="mt-2 font-[family-name:var(--font-archivo)] text-3xl font-bold">Group standings</h1>
      <p className="mt-2 text-sm text-text-muted">
        12 groups · {fixtures.length} group-stage matches
        {standingsByGroup ? " · modal standings from last simulation" : " · run simulation to populate standings"}
      </p>
      {stale && simulation && (
        <p className="mt-2 text-xs font-semibold text-loss">
          Predictions updated since last simulation — re-run to refresh standings.
        </p>
      )}
      {!simulation && (
        <div className="mt-4">
          <SimulationPanel hasSimulation={false} lastRunAt={null} />
        </div>
      )}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <GroupCard
            key={g.group}
            group={g}
            teams={teams}
            fixtures={fixtures}
            standings={standingsByGroup?.[g.group]}
          />
        ))}
      </div>
    </div>
  );
}
