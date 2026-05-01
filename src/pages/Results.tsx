import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Award, Trophy, RefreshCw, ArrowLeft, Crown, User } from "lucide-react";
import VotingStatusBanner from "@/components/VotingStatusBanner";

interface Row {
  category_id: string;
  category_name: string;
  category_order: number;
  candidate_id: string;
  candidate_name: string;
  role_type: string;
  photo_url: string | null;
  votes: number;
}

interface CategoryGroup {
  id: string;
  name: string;
  order: number;
  items: Row[];
  totalVotes: number;
}

const REFRESH_MS = 10000;

export default function Results() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const timerRef = useRef<number | null>(null);

  const load = async (silent = false) => {
    if (!silent) setRefreshing(true);
    const { data, error } = await (supabase as any).rpc("public_results");
    if (error) {
      setError(error.message || "Gagal memuat hasil");
    } else {
      setRows((data || []) as Row[]);
      setError("");
      setLastUpdated(new Date());
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
    timerRef.current = window.setInterval(() => load(true), REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Group by category
  const groups: CategoryGroup[] = (() => {
    const map = new Map<string, CategoryGroup>();
    rows.forEach((r) => {
      const g = map.get(r.category_id);
      if (g) {
        g.items.push(r);
        g.totalVotes += Number(r.votes);
      } else {
        map.set(r.category_id, {
          id: r.category_id,
          name: r.category_name,
          order: r.category_order,
          items: [r],
          totalVotes: Number(r.votes),
        });
      }
    });
    return Array.from(map.values())
      .map((g) => ({ ...g, items: g.items.sort((a, b) => Number(b.votes) - Number(a.votes)) }))
      .sort((a, b) => a.order - b.order);
  })();

  const totalSuara = rows.reduce((s, r) => s + Number(r.votes), 0);

  return (
    <div className="min-h-screen bg-background islamic-pattern pb-12">
      <header className="bg-hero text-primary-foreground shadow-elegant sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs sm:text-sm opacity-90 hover:opacity-100">
              <ArrowLeft className="w-4 h-4" /> Kembali
            </Link>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="opacity-80">
                {lastUpdated ? lastUpdated.toLocaleTimeString("id-ID") : "—"}
              </span>
            </div>
          </div>
          <div className="mt-3 text-center">
            <div className="inline-flex items-center gap-2 text-[11px] sm:text-xs opacity-80">
              <Trophy className="w-3.5 h-3.5 text-accent" />
              <span>SMA Muhammadiyah 1 Palembang · Hardiknas 2026</span>
            </div>
            <h1 className="font-display text-2xl sm:text-4xl md:text-5xl font-semibold mt-1">
              Hasil <span className="gradient-text-gold">Voting Real-time</span>
            </h1>
            <p className="text-xs sm:text-sm opacity-85 mt-1">
              Pembaruan otomatis setiap {REFRESH_MS / 1000} detik · Total suara masuk: <b>{totalSuara}</b>
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-6 pt-4 sm:pt-6 max-w-5xl">
        <div className="mb-4">
          <VotingStatusBanner />
        </div>

        {loading ? (
          <p className="text-center py-12 text-muted-foreground">Memuat hasil...</p>
        ) : error ? (
          <div className="text-center py-10 px-4 bg-card rounded-xl border border-border">
            <p className="text-sm text-destructive mb-3">{error}</p>
            <button onClick={() => load()} className="text-sm underline">Coba lagi</button>
          </div>
        ) : groups.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">Belum ada data.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {groups.map((g, gi) => {
              const max = Math.max(1, ...g.items.map((i) => Number(i.votes)));
              const winner = g.items[0];
              const hasVotes = g.totalVotes > 0;
              return (
                <section key={g.id} className="bg-card border border-border rounded-2xl p-3.5 sm:p-5 shadow-soft">
                  <header className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-muted-foreground">#{gi + 1}</span>
                      <h2 className="font-display text-base sm:text-xl font-semibold leading-tight truncate">
                        {g.name}
                      </h2>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{g.totalVotes} suara</p>
                    </div>
                    <Award className="w-5 h-5 text-accent shrink-0" />
                  </header>

                  {hasVotes && winner && (
                    <div className="flex items-center gap-2.5 p-2.5 mb-3 rounded-xl bg-gold/15 border border-accent/30">
                      <div className="w-10 h-[60px] rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                        {winner.photo_url ? (
                          <img src={winner.photo_url} alt={winner.candidate_name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-accent uppercase tracking-wide">
                          <Crown className="w-3 h-3" /> Sementara
                        </div>
                        <p className="font-semibold text-sm truncate">{winner.candidate_name}</p>
                        <p className="text-[11px] text-muted-foreground">{Number(winner.votes)} suara</p>
                      </div>
                    </div>
                  )}

                  <ol className="space-y-2">
                    {g.items.slice(0, 5).map((item, idx) => {
                      const v = Number(item.votes);
                      const pct = hasVotes ? (v / max) * 100 : 0;
                      return (
                        <li key={item.candidate_id}>
                          <div className="flex justify-between items-baseline text-xs sm:text-sm mb-1 gap-2">
                            <span className={`truncate ${idx === 0 && hasVotes ? "font-semibold" : ""}`}>
                              <span className="text-muted-foreground mr-1">{idx + 1}.</span>
                              {item.candidate_name}
                            </span>
                            <span className="font-mono tabular-nums shrink-0">{v}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-700 ${idx === 0 && hasVotes ? "bg-gold" : "bg-primary/40"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  {g.items.length > 5 && (
                    <p className="text-[11px] text-muted-foreground mt-2">
                      +{g.items.length - 5} kandidat lainnya
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
