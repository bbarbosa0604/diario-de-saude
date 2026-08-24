"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/");
    });
  }, [router, supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    if (result.error) setError(result.error.message);
    else if (mode === "signup" && !result.data.session) setMessage("Cadastro criado. Verifique seu e-mail antes de entrar.");
    else router.replace("/");
    setBusy(false);
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#fcfcf9] px-5 text-[#18342b]">
    <section className="w-full max-w-md rounded-[30px] border border-[#e6ebe5] bg-white p-6 shadow-[0_12px_40px_rgba(32,62,45,0.08)]">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e6f1e9] text-2xl">🌿</div>
      <p className="mt-6 text-sm font-medium text-[#698076]">Meuintestino</p>
      <h1 className="mt-1 text-2xl font-semibold">{mode === "signin" ? "Entre no seu diário" : "Crie seu acesso"}</h1>
      <p className="mt-2 text-sm leading-relaxed text-[#698076]">Entenda seus padrões com seus próprios registros. Seus dados ficam associados à sua conta e protegidos por usuário.</p>
      {!isSupabaseConfigured() ? <p className="mt-5 rounded-2xl bg-[#fff4db] p-4 text-sm leading-relaxed text-[#765d2c]">O Supabase ainda não está configurado neste ambiente. Adicione as variáveis públicas no `.env.local` para ativar o login.</p> : <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block text-sm font-semibold">E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 block w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-base" placeholder="seu@email.com" /></label>
        <label className="block text-sm font-semibold">Senha<input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 block w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-base" placeholder="Mínimo de 6 caracteres" /></label>
        <button disabled={busy} className="w-full rounded-2xl bg-[#1e6341] py-4 font-semibold text-white">{busy ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}</button>
      </form>}
      {error && <p className="mt-3 rounded-xl bg-[#fae8e5] p-3 text-sm text-[#9b4438]">{error}</p>}
      {message && <p className="mt-3 rounded-xl bg-[#e9f3eb] p-3 text-sm text-[#38624c]">{message}</p>}
      {isSupabaseConfigured() && <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setMessage(null); }} className="mt-5 text-sm font-semibold text-[#39734f]">{mode === "signin" ? "Ainda não tenho conta" : "Já tenho uma conta"}</button>}
    </section>
  </main>;
}
