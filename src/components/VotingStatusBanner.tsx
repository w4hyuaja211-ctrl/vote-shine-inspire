import { Clock, CheckCircle2, XCircle, Hourglass } from "lucide-react";
import { useVotingStatus, formatCountdown } from "@/hooks/use-voting-status";

interface Props { compact?: boolean }

export default function VotingStatusBanner({ compact = false }: Props) {
  const { phase, startsAt, endsAt, remainingMs, loading } = useVotingStatus();
  if (loading) return null;

  const fmt = (d: Date | null) =>
    d ? d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-";

  let label = "Voting Berlangsung";
  let sub = "";
  let Icon = CheckCircle2;
  let tone = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";

  if (phase === "before") {
    label = "Voting Belum Dibuka";
    sub = `Dibuka: ${fmt(startsAt)}`;
    Icon = Hourglass;
    tone = "bg-amber-500/15 text-amber-300 border-amber-500/30";
  } else if (phase === "closed") {
    label = "Voting Ditutup";
    sub = `Berakhir: ${fmt(endsAt)}`;
    Icon = XCircle;
    tone = "bg-rose-500/15 text-rose-300 border-rose-500/30";
  } else if (phase === "open") {
    label = "Voting Berlangsung";
    sub = endsAt ? `Berakhir: ${fmt(endsAt)}` : "";
    Icon = CheckCircle2;
  } else {
    label = "Voting Berlangsung";
    sub = "Tidak ada batas waktu";
  }

  return (
    <div className={`rounded-xl border ${tone} px-3 py-2 sm:px-4 sm:py-3 ${compact ? "text-xs" : "text-sm"} backdrop-blur-sm`}>
      <div className="flex items-center gap-2 font-semibold">
        <Icon className="w-4 h-4 shrink-0" />
        <span>{label}</span>
        {(phase === "before" || phase === "open") && remainingMs !== null && remainingMs > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 font-mono tabular-nums">
            <Clock className="w-3.5 h-3.5" />
            {formatCountdown(remainingMs)}
          </span>
        )}
      </div>
      {sub && <p className="text-[11px] sm:text-xs opacity-80 mt-0.5">{sub}</p>}
    </div>
  );
}
