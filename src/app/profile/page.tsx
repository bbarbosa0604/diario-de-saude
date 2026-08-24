"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) { setBusy(false); return; }
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace("/login"); return; }
      setUser(data.user);
      setName(String(data.user.user_metadata?.full_name || ""));
      setBirthDate(String(data.user.user_metadata?.birth_date || ""));
      const storedPath = data.user.user_metadata?.avatar_path;
      if (storedPath) {
        setAvatarPath(storedPath);
        const { data: signed } = await supabase.storage.from("profile-photos").createSignedUrl(storedPath, 3600);
        if (signed?.signedUrl) setAvatarPreview(signed.signedUrl);
      }
      setBusy(false);
    });
  }, [router, supabase]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    setBusy(true); setError(null); setMessage(null);
    let nextAvatarPath = avatarPath;
    if (avatarFile) {
      nextAvatarPath = `${user.id}/avatar-${Date.now()}-${avatarFile.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error: uploadError } = await supabase.storage.from("profile-photos").upload(nextAvatarPath, avatarFile, { upsert: true });
      if (uploadError) { setError(`Não foi possível enviar a foto: ${uploadError.message}`); setBusy(false); return; }
      const { data: signed } = await supabase.storage.from("profile-photos").createSignedUrl(nextAvatarPath, 3600);
      if (signed?.signedUrl) setAvatarPreview(signed.signedUrl);
    }
    const { error: updateError } = await supabase.auth.updateUser({ data: { full_name: name.trim(), birth_date: birthDate || null, avatar_path: nextAvatarPath } });
    if (updateError) setError(updateError.message);
    else { setAvatarPath(nextAvatarPath); setAvatarFile(null); setMessage("Dados da conta atualizados."); }
    setBusy(false);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!isSupabaseConfigured()) return <main className="flex min-h-screen items-center justify-center bg-[#fcfcf9] px-5 text-[#18342b]"><section className="max-w-md rounded-3xl bg-white p-6 text-center shadow-lg"><h1 className="text-xl font-semibold">Meuintestino</h1><p className="mt-3 text-sm text-[#698076]">Configure o Supabase para editar os dados da conta.</p></section></main>;
  if (busy && !user) return <main className="grid min-h-screen place-items-center bg-[#fcfcf9] text-sm text-[#698076]">Carregando sua conta…</main>;

  return <main className="mx-auto min-h-screen max-w-md bg-[#fcfcf9] px-5 pb-10 text-[#18342b]">
    <header className="flex items-center gap-3 pt-8"><button type="button" onClick={() => router.back()} className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl">‹</button><div><p className="text-sm text-[#698076]">Meuintestino</p><h1 className="text-2xl font-semibold">Minha conta</h1></div></header>
    <form onSubmit={save} className="mt-7 space-y-5">
      <div className="flex items-center gap-4 rounded-3xl border border-[#e6ebe5] bg-white p-5"><div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e6f1e9] text-3xl">{avatarPreview ? <img src={avatarPreview} alt="Foto do perfil" className="h-full w-full object-cover" /> : "🌿"}</div><label className="cursor-pointer text-sm font-semibold text-[#39734f]">{avatarFile ? "Trocar foto" : "Adicionar foto"}<input type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); }} /></label></div>
      <label className="block text-sm font-semibold">Nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Como você gostaria de ser chamado?" className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" /></label>
      <label className="block text-sm font-semibold">Data de nascimento<input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" /></label>
      <div className="rounded-xl bg-[#f2f6f2] p-3 text-xs text-[#698076]">E-mail da conta: <span className="font-semibold">{user?.email}</span></div>
      <button disabled={busy} className="w-full rounded-2xl bg-[#1e6341] py-4 font-semibold text-white">{busy ? "Salvando…" : "Salvar alterações"}</button>
      {message && <p className="rounded-xl bg-[#e9f3eb] p-3 text-sm text-[#38624c]">{message}</p>}
      {error && <p className="rounded-xl bg-[#fae8e5] p-3 text-sm text-[#9b4438]">{error}</p>}
    </form>
    <button type="button" onClick={signOut} className="mt-8 w-full rounded-2xl border border-[#efc9c2] bg-white py-4 font-semibold text-[#a34a3d]">Sair da conta</button>
  </main>;
}
