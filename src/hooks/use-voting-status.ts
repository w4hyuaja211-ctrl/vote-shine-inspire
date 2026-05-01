import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type VotingPhase = "before" | "open" | "closed" | "always-open";

export interface VotingStatus {
  phase: VotingPhase;
  startsAt: Date | null;
  endsAt: Date | null;
  resultsPublic: boolean;
  remainingMs: number | null; // ms until next phase change
  loading: boolean;
}

function computePhase(starts: Date | null, ends: Date | null, now: Date): VotingPhase {
  if (!starts && !ends) return "always-open";
  if (starts && now < starts) return "before";
  if (ends && now > ends) return "closed";
  return "open";
}

export function useVotingStatus(): VotingStatus {
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [resultsPublic, setResultsPublic] = useState(true);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("voting_settings")
        .select("starts_at, ends_at, results_public")
        .limit(1)
        .maybeSingle();
      if (!mounted) return;
      if (data) {
        setStartsAt(data.starts_at ? new Date(data.starts_at) : null);
        setEndsAt(data.ends_at ? new Date(data.ends_at) : null);
        setResultsPublic(data.results_public ?? true);
      }
      setLoading(false);
    })();
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const now = new Date();
  const phase = computePhase(startsAt, endsAt, now);
  let remainingMs: number | null = null;
  if (phase === "before" && startsAt) remainingMs = startsAt.getTime() - now.getTime();
  else if (phase === "open" && endsAt) remainingMs = endsAt.getTime() - now.getTime();

  return { phase, startsAt, endsAt, resultsPublic, remainingMs, loading };
}

export function formatCountdown(ms: number | null): string {
  if (ms === null || ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (days > 0) return `${days}h ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
