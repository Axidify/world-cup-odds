"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  shouldRefreshForConfirmedResults,
  type ConfirmedResultsSnapshot,
} from "@/lib/results/confirmed-sync";
import {
  shouldRefreshForSimulation,
  type SimulationSnapshot,
} from "@/lib/tournament/status-sync";

type StatusResponse = {
  confirmedResults?: ConfirmedResultsSnapshot;
  simulation?: { runAt: string } | null;
  pipeline?: { active: boolean };
  matchActivity?: { liveCount: number; awaitingCount: number };
};

const POLL_MS_IDLE = 30_000;
const POLL_MS_ACTIVE = 15_000;
const POLL_MS_PIPELINE = 5_000;

export function TournamentStatusRefresher() {
  const router = useRouter();
  const confirmedRef = useRef<ConfirmedResultsSnapshot | null>(null);
  const simulationRef = useRef<SimulationSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delayMs: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void poll(), delayMs);
    };

    const poll = async () => {
      if (!active) return;

      let nextDelay = POLL_MS_IDLE;
      try {
        const res = await fetch("/api/tournament/status");
        if (!res.ok) {
          schedule(nextDelay);
          return;
        }

        const data = (await res.json()) as StatusResponse;
        let shouldRefresh = false;

        const confirmed = data.confirmedResults;
        if (confirmed) {
          if (shouldRefreshForConfirmedResults(confirmedRef.current, confirmed)) {
            shouldRefresh = true;
          }
          confirmedRef.current = confirmed;
        }

        const sim: SimulationSnapshot = { runAt: data.simulation?.runAt ?? null };
        if (shouldRefreshForSimulation(simulationRef.current, sim)) {
          shouldRefresh = true;
        }
        simulationRef.current = sim;

        if (shouldRefresh) {
          router.refresh();
        }

        if (data.pipeline?.active) {
          nextDelay = POLL_MS_PIPELINE;
        } else {
          const activity = data.matchActivity;
          if (activity && (activity.liveCount > 0 || activity.awaitingCount > 0)) {
            nextDelay = POLL_MS_ACTIVE;
          }
        }
      } catch {
        // keep polling
      }

      schedule(nextDelay);
    };

    void poll();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  return null;
}
