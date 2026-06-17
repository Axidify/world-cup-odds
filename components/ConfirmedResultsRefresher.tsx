"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  shouldRefreshForConfirmedResults,
  type ConfirmedResultsSnapshot,
} from "@/lib/results/confirmed-sync";

type StatusResponse = {
  confirmedResults?: ConfirmedResultsSnapshot;
  matchActivity?: { liveCount: number; awaitingCount: number };
};

const POLL_MS_IDLE = 30_000;
const POLL_MS_ACTIVE = 15_000;

export function ConfirmedResultsRefresher() {
  const router = useRouter();
  const snapshotRef = useRef<ConfirmedResultsSnapshot | null>(null);

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
        const block = data.confirmedResults;
        if (block) {
          if (shouldRefreshForConfirmedResults(snapshotRef.current, block)) {
            router.refresh();
          }
          snapshotRef.current = block;
        }

        const activity = data.matchActivity;
        if (activity && (activity.liveCount > 0 || activity.awaitingCount > 0)) {
          nextDelay = POLL_MS_ACTIVE;
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
