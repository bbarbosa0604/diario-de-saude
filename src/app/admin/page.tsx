"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type AdminUser = { id: string; email?: string; name: string | null; createdAt: string; lastSignInAt: string | null; totalEvents: number; activeDays: number; lastActivity: string | null };

const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) { setError("Supabase não configurado."); setLoading(false); return; }
    void client.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace("/login?next=/admin"); return; }
      const response = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const result = await response.json() as { users?: AdminUser[]; totalUsers?: number; error?: string };
      if (!response.ok) setError(result.error || "Não foi possível carregar o painel.");
      else { setUsers(result.users || []); setTotalUsers(result.totalUsers || 0); }
      setLoading(false);
    });
  }, [router]);

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f9f7f3] text-sm text-[#698076]">Carregando painel…</main>;
  return <main className="min-h-screen bg-[#f9f7f3] text-[#2c2c2c]"><div className="mx-auto max-w-6xl px-5 pb-12 sm:px-8"><header className="flex items-center gap-3 border-b border-[#e8f5f2] py-5"><Link href="/profile" className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl text-[#1b8b6f] shadow-sm">‹</Link><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1b8b6f]">Meuintestino</p><h1 className="text-2xl font-bold">Painel administrativo</h1></div></header>{error ? <section className="mt-7 rounded-3xl bg-[#fae8e5] p-5 text-sm text-[#9b4438]">{error}</section> : <><section className="mt-7 grid gap-4 sm:grid-cols-3"><AdminMetric label="Usuários cadastrados" value={totalUsers} icon="👥" /><AdminMetric label="Usuários com registros" value={users.filter((user) => user.totalEvents > 0).length} icon="◷" /><AdminMetric label="Eventos registrados" value={users.reduce((sum, user) => sum + user.totalEvents, 0)} icon="✦" /></section><section className="mt-7 overflow-hidden rounded-3xl border border-[#e8f5f2] bg-white shadow-sm"><div className="border-b border-[#edf2ed] p-5"><h2 className="text-xl font-bold">Uso da plataforma</h2><p className="mt-1 text-sm text-[#698076]">Frequência calculada a partir dos eventos registrados por cada usuário.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#f7faf7] text-xs uppercase tracking-wide text-[#819189]"><tr><th className="px-5 py-3">Usuário</th><th className="px-5 py-3">Cadastro</th><th className="px-5 py-3">Último acesso</th><th className="px-5 py-3">Dias ativos</th><th className="px-5 py-3">Eventos</th><th className="px-5 py-3">Última atividade</th></tr></thead><tbody className="divide-y divide-[#edf2ed]">{users.map((user) => <tr key={user.id} className="align-top"><td className="px-5 py-4"><p className="font-semibold text-[#38624c]">{user.name || "Sem nome"}</p><p className="mt-1 text-xs text-[#819189]">{user.email}</p></td><td className="px-5 py-4 text-[#698076]">{dateTime(user.createdAt)}</td><td className="px-5 py-4 text-[#698076]">{dateTime(user.lastSignInAt)}</td><td className="px-5 py-4 font-semibold text-[#1b8b6f]">{user.activeDays}</td><td className="px-5 py-4 font-semibold text-[#1b8b6f]">{user.totalEvents}</td><td className="px-5 py-4 text-[#698076]">{dateTime(user.lastActivity)}</td></tr>)}</tbody></table>{users.length === 0 && <p className="p-6 text-sm text-[#698076]">Nenhum usuário encontrado.</p>}</div></section></>}</div></main>;
}

function AdminMetric({ label, value, icon }: { label: string; value: number; icon: string }) {
  return <article className="rounded-3xl border border-[#e8f5f2] bg-white p-5 shadow-sm"><span className="text-xl">{icon}</span><p className="mt-4 text-3xl font-bold text-[#1b8b6f]">{value}</p><p className="mt-1 text-sm text-[#698076]">{label}</p></article>;
}
