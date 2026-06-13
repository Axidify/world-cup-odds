"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type LiveScoreView = {
  homeScore: number;
  awayScore: number;
  status: string | null;
  minute: string | null;
  syncedAt: string;
};

type LiveScoresResponse = {
  configured: boolean;
  scores: Record<string, LiveScoreView>;
  count: number;
};

const LiveScoresContext = createContext<{
  configured: boolean;
  scores: Record<string, LiveScoreView>;
}>({
  configured: false,
  scores: {},
});

export function LiveScoresProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<LiveScoresResponse>({
    configured: false,
    scores: {},
    count: 0,
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/live/scores");
      if (res.ok) setData(await res.json());
    } catch {
      setData({ configured: false, scores: {}, count: 0 });
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const value = useMemo(
    () => ({ configured: data.configured, scores: data.scores }),
    [data.configured, data.scores],
  );

  return <LiveScoresContext.Provider value={value}>{children}</LiveScoresContext.Provider>;
}

export function useLiveScores() {
  return useContext(LiveScoresContext);
}

export function useLiveScore(matchId: string): LiveScoreView | null {
  const { scores } = useLiveScores();
  return scores[matchId] ?? null;
}
