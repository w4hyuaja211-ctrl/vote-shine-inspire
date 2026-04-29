import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Sparkles, Award, ShieldCheck, ArrowRight } from "lucide-react";
import heroImg from "@/assets/hero.jpg";
import VoteFlow from "@/components/voting/VoteFlow";

const Index = () => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [activeCode, setActiveCode] = useState<string>("");

  const handleStart = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      toast.error("Masukkan kode voting Anda");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("validate_token", { _code: trimmed });
    setLoading(false);
    if (error) {
      toast.error("Terjadi kesalahan");
      return;
    }
    const row = (data as any[])?.[0];
    if (!row) {
      toast.error("Kode tidak ditemukan");
      return;
    }
    if (row.used) {
      toast.error("Kode ini sudah digunakan");
      return;
    }
    setTokenId(row.token_id);
    setActiveCode(trimmed);
  };

  if (tokenId) {
    return <VoteFlow code={activeCode} onDone={() => { setTokenId(null); setCode(""); setActiveCode(""); }} />;
  }

  return (
    <div className="min-h-screen bg-background islamic-pattern">
      {/* Hero */}
      <header className="relative overflow-hidden bg-hero text-primary-foreground">
        <div className="absolute inset-0 opacity-30">
          <img src={heroImg} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        <div className="relative container mx-auto px-6 py-20 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/40 bg-accent/10 backdrop-blur-sm mb-6 animate-fade-up">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium tracking-wide">Penghargaan Tahunan Sekolah</span>
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-semibold mb-4 animate-fade-up">
            Anugerah <span className="gradient-text-gold">Guru & Karyawan</span>
            <br />Ter-Inspiratif
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto mb-10 animate-fade-up">
            Apresiasi tertinggi untuk pendidik dan karyawan terbaik. Pilih satu nominasi di setiap dari 10 kategori.
          </p>

          <div className="max-w-md mx-auto bg-card/95 backdrop-blur p-6 rounded-2xl shadow-elegant animate-fade-up">
            <label className="text-sm font-medium text-card-foreground block mb-2 text-left">
              Masukkan Kode Voting Anda
            </label>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Contoh: ABC123"
                className="text-center font-mono tracking-widest text-lg uppercase"
                maxLength={20}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
              />
              <Button onClick={handleStart} disabled={loading} variant="hero" size="lg">
                {loading ? "..." : <ArrowRight className="w-5 h-5" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-left">
              Kode diberikan oleh panitia. Setiap kode hanya bisa digunakan satu kali.
            </p>
          </div>
        </div>
      </header>

      {/* Petunjuk Memilih */}
      <section className="container mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="font-display text-4xl md:text-5xl font-semibold mb-3">
            Petunjuk <span className="gradient-text-gold">Memilih</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Ikuti langkah-langkah berikut untuk memberikan suara Anda secara sah.
          </p>
        </div>

        <ol className="max-w-3xl mx-auto space-y-3 mb-12">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-4 p-4 bg-card border border-border rounded-xl shadow-soft">
              <div className="w-9 h-9 rounded-full bg-gold text-accent-foreground font-display text-lg font-semibold flex items-center justify-center shrink-0">
                {i + 1}
              </div>
              <div>
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="text-center mb-8">
          <h2 className="font-display text-3xl md:text-4xl font-semibold mb-3">
            10 Kategori <span className="gradient-text-gold">Penghargaan</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Berikut deskripsi tiap kategori. Anda memilih satu nominasi favorit di setiap kategori.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
          {CATEGORIES.map((c, i) => (
            <div
              key={c.name}
              className="flex gap-4 p-5 rounded-xl bg-card-elegant border border-border shadow-soft hover:shadow-elegant transition-smooth"
            >
              <div className="w-10 h-10 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">#{i + 1}</span>
                  <h3 className="font-display text-xl font-semibold text-foreground">{c.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 mt-12">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Anugerah Guru & Karyawan Ter-Inspiratif</p>
          <Link to="/admin" className="inline-flex items-center gap-2 hover:text-accent transition-smooth">
            <ShieldCheck className="w-4 h-4" /> Panel Admin
          </Link>
        </div>
      </footer>
    </div>
  );
};

const STEPS = [
  { title: "Dapatkan kode voting Anda", desc: "Kode unik diberikan oleh panitia. Setiap pemilih hanya menerima satu kode dan kode tersebut hanya berlaku sekali pakai." },
  { title: "Masukkan kode di kolom di atas", desc: "Ketik kode dengan tepat (huruf besar/kecil tidak masalah) lalu tekan tombol panah untuk memulai." },
  { title: "Pilih satu nominasi di setiap dari 10 kategori", desc: "Untuk setiap kategori, pilih SATU guru atau karyawan yang menurut Anda paling layak. Gunakan kolom pencarian untuk menemukan nama dengan cepat." },
  { title: "Periksa kembali pilihan Anda", desc: "Anda dapat menekan \"Sebelumnya\" untuk meninjau atau mengganti pilihan sebelum mengirim." },
  { title: "Kirim semua suara", desc: "Setelah seluruh 10 kategori terisi, klik \"Kirim Semua Suara\". Suara akan tercatat secara anonim dan kode otomatis tidak bisa dipakai lagi." },
];

const CATEGORIES = [
  { name: "Ter-Inspiratif", desc: "Mampu memberi motivasi, semangat, dan keteladanan kepada siswa serta rekan kerja." },
  { name: "Ter-Sabar", desc: "Tetap tenang dan sabar dalam menghadapi berbagai karakter dan tingkah laku siswa." },
  { name: "Ter-Ramah", desc: "Humble, murah senyum, dan menciptakan suasana yang nyaman bagi siapa pun di sekolah." },
  { name: "Ter-Inovatif", desc: "Sering menciptakan ide baru, metode baru, dan gagasan kreatif untuk kemajuan sekolah." },
  { name: "Ter-Fashionable", desc: "Memiliki gaya mengajar dan penampilan yang menarik, rapi, dan modis namun tetap sopan." },
  { name: "Ter-Favorit", desc: "Paling disukai dan dirindukan siswa karena kedekatan, perhatian, dan cara mengajarnya." },
  { name: "Ter-Humoris", desc: "Mampu mencairkan suasana dengan humor sehat sehingga belajar terasa menyenangkan." },
  { name: "Ter-Disiplin", desc: "Memiliki tanggung jawab profesional tinggi, terutama dalam kehadiran dan ketepatan waktu." },
  { name: "Ter-Islami", desc: "Senantiasa mencerminkan nilai-nilai ajaran Islam dalam sikap, ucapan, maupun tindakan." },
  { name: "Ter-Tegas", desc: "Mampu menegakkan aturan dan disiplin secara konsisten tanpa bersikap keras atau menakutkan." },
];

export default Index;
