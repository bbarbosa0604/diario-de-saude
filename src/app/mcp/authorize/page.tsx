"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function McpAuthorizePage() {
  const [status, setStatus] = useState("Verificando sua sessão…");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setStatus("O login do Meu Intestino não está configurado."); return; }
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        const next = `/mcp/authorize?${params.toString()}`;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
        return;
      }
      setStatus("Autorizando acesso seguro…");
      const response = await fetch("/api/mcp/oauth/authorize", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(Object.fromEntries(params.entries())) });
      const result = await response.json() as { redirect_uri?: string; error?: string };
      if (!response.ok || !result.redirect_uri) { setStatus(result.error || "Não foi possível autorizar o MCP."); return; }
      window.location.href = result.redirect_uri;
    });
  }, []);
  return <main className="grid min-h-screen place-items-center bg-[#fcfcf9] px-5 text-center text-[#18342b]"><section className="max-w-md rounded-3xl bg-white p-8 shadow-lg"><div className="text-4xl">🌿</div><h1 className="mt-4 text-2xl font-semibold">Autorizar Meu Intestino</h1><p className="mt-3 text-sm text-[#698076]">{status}</p></section></main>;
}
