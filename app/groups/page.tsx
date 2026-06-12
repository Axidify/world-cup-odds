import { GroupsView } from "@/components/GroupsView";

import { getConfirmedResults } from "@/lib/sim/actual-results";

import { getLatestSimulation, getSimulationStaleState } from "@/lib/sim/simulation-cache";
import { formatSimulationStaleMessage } from "@/lib/sim/stale-messages";

import { buildOfficialStandingsByGroup } from "@/lib/standings/official-standings";
import { getProjectedGroupScores } from "@/lib/sim/projected-scores";

import { getGroups, getTeams, getFixtures } from "@/lib/data/load";



export const dynamic = "force-dynamic";



export default function GroupsPage() {

  const groups = getGroups();

  const teams = getTeams();

  const fixtures = getFixtures();

  const simulation = getLatestSimulation();

  const staleState = getSimulationStaleState();

  const confirmed = getConfirmedResults();

  const confirmedScores = Object.fromEntries(confirmed);
  const projectedScores = Object.fromEntries(
    getProjectedGroupScores(confirmed, simulation?.predictedPath),
  );

  const hasConfirmedGroupResults = fixtures.some((f) => confirmed.has(f.id));



  return (

    <GroupsView

      groups={groups}

      teams={teams}

      fixtures={fixtures}

      officialStandings={buildOfficialStandingsByGroup(confirmed)}

      projectedStandings={simulation?.predictedPath.groupStandings}

      projectedScores={projectedScores}

      confirmedScores={confirmedScores}

      hasConfirmedGroupResults={hasConfirmedGroupResults}

      simulationRunAt={simulation?.runAt ?? null}

      simulationStale={staleState.stale}

      staleMessage={formatSimulationStaleMessage(staleState)}

      hasSimulation={Boolean(simulation)}

    />

  );

}

