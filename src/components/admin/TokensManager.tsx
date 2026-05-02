import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Download, Check, X } from "lucide-react";

interface Token { id: string; code: string; label: string | null; used: boolean; used_at: string | null; created_at: string; }

const genCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

export default function TokensManager() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [count, setCount] = useState(10);
  const [prefix, setPrefix] = useState("");
  const [filter, setFilter] = useState<"all" | "unused" | "used">("all");

  const load = async () => {
    const allTokens: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("vote_tokens")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);
      
      if (error) {
        console.error("Error fetching tokens page:", error);
        break;
      }
      
      if (data && data.length > 0) {
        allTokens.push(...data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    setTokens(allTokens);
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    if (count < 1 || count > 500) return toast.error("Jumlah harus 1-500");
    const rows = Array.from({ length: count }, () => ({
      code: genCode(),
      label: prefix.trim() || null,
    }));
    const { error } = await supabase.from("vote_tokens").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${count} kode dibuat`);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus kode ini?")) return;
    await supabase.from("vote_tokens").delete().eq("id", id);
    load();
  };

  const removeAll = async (used: boolean) => {
    if (!confirm(`Hapus semua kode ${used ? "yang sudah digunakan" : "yang belum digunakan"}?`)) return;
    await supabase.from("vote_tokens").delete().eq("used", used);
    load();
  };

  const copyAll = () => {
    const list = filtered.map((t) => t.code).join("\n");
    navigator.clipboard.writeText(list);
    toast.success("Disalin ke clipboard");
  };

  const downloadCSV = () => {
    const csv = "code,label,used,used_at\n" + tokens.map((t) =>
      `${t.code},${t.label || ""},${t.used},${t.used_at || ""}`
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `kode-voting-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = tokens.filter((t) =>
    filter === "all" ? true : filter === "used" ? t.used : !t.used
  );

  const unused = tokens.filter((t) => !t.used).length;
  const used = tokens.length - unused;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Stat label="Total" value={tokens.length} />
        <Stat label="Belum digunakan" value={unused} accent />
        <Stat label="Sudah digunakan" value={used} />
      </div>

      <div className="bg-card p-4 sm:p-5 rounded-xl border border-border shadow-soft">
        <h3 className="font-display text-xl mb-3">Generate Kode Baru</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <Label>Jumlah</Label>
            <Input type="number" min={1} max={500} value={count} onChange={(e) => setCount(parseInt(e.target.value) || 1)} />
          </div>
          <div>
            <Label>Label (opsional)</Label>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="cth: Kelas 7A" />
          </div>
          <Button onClick={generate} variant="hero" className="w-full"><Plus className="w-4 h-4 mr-1" /> Generate</Button>
        </div>
      </div>

      <div className="bg-card p-4 sm:p-5 rounded-xl border border-border shadow-soft">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 mb-4">
          <div className="grid grid-cols-3 gap-1 sm:flex">
            {(["all", "unused", "used"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
                {f === "all" ? "Semua" : f === "unused" ? "Belum" : "Terpakai"}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2">
            <Button size="sm" variant="outline" onClick={copyAll}><Copy className="w-3 h-3 mr-1" /> Salin</Button>
            <Button size="sm" variant="outline" onClick={downloadCSV}><Download className="w-3 h-3 mr-1" /> CSV</Button>
            <Button size="sm" variant="outline" onClick={() => removeAll(true)} className="col-span-2 sm:col-span-1">Hapus Terpakai</Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Belum ada kode</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 max-h-[500px] overflow-y-auto">
            {filtered.map((t) => (
              <div key={t.id} className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${t.used ? "bg-muted border-border opacity-60" : "bg-background border-accent/30"}`}>
                <div className="min-w-0">
                  <div className="font-mono font-bold text-sm tracking-wider">{t.code}</div>
                  {t.label && <div className="text-xs text-muted-foreground truncate">{t.label}</div>}
                </div>
                <div className="flex items-center gap-1">
                  {t.used ? <Check className="w-4 h-4 text-muted-foreground" /> : <X className="w-4 h-4 text-accent" />}
                  <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border shadow-soft ${accent ? "bg-gold text-accent-foreground border-accent" : "bg-card border-border"}`}>
      <div className="text-xs opacity-75">{label}</div>
      <div className="font-display text-3xl font-semibold">{value}</div>
    </div>
  );
}
