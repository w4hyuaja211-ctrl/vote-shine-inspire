import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Award, Trophy, RefreshCw, ArrowLeft, Crown, User } from "lucide-react";
import VotingStatusBanner from "@/components/VotingStatusBanner";
import { Button } from "@/components/ui/button";

interface Category {
  id: string;
  name: string;
  display_order: number;
}

interface Candidate {
  id: string;
  name: string;
  role_type: string;
  photo_url: string | null;
}

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

interface LabelStat {
  label: string;
  count: number;
  total: number;
  percentage: number; // Distribution percentage among voters
  participation: number; // Participation rate within the group
}

const REFRESH_MS = 10000;

async function checkAdminRole() {
  const { data, error } = await (supabase as any).rpc("current_user_admin_status");

  if (error) return { isAdmin: false, email: "", error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  return { isAdmin: Boolean(row?.is_admin), email: row?.user_email || "", error: "" };
}

export default function Results() {
  const nav = useNavigate();
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [labelStats, setLabelStats] = useState<LabelStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [accessError, setAccessError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const timerRef = useRef<number | null>(null);

  const INITIAL_VISIBLE = 5;
  const toggleExpand = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const load = async (silent = false) => {
    if (!silent) setRefreshing(true);
    const [cats, cands] = await Promise.all([
      supabase.from("categories").select("id, name, display_order").order("display_order"),
      supabase.from("candidates").select("id, name, role_type, photo_url"),
    ]);

    // Fetch all tokens with pagination
    const allTokens: any[] = [];
    let tokenPage = 0;
    const pageSize = 1000;
    let hasMoreTokens = true;

    while (hasMoreTokens) {
      const from = tokenPage * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("vote_tokens")
        .select("used, label")
        .range(from, to);
      
      if (error) {
        console.error("Error fetching tokens page:", error);
        break;
      }
      
      if (data && data.length > 0) {
        allTokens.push(...data);
        if (data.length < pageSize) {
          hasMoreTokens = false;
        } else {
          tokenPage++;
        }
      } else {
        hasMoreTokens = false;
      }
    }
    
    // Fetch all votes with pagination
    const allVotes: any[] = [];
    let page = 0;
    const votesPageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("votes")
        .select("id, category_id, candidate_id")
        .range(from, to);
      
      if (error) {
        console.error("Error fetching votes page:", error);
        break;
      }
      
      if (data && data.length > 0) {
        allVotes.push(...data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    if (cats.error || cands.error) {
      setError("Gagal memuat hasil");
    } else {
      const categories = cats.data || [];
      const candidates = cands.data || [];
      const votes = allVotes;

      // Count votes manually
      const voteCountMap = new Map<string, number>();
      votes.forEach(v => {
        const key = `${v.category_id}-${v.candidate_id}`;
        voteCountMap.set(key, (voteCountMap.get(key) || 0) + 1);
      });

      // Build all category groups using ALL categories and candidates
      const newGroups: CategoryGroup[] = categories.map(cat => {
        const items: Row[] = candidates.map(cand => {
          const key = `${cat.id}-${cand.id}`;
          const voteCount = voteCountMap.get(key) || 0;
          return {
            category_id: cat.id,
            category_name: cat.name,
            category_order: cat.display_order,
            candidate_id: cand.id,
            candidate_name: cand.name,
            role_type: cand.role_type,
            photo_url: cand.photo_url,
            votes: voteCount,
          };
        });

        const sortedItems = items.sort((a, b) => b.votes - a.votes);
        const totalVotes = sortedItems.reduce((sum, r) => sum + r.votes, 0);

        return {
          id: cat.id,
          name: cat.name,
          order: cat.display_order,
          items: sortedItems,
          totalVotes,
        };
      });

      setGroups(newGroups);

      // Calculate label stats accurately from all tokens
      const labelMap = new Map<string, { used: number, total: number }>();
      let totalUsed = 0;

      allTokens.forEach(t => {
        const label = t.label || "Lainnya";
        if (!labelMap.has(label)) {
          labelMap.set(label, { used: 0, total: 0 });
        }
        const m = labelMap.get(label)!;
        m.total += 1;
        if (t.used) {
          m.used += 1;
          totalUsed += 1;
        }
      });

      const stats: LabelStat[] = Array.from(labelMap.entries())
        .map(([label, data]) => ({
          label,
          count: data.used,
          total: data.total,
          percentage: totalUsed > 0 ? (data.used / totalUsed) * 100 : 0,
          participation: data.total > 0 ? (data.used / data.total) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count);

      setLabelStats(stats);
      setError("");
      setLastUpdated(new Date());
    }
    setLoading(false);
    setRefreshing(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    nav("/admin/auth", { replace: true });
  };

  useEffect(() => {
    let mounted = true;

    const check = async (session: any) => {
      if (!session) {
        nav("/admin/auth", { replace: true });
        return;
      }
      const { isAdmin: hasAdminAccess, email: accountEmail, error } = await checkAdminRole();
      if (!mounted) return;
      setEmail(accountEmail || session.user.email || "");
      setIsAdmin(hasAdminAccess);
      setAccessError(error);
      setChecking(false);
    };

    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) nav("/admin/auth", { replace: true });
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [nav]);

  useEffect(() => {
    if (!checking && isAdmin) {
      load();
      timerRef.current = window.setInterval(() => load(true), REFRESH_MS);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [checking, isAdmin]);

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Memeriksa akses...</div>;
  }

  if (accessError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center bg-card p-8 rounded-2xl shadow-elegant border border-border">
          <h2 className="font-display text-3xl mb-3">Sedang Memeriksa Ulang</h2>
          <p className="text-muted-foreground mb-6">
            Pemeriksaan admin gagal. Silakan muat ulang halaman ini atau login ulang.
          </p>
          <Button onClick={() => window.location.reload()} variant="hero">Muat Ulang</Button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center bg-card p-8 rounded-2xl shadow-elegant border border-border">
          <h2 className="font-display text-3xl mb-3">Akses Ditolak</h2>
          <p className="text-muted-foreground mb-2">
            Hasil voting hanya bisa dilihat oleh admin.
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Silakan login sebagai admin melalui panel admin.
          </p>
          <Button onClick={() => nav("/admin/auth")} variant="hero">Login Admin</Button>
        </div>
      </div>
    );
  }

  const totalSuara = groups.reduce((sum, g) => sum + g.totalVotes, 0);

  return (
    <div className="min-h-screen bg-background islamic-pattern pb-12">
      <header className="bg-hero text-primary-foreground shadow-elegant sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => nav("/admin")} className="w-auto bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                <ArrowLeft className="w-4 h-4 mr-1" /> Kembali ke Admin
              </Button>
              <div className="text-xs opacity-80">{email}</div>
            </div>
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

        {labelStats.length > 0 && (
          <section className="mb-8 bg-card border border-border rounded-2xl p-5 shadow-elegant">
            <header className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-accent" />
              <h2 className="font-display text-xl font-semibold">Demografi Pemilih</h2>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {labelStats.map((stat) => (
                <div key={stat.label} className="bg-background/50 backdrop-blur-sm rounded-xl p-4 border border-border/50 shadow-soft">
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0">
                      <span className="text-sm font-bold block truncate">{stat.label}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        {stat.count} / {stat.total} Berpartisipasi
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-lg font-display font-bold gradient-text-gold">{Math.round(stat.participation)}%</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground">Tingkat Partisipasi</span>
                        <span className="font-mono">{Math.round(stat.participation)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-1000 ease-out"
                          style={{ width: `${stat.participation}%` }}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground">Kontribusi Suara Total</span>
                        <span className="font-mono">{Math.round(stat.percentage)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all duration-1000 ease-out"
                          style={{ width: `${stat.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
