import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Award, Sparkles, User } from "lucide-react";
import VotingStatusBanner from "@/components/VotingStatusBanner";
import { useVotingStatus } from "@/hooks/use-voting-status";

interface Category { id: string; name: string; description: string | null; display_order: number; }
interface Candidate { id: string; name: string; role_type: string; photo_url: string | null; }
interface Props { code: string; onDone: () => void; }

export default function VoteFlow({ code, onDone }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [cats, cands] = await Promise.all([
        supabase.from("categories").select("*").order("display_order"),
        supabase.from("candidates").select("*").order("name"),
      ]);
      setCategories(cats.data || []);
      setCandidates(cands.data || []);
      setLoading(false);
    })();
  }, []);

  const currentCat = categories[step];
  const eligible = useMemo(
    () => candidates.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [candidates, search]
  );

  const select = (cid: string) => {
    if (!currentCat) return;
    setSelections((s) => ({ ...s, [currentCat.id]: cid }));
  };

  const next = () => {
    if (!currentCat) return;
    if (!selections[currentCat.id]) {
      toast.error("Silakan pilih satu nominasi");
      return;
    }
    if (step < categories.length - 1) {
      setStep(step + 1);
      setSearch("");
    }
  };

  const submit = async () => {
    if (Object.keys(selections).length !== categories.length) {
      toast.error("Lengkapi semua kategori dulu");
      return;
    }
    setSubmitting(true);
    const payload = categories.map((c) => ({ category_id: c.id, candidate_id: selections[c.id] }));
    const { data, error } = await supabase.rpc("submit_votes", { _code: code, _votes: payload });
    setSubmitting(false);
    if (error || !(data as any)?.success) {
      toast.error((data as any)?.error || "Gagal mengirim suara");
      return;
    }
    setDone(true);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Memuat...</div>;
  }

  if (categories.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <h2 className="font-display text-3xl mb-3">Belum ada kategori</h2>
          <p className="text-muted-foreground mb-6">Admin belum menyiapkan data voting.</p>
          <Button onClick={onDone}>Kembali</Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hero text-primary-foreground p-6">
        <div className="text-center max-w-md animate-fade-up">
          <div className="w-24 h-24 rounded-full bg-accent text-accent-foreground flex items-center justify-center mx-auto mb-6 shadow-gold">
            <Check className="w-12 h-12" strokeWidth={3} />
          </div>
          <h2 className="font-display text-5xl mb-4">Terima Kasih!</h2>
          <p className="text-lg opacity-90 mb-8">
            Suara Anda telah berhasil tercatat. Semoga pilihan terbaik mendapatkan penghargaan.
          </p>
          <Button onClick={onDone} variant="gold" size="lg">Selesai</Button>
        </div>
      </div>
    );
  }

  const isLast = step === categories.length - 1;
  const completedCount = Object.keys(selections).length;

  return (
    <div className="min-h-screen bg-background islamic-pattern">
      {/* Top bar */}
      <div className="bg-hero text-primary-foreground sticky top-0 z-10 shadow-elegant">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              <span className="text-sm font-medium">Kategori {step + 1} / {categories.length}</span>
            </div>
            <span className="text-xs opacity-75">{completedCount} dari {categories.length} terpilih</span>
          </div>
          <div className="h-1.5 bg-primary-foreground/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-gold transition-smooth"
              style={{ width: `${((step + 1) / categories.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8 animate-fade-up">
          <Award className="w-10 h-10 text-accent mx-auto mb-3" />
          <h2 className="font-display text-4xl md:text-5xl font-semibold mb-2">
            <span className="gradient-text-gold">{currentCat.name}</span>
          </h2>
          {currentCat.description && (
            <p className="text-muted-foreground max-w-xl mx-auto">{currentCat.description}</p>
          )}
        </div>

        <div className="max-w-md mx-auto mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Cari nama nominasi..."
            autoCorrect="off"
            spellCheck={false}
            className="w-full h-12 px-4 rounded-lg border-2 border-input bg-background text-foreground text-base placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent"
          />
          {selections[currentCat.id] && (
            <p className="text-xs text-center mt-2 text-accent-foreground bg-accent/20 rounded px-2 py-1">
              ✓ Terpilih: <b>{candidates.find((c) => c.id === selections[currentCat.id])?.name}</b>
            </p>
          )}
        </div>

        {eligible.length === 0 ? (
          <div className="text-center p-12 rounded-xl bg-card border border-border">
            <p className="text-muted-foreground">Tidak ada nominasi yang cocok.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {eligible.map((c) => {
              const selected = selections[currentCat.id] === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => select(c.id)}
                  className={`group relative p-4 rounded-xl border-2 text-left transition-smooth ${
                    selected
                      ? "border-accent bg-accent/10 shadow-gold scale-[1.02]"
                      : "border-border bg-card hover:border-accent/50 hover:-translate-y-1 shadow-soft"
                  }`}
                >
                  {selected && (
                    <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                      <Check className="w-4 h-4" strokeWidth={3} />
                    </div>
                  )}
                  <div className="aspect-[9/16] rounded-lg bg-muted overflow-hidden mb-3 flex items-center justify-center">
                    {c.photo_url ? (
                      <img src={c.photo_url} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <User className="w-12 h-12 text-muted-foreground" />
                    )}
                  </div>
                  <h3 className="font-display text-lg font-semibold leading-tight">{c.name}</h3>
                  <p className="text-xs text-muted-foreground capitalize mt-1">{c.role_type}</p>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between mt-10 gap-4">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Sebelumnya
          </Button>

          {isLast ? (
            <Button onClick={submit} disabled={submitting} variant="gold" size="lg">
              {submitting ? "Mengirim..." : "Kirim Semua Suara"}
            </Button>
          ) : (
            <Button onClick={next} variant="hero">
              Berikutnya <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
