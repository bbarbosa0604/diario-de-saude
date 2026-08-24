"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function McpConnectionPage() {
  const router = useRouter();
  const [endpoint, setEndpoint] = useState("https://www.meuintestino.app/api/mcp");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) { setLoading(false); return; }
    void client.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login?next=/mcp");
      else {
        setEndpoint(`${window.location.origin}/api/mcp`);
        setLoading(false);
      }
    });
  }, [router]);

  async function copyEndpoint() {
    await navigator.clipboard.writeText(endpoint);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f9f7f3] text-sm text-[#698076]">Carregando integração…</main>;

  return <main className="min-h-screen bg-[#f9f7f3] text-[#2c2c2c]"><div className="mx-auto max-w-2xl px-5 pb-12 sm:px-8">
    <header className="flex items-center gap-3 border-b border-[#e8f5f2] py-5"><Link href="/profile" className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl text-[#1b8b6f] shadow-sm" aria-label="Voltar">‹</Link><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1b8b6f]">Meuintestino</p><h1 className="text-2xl font-bold">Conectar ao Claude</h1></div></header>
    <section className="mt-7 rounded-[28px] bg-gradient-to-br from-[#e8f5f2] to-[#d4f5ed] p-6"><div className="flex items-start gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-2xl shadow-sm">◈</span><div><p className="text-sm font-semibold text-[#1b8b6f]">Integração via MCP</p><h2 className="mt-1 text-2xl font-bold text-[#245443]">Seu diário no Claude, com segurança</h2><p className="mt-3 text-sm leading-relaxed text-[#527063]">O Claude poderá consultar os eventos e relatórios do seu Meuintestino. Ele só terá acesso depois que você autorizar a conexão.</p></div></div></section>
    <section className="mt-5 rounded-3xl border border-[#e8f5f2] bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1b8b6f]">Endereço do servidor</p><p className="mt-2 text-sm text-[#698076]">Copie este endereço e adicione-o como servidor MCP nas integrações do Claude.</p><div className="mt-4 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-[#f2f6f2] px-3 py-3 text-xs text-[#38624c]">{endpoint}</code><button type="button" onClick={() => void copyEndpoint()} className="shrink-0 rounded-xl bg-[#1b8b6f] px-3 py-2 text-xs font-semibold text-white">{copied ? "Copiado" : "Copiar"}</button></div></section>
    <section className="mt-5 rounded-3xl border border-[#e8f5f2] bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Como conectar</h2><ol className="mt-4 space-y-4 text-sm leading-relaxed text-[#527063]"><li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e8f5f2] font-bold text-[#1b8b6f]">1</span><span>Abra as configurações do Claude e procure por <strong>Integrações</strong> ou <strong>Conectores</strong>.</span></li><li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e8f5f2] font-bold text-[#1b8b6f]">2</span><span>Adicione um servidor MCP remoto e cole o endereço acima.</span></li><li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e8f5f2] font-bold text-[#1b8b6f]">3</span><span>Quando o Claude solicitar, autorize com sua conta Meuintestino. Não compartilhe tokens manualmente.</span></li></ol></section>
    <section className="mt-5 rounded-3xl border border-[#e8f5f2] bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">O que fica disponível</h2><div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-2xl bg-[#f7faf7] p-3 text-sm text-[#527063]">📅 Eventos por dia</div><div className="rounded-2xl bg-[#f7faf7] p-3 text-sm text-[#527063]">✦ Resumos salvos</div><div className="rounded-2xl bg-[#f7faf7] p-3 text-sm text-[#527063]">▣ Relatórios por período</div></div><p className="mt-4 text-xs leading-relaxed text-[#819189]">A conexão é somente leitura. O MCP não cria, edita ou exclui registros. Cada usuário acessa exclusivamente os próprios dados.</p></section>
    <Link href="/" className="mt-6 block text-center text-sm font-semibold text-[#1b8b6f]">Voltar ao diário</Link>
  </div></main>;
}
