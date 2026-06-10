import teamsData from "@/data/teams.json";
import groupsData from "@/data/groups.json";
import fixturesData from "@/data/fixtures.json";
import knockoutData from "@/data/knockout-fixtures.json";
import bracketData from "@/data/bracket-template.json";
import type { BracketTemplate, GroupAssignment, Match, Team } from "@/lib/types";

export function getTeams(): Team[] {
  return teamsData as Team[];
}

export function getTeamMap(): Map<string, Team> {
  return new Map(getTeams().map((t) => [t.id, t]));
}

export function getTeam(id: string): Team | undefined {
  return getTeamMap().get(id);
}

export function getGroups(): GroupAssignment[] {
  return groupsData as GroupAssignment[];
}

export function getFixtures(): Match[] {
  return fixturesData as Match[];
}

export function getKnockoutFixtures(): Match[] {
  return knockoutData as Match[];
}

export function getAllMatches(): Match[] {
  return [...getFixtures(), ...getKnockoutFixtures()];
}

export function getMatch(id: string): Match | undefined {
  return getAllMatches().find((m) => m.id === id);
}

export function getBracketTemplate(): BracketTemplate {
  return bracketData as BracketTemplate;
}

export function getEarliestKickoff(): string {
  const dates = getFixtures().map((m) => m.date).sort();
  return dates[0] ?? new Date().toISOString();
}
