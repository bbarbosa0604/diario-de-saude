"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export default function VerifyPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEmail(new URLSearchParams(window.location.search).get("email") ?? "");
  }, []);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(null); setMessage(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (verifyError) setError(verifyError.message);
    else { setMessage("E-mail validado com sucesso."); window.setTimeout(() => router.replace("/"), 500); }
    setBusy(false);
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#fcfcf9] px-5 text-[#18342b]">
    <section className="w-full max-w-md rounded-[30px] border border-[#e6ebe5] bg-white p-6 shadow-[0_12px_40px_rgba(32,62,45,0.08)]">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e6f1e9] text-2xl">✉️</div>
      <p className="mt-6 text-sm font-medium text-[#698076]">Meuintestino</p>
      <h1 className="mt-1 text-2xl font-semibold">Confirme seu e-mail</h1>
      <p className="mt-2 text-sm leading-relaxed text-[#698076]">Enviamos um código de 6 dígitos para validar sua conta.</p>
      {!isSupabaseConfigured() ? <p className="mt-5 rounded-2xl bg-[#fff4db] p-4 text-sm text-[#765d2c]">O Supabase ainda não está configurado neste ambiente.</p> : <form onSubmit={verify} className="mt-6 space-y-3">
        <label className="block text-sm font-semibold">E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 block w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-base" /></label>
        <label className="block text-sm font-semibold">Código de validação<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 block w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-center text-2xl tracking-[0.5em]" placeholder="000000" /></label>
        <button disabled={busy} className="w-full rounded-2xl bg-[#1e6341] py-4 font-semibold text-white">{busy ? "Validando…" : "Validar e acessar"}</button>
      </form>}
      {error && <p className="mt-3 rounded-xl bg-[#fae8e5] p-3 text-sm text-[#9b4438]">{error}</p>}
      {message && <p className="mt-3 rounded-xl bg-[#e9f3eb] p-3 text-sm text-[#38624c]">{message}</p>}
      <button type="button" onClick={() => router.replace("/login")} className="mt-5 text-sm font-semibold text-[#39734f]">Voltar para o login</button>
    </section>
  </main>;
}
