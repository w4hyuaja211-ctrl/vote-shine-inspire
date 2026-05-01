import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Award, Trophy, Medal, User, RefreshCw } from "lucide-react";

interface Category {
  id: string;
  name: string;
  display_order: number;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<number | null>(null);

  const load = async (silent = false) => {
    if (!silent) setRefreshing(true);
    const [cats, results, tokens] = await Promise.all([
      supabase.from("categories").select("id, name, display_order").order("display_order"),
      (supabase as any).rpc("public_results"),
      supabase.from("vote_tokens").select("used"),
    ]);

    setCategories(cats.data || []);
    setRows((results.data || []) as Row[]);
    setTokensUsed((tokens.data || []).filter((t) => t.used).length);
    setTotalTokens((tokens.data || []).length);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
    timerRef.current = window.setInterval(() => load(true), REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  if (loading) return <p className="text-center py-12">Memuat...</p>;

  // Group by category using all categories from database
  const groups: CategoryGroup[] = categories.map((cat) => {
    const categoryRows = rows.filter((r) => r.category_name === cat.name);
    const totalVotesInCategory = categoryRows.reduce((sum, r) => sum + Number(r.votes), 0);
    const sortedItems = categoryRows.sort((a, b) => Number(b.votes) - Number(a.votes));
    
    return {
      id: cat.id,
      name: cat.name,
      order: cat.display_order,
      items: sortedItems,
      totalVotes: totalVotesInCategory,
    };
  });

  const totalVotes = rows.reduce((s, r) => s + Number(r.votes), 0);
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
                {g.items.slice(0, 5).map((item, idx) => {
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
                {g.items.length > 5 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    +{g.items.length - 5} kandidat lainnya
                  </p>
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
