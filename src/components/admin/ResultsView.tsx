import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Award, Trophy, Medal, User, RefreshCw } from "lucide-react";

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

const REFRESH_MS = 10000;

export default function ResultsView() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [labelStats, setLabelStats] = useState<{ label: string; count: number; total: number; percentage: number; participation: number }[]>([]);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
    const votesPageSize2 = 1000;
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

    const categories = cats.data || [];
    const candidates = cands.data || [];
    const votes = allVotes;

    console.log("=== DEBUG LOAD ===");
    console.log("1. Total votes loaded:", votes.length);
    console.log("2. All categories:", categories.map(c => ({ id: c.id, name: c.name })));
    const votesByCat = new Map<string, number>();
    votes.forEach(v => votesByCat.set(v.category_id, (votesByCat.get(v.category_id) || 0) + 1));
    console.log("3. Votes grouped by category:", Object.fromEntries(votesByCat));
    console.log("4. Votes for Ter-Ramah (id fa771136-2f7b-4e56-aa1e-b1f26b5c2f2b):", votes.filter(v => v.category_id === "fa771136-2f7b-4e56-aa1e-b1f26b5c2f2b"));

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
    let totalUsedCount = 0;

    allTokens.forEach(t => {
      const label = t.label || "Lainnya";
      if (!labelMap.has(label)) {
        labelMap.set(label, { used: 0, total: 0 });
      }
      const m = labelMap.get(label)!;
      m.total += 1;
      if (t.used) {
        m.used += 1;
        totalUsedCount += 1;
      }
    });

    const stats = Array.from(labelMap.entries())
      .map(([label, data]) => ({
        label,
        count: data.used,
        total: data.total,
        percentage: totalUsedCount > 0 ? (data.used / totalUsedCount) * 100 : 0,
        participation: data.total > 0 ? (data.used / data.total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    setLabelStats(stats);
    setTokensUsed(totalUsedCount);
    setTotalTokens(allTokens.length);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
    timerRef.current = window.setInterval(() => load(true), REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  if (loading) return <p className="text-center py-12">Memuat...</p>;

  const totalVotes = groups.reduce((sum, g) => sum + g.totalVotes, 0);
  const participationPercentage = totalTokens > 0 ? Math.round((tokensUsed / totalTokens) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Pembaruan otomatis setiap {REFRESH_MS / 1000} detik
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
        <Stat icon={<Trophy className="w-5 h-5" />} label="Total Suara" value={totalVotes} />
        <Stat icon={<Award className="w-5 h-5" />} label="Pemilih Aktif" value={tokensUsed} accent />
        <Stat icon={<Medal className="w-5 h-5" />} label="Kategori" value={groups.length} />
        <Stat icon={<User className="w-5 h-5" />} label="Partisipasi" value={`${participationPercentage}%`} />
      </div>

      {labelStats.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-accent" />
            <h3 className="font-display text-xl font-semibold">Demografi Pemilih</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {labelStats.map((stat) => (
              <div key={stat.label} className="bg-background rounded-lg p-4 border border-border">
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0">
                    <span className="text-sm font-bold block truncate">{stat.label}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                      {stat.count} / {stat.total} Suara
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-emerald-500">{Math.round(stat.participation)}%</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-muted-foreground">Partisipasi</span>
                      <span className="font-mono">{Math.round(stat.participation)}%</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-1000 ease-out"
                        style={{ width: `${stat.participation}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-muted-foreground">Kontribusi</span>
                      <span className="font-mono">{Math.round(stat.percentage)}%</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
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
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {groups.map((g, gi) => {
          const max = Math.max(1, ...g.items.map((i) => Number(i.votes)));
          const winner = g.items[0];
          const hasVotes = g.totalVotes > 0;
          return (
            <div key={g.id} className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-soft">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div>
                  <h3 className="font-display text-xl font-semibold">{g.name}</h3>
                  <p className="text-xs text-muted-foreground">{g.totalVotes} suara masuk</p>
                </div>
                {hasVotes && winner && (
                  <span className="text-xs px-2 py-1 rounded-full bg-gold text-accent-foreground font-semibold w-fit">
                    🏆 {winner.candidate_name}
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {(expanded[g.id] ? g.items : g.items.slice(0, INITIAL_VISIBLE)).map((item, idx) => {
                  const v = Number(item.votes);
                  const pct = hasVotes ? Math.round((v / g.totalVotes) * 100) : 0;
                  return (
                    <div key={item.candidate_id} className="flex gap-3">
                      <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                        {item.photo_url ? (
                          <img src={item.photo_url} alt={item.candidate_name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <User className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1 gap-2">
                          <span className={`truncate ${idx === 0 && hasVotes ? "font-semibold" : ""}`}>
                            <span className="text-muted-foreground mr-1">{idx + 1}.</span>
                            {item.candidate_name}
                          </span>
                          <span className="font-mono tabular-nums shrink-0">
                            {v} {hasVotes ? `(${pct}%)` : ""}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-700 ${idx === 0 && hasVotes ? "bg-gold" : "bg-primary/40"}`}
                            style={{ width: `${max > 0 ? (v / max) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {g.items.length > INITIAL_VISIBLE && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleExpand(g.id)}
                    className="w-full mt-2"
                  >
                    {expanded[g.id]
                      ? "Tampilkan lebih sedikit"
                      : `Tampilkan semua (+${g.items.length - INITIAL_VISIBLE} kandidat)`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border shadow-soft ${accent ? "bg-gold text-accent-foreground border-accent" : "bg-card border-border"}`}>
      <div className="flex items-center gap-2 text-xs opacity-75 mb-1">{icon}{label}</div>
      <div className="font-display text-3xl font-semibold">{value}</div>
    </div>
  );
}
