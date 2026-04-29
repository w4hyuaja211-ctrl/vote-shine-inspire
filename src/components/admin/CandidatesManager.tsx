import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, User, Search } from "lucide-react";
import { toast } from "sonner";

interface Candidate { id: string; name: string; role_type: string; photo_url: string | null; bio: string | null; }

export default function CandidatesManager() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [form, setForm] = useState({ name: "", role_type: "guru", photo_url: "", bio: "" });
  const [q, setQ] = useState("");

  const load = async () => {
    const { data } = await supabase.from("candidates").select("*").order("name");
    setCandidates(data || []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", role_type: "guru", photo_url: "", bio: "" });
    setOpen(true);
  };

  const openEdit = (c: Candidate) => {
    setEditing(c);
    setForm({ name: c.name, role_type: c.role_type, photo_url: c.photo_url || "", bio: c.bio || "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nama wajib diisi");
    const payload = { ...form, photo_url: form.photo_url || null, bio: form.bio || null };
    if (editing) {
      const { error } = await supabase.from("candidates").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("candidates").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Tersimpan");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus nominasi ini?")) return;
    const { error } = await supabase.from("candidates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dihapus");
    load();
  };

  const filtered = candidates.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
        <h2 className="font-display text-2xl">Nominasi ({candidates.length})</h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama..." className="pl-9 w-56" />
          </div>
          <Button onClick={openNew} variant="hero"><Plus className="w-4 h-4 mr-1" /> Tambah</Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Catatan: setiap nominasi otomatis ikut di <b>10 kategori</b>.
      </p>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12 bg-card rounded-xl border border-border">
          {candidates.length === 0 ? "Belum ada nominasi. Klik \"Tambah\" untuk membuat." : "Tidak ada yang cocok."}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className="p-4 bg-card border border-border rounded-xl flex gap-3 shadow-soft">
              <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0">
                {c.photo_url ? <img src={c.photo_url} alt={c.name} className="w-full h-full object-cover" /> : <User className="w-7 h-7 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{c.name}</h3>
                <p className="text-xs text-muted-foreground capitalize">{c.role_type}</p>
                <div className="flex gap-1 mt-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(c)}><Edit className="w-3 h-3" /></Button>
                  <Button size="sm" variant="outline" onClick={() => remove(c.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Tambah"} Nominasi</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nama</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Tipe</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3"
                value={form.role_type}
                onChange={(e) => setForm({ ...form, role_type: e.target.value })}
              >
                <option value="guru">Guru</option>
                <option value="karyawan">Karyawan</option>
              </select>
            </div>
            <div>
              <Label>URL Foto (opsional)</Label>
              <Input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>Bio singkat (opsional)</Label>
              <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={2} />
            </div>
            <Button onClick={save} variant="hero" className="w-full">Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
