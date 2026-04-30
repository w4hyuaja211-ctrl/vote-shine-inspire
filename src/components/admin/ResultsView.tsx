import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Award, Trophy, Medal } from "lucide-react";

interface Row { category_id: string; category_name: string; candidate_id: string; candidate_name: string; role_type: string; votes: number; }

export default function ResultsView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [votes, cats, cands, tokens] = await Promise.all([
      supabase.from("votes").select("category_id, candidate_id"),
      supabase.from("categories").select("id, name, display_order").order("display_order"),
      supabase.from("candidates").select("id, name, role_type"),
      supabase.from("vote_tokens").select("used"),
    ]);

    const catMap = new Map((cats.data || []).map((c) => [c.id, c]));
    const candMap = new Map((cands.data || []).map((c) => [c.id, c]));
    const tally = new Map<string, Row>();

    (votes.data || []).forEach((v) => {
      const key = `${v.category_id}|${v.candidate_id}`;
      const existing = tally.get(key);
      if (existing) { existing.votes++; return; }
      const cat = catMap.get(v.category_id);
      const cand = candMap.get(v.candidate_id);
      if (!cat || !cand) return;
      tally.set(key, {
        category_id: v.category_id, category_name: cat.name,
        candidate_id: v.candidate_id, candidate_name: cand.name,
        role_type: cand.role_type, votes: 1,
      });
    });

    // Ensure categories with no votes still appear
    (cats.data || []).forEach((cat) => {
      const has = Array.from(tally.values()).some((r) => r.category_id === cat.id);
      if (!has) {
        tally.set(`${cat.id}|empty`, {
          category_id: cat.id, category_name: cat.name,
          candidate_id: "", candidate_name: "", role_type: "", votes: 0,
        });
      }
    });

    setRows(Array.from(tally.values()));
    setTotalVotes((votes.data || []).length);
    setTokensUsed((tokens.data || []).filter((t) => t.used).length);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <p className="text-center py-12">Memuat...</p>;

  // Group by category
  const cats = Array.from(new Set(rows.map((r) => r.category_id)))
    .map((id) => {
      const items = rows.filter((r) => r.category_id === id && r.candidate_id).sort((a, b) => b.votes - a.votes);
      const name = rows.find((r) => r.category_id === id)?.category_name || "";
      return { id, name, items };
    });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Stat icon={<Trophy className="w-5 h-5" />} label="Total Suara" value={totalVotes} />
        <Stat icon={<Award className="w-5 h-5" />} label="Pemilih Aktif" value={tokensUsed} accent />
        <Stat icon={<Medal className="w-5 h-5" />} label="Kategori" value={cats.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {cats.map((cat) => {
          const max = Math.max(1, ...cat.items.map((i) => i.votes));
          const winner = cat.items[0];
          return (
            <div key={cat.id} className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-soft">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <h3 className="font-display text-xl font-semibold">{cat.name}</h3>
                {winner && winner.votes > 0 && (
                  <span className="text-xs px-2 py-1 rounded-full bg-gold text-accent-foreground font-semibold w-fit">
                    🏆 {winner.candidate_name}
                  </span>
                )}
              </div>
              {cat.items.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Belum ada suara</p>
              ) : (
                <div className="space-y-2">
                  {cat.items.map((item, idx) => (
                    <div key={item.candidate_id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={idx === 0 ? "font-semibold" : ""}>
                          {idx + 1}. {item.candidate_name}
                        </span>
                        <span className="font-mono">{item.votes}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={idx === 0 ? "h-full bg-gold" : "h-full bg-primary/40"}
                          style={{ width: `${(item.votes / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border shadow-soft ${accent ? "bg-gold text-accent-foreground border-accent" : "bg-card border-border"}`}>
      <div className="flex items-center gap-2 text-xs opacity-75 mb-1">{icon}{label}</div>
      <div className="font-display text-3xl font-semibold">{value}</div>
    </div>
  );
}
