import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Sparkles } from "lucide-react";
import CandidatesManager from "@/components/admin/CandidatesManager";
import TokensManager from "@/components/admin/TokensManager";
import ResultsView from "@/components/admin/ResultsView";
import VotersView from "@/components/admin/VotersView";

async function checkAdminRole() {
  const { data, error } = await (supabase as any).rpc("current_user_admin_status");

  if (error) return { isAdmin: false, email: "", error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  return { isAdmin: Boolean(row?.is_admin), email: row?.user_email || "", error: "" };
}

export default function AdminDashboard() {
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [accessError, setAccessError] = useState("");

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

  const logout = async () => {
    await supabase.auth.signOut();
    nav("/admin/auth", { replace: true });
  };

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
            Akun <span className="font-mono text-foreground">{email}</span> belum memiliki role admin.
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Tambahkan baris di tabel <code className="px-1 bg-muted rounded">user_roles</code> dengan role <code className="px-1 bg-muted rounded">admin</code> untuk akun ini melalui dashboard backend.
          </p>
          <Button onClick={logout} variant="outline">Keluar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-hero text-primary-foreground shadow-elegant">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-accent" />
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold">Panel Admin</h1>
              <p className="text-xs opacity-75 truncate">{email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={logout} className="w-full sm:w-auto bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
            <LogOut className="w-4 h-4 mr-1" /> Keluar
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <Tabs defaultValue="results">
          <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:w-auto sm:flex-wrap">
            <TabsTrigger value="results">Hasil Voting</TabsTrigger>
            <TabsTrigger value="voters">Rekap Pemilih</TabsTrigger>
            <TabsTrigger value="candidates">Nominasi</TabsTrigger>
            <TabsTrigger value="tokens">Kode Voting</TabsTrigger>
          </TabsList>
          <TabsContent value="results"><ResultsView /></TabsContent>
          <TabsContent value="voters"><VotersView /></TabsContent>
          <TabsContent value="candidates"><CandidatesManager /></TabsContent>
          <TabsContent value="tokens"><TokensManager /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
