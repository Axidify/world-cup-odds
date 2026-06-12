import { fetchWorldFootballEloRatings } from "@/lib/calibration/fetch-world-football-elo";
import {
  getWorldFootballEloData,
  setLiveWorldFootballEloData,
} from "@/lib/calibration/world-football-elo";

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes";
}

/** Pull latest ratings from eloratings.net into the in-process overlay. */
export async function refreshWorldFootballEloLive(): Promise<{
  refreshed: boolean;
  asOf: string;
  count: number;
}> {
  const fetched = await fetchWorldFootballEloRatings();
  setLiveWorldFootballEloData(fetched);
  return {
    refreshed: true,
    asOf: fetched.asOf,
    count: Object.keys(fetched.ratings).length,
  };
}

/** Poller startup — refresh when enabled (default on). */
export async function refreshWorldFootballEloOnStartup(): Promise<void> {
  if (!envFlag("ELO_REFRESH_ON_START", true)) return;
  try {
    const result = await refreshWorldFootballEloLive();
    console.log(
      `[poller] World Football Elo refreshed (${result.count} teams, as of ${result.asOf})`,
    );
  } catch (err) {
    const bundled = getWorldFootballEloData();
    console.warn(
      "[poller] World Football Elo refresh failed — using bundled seeds from",
      bundled.asOf,
      err instanceof Error ? err.message : err,
    );
  }
}
