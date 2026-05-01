import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, CalendarClock } from "lucide-react";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

export default function ScheduleSettings() {
  const [id, setId] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("voting_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (data) {
      setId(data.id);
      setStartsAt(toLocalInput(data.starts_at));
      setEndsAt(toLocalInput(data.ends_at));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    const payload = {
      starts_at: fromLocalInput(startsAt),
      ends_at: fromLocalInput(endsAt),
      updated_at: new Date().toISOString(),
    };
    const q = id
      ? (supabase as any).from("voting_settings").update(payload).eq("id", id)
      : (supabase as any).from("voting_settings").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Jadwal voting tersimpan");
  };

  if (loading) return <p className="text-center py-12">Memuat...</p>;

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <CalendarClock className="w-5 h-5 text-accent" />
        <h2 className="font-display text-xl font-semibold">Jadwal Voting</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Kosongkan keduanya untuk membiarkan voting selalu terbuka. Jika hanya salah satu yang diisi,
        sisi lainnya tidak dibatasi.
      </p>

      <div className="space-y-2">
        <Label htmlFor="starts_at">Mulai</Label>
        <Input
          id="starts_at"
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className="h-12"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ends_at">Berakhir</Label>
        <Input
          id="ends_at"
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
          className="h-12"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={save} disabled={saving} variant="hero" className="w-full sm:w-auto">
          <Save className="w-4 h-4 mr-1" /> {saving ? "Menyimpan..." : "Simpan Jadwal"}
        </Button>
        <Button
          variant="outline"
          onClick={() => { setStartsAt(""); setEndsAt(""); }}
          className="w-full sm:w-auto"
        >
          Reset (Selalu Buka)
        </Button>
      </div>
    </div>
  );
}
