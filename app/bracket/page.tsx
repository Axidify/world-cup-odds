import { TournamentBracket } from "@/components/TournamentBracket";
import { buildOfficialKnockoutPath } from "@/lib/bracket/official-knockout";
import { getConfirmedResults } from "@/lib/sim/actual-results";
import { getLatestSimulation, getSimulationStaleState } from "@/lib/sim/simulation-cache";
import { formatSimulationStaleMessage } from "@/lib/sim/stale-messages";
import { buildOfficialStandingsByGroup } from "@/lib/standings/official-standings";
import {
  getBracketTemplate,
  getFixtures,
  getGroups,
  getKnockoutFixtures,
  getTeams,
} from "@/lib/data/load";

export const dynamic = "force-dynamic";

export default function BracketPage() {
  const knockout = getKnockoutFixtures();
  const template = getBracketTemplate();
  const bracketSlots = Object.fromEntries(template.r32.map((s) => [s.matchId, s]));
  const simulation = getLatestSimulation();
  const staleState = getSimulationStaleState();
  const confirmed = getConfirmedResults();
  const confirmedScores = Object.fromEntries(confirmed);
  const official = buildOfficialKnockoutPath(confirmed);
  const groupFixtures = getFixtures();
  const hasConfirmedResults =
    groupFixtures.some((f) => confirmed.has(f.id)) || official.hasConfirmedKnockoutResults;

  return (
    <TournamentBracket
      groups={getGroups()}
      knockout={knockout}
      bracketSlots={bracketSlots}
      officialStandings={buildOfficialStandingsByGroup(confirmed)}
      projectedStandings={simulation?.predictedPath.groupStandings}
      officialPath={official.knockout}
      projectedPath={simulation?.predictedPath.knockout}
      confirmedScores={confirmedScores}
      teams={getTeams()}
      officialChampionId={official.championTeamId}
      projectedChampionId={simulation?.predictedPath.championTeamId}
      projectedChampionPct={
        simulation?.predictedPath.championTeamId
          ? simulation.championOdds[simulation.predictedPath.championTeamId]
          : undefined
      }
      hasConfirmedKnockoutResults={official.hasConfirmedKnockoutResults}
      hasConfirmedResults={hasConfirmedResults}
      hasSimulation={Boolean(simulation)}
      simulationRunAt={simulation?.runAt ?? null}
      simulationStale={staleState.stale}
      staleMessage={formatSimulationStaleMessage(staleState)}
      modalGroupStandings={simulation?.extras?.modalGroupStandings}
      representativePathNote={simulation?.extras?.representativePathNote}
    />
  );
}
