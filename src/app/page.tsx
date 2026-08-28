"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

type EventKind = "meal" | "symptom" | "bowel" | "urine" | "stress" | "tea" | "medication" | "water" | "weight" | "sleep" | "exercise" | "note";

type TimelineEvent = {
  id: string;
  kind: EventKind;
  date?: string;
  time: string;
  title: string;
  detail: string;
  badge?: string;
  tags?: string[];
  photoFile?: File;
  photoPath?: string;
};

function localDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

const today = localDateString();

const initialEvents: TimelineEvent[] = [
  {
    id: "1",
    kind: "meal",
    date: today,
    time: "12:15",
    title: "Almoço",
    detail: "Arroz, grão-de-bico, castanha e abacate",
    tags: ["leguminosas", "castanhas", "abacate"],
  },
  {
    id: "2",
    kind: "symptom",
    date: today,
    time: "14:05",
    title: "Cólica",
    detail: "Intensidade 6 de 10",
    badge: "6/10",
  },
  {
    id: "3",
    kind: "bowel",
    date: today,
    time: "14:25",
    title: "Evacuação",
    detail: "Bristol 6 · urgência moderada",
    badge: "B6",
  },
];

const eventOptions: { kind: EventKind; icon: string; label: string; hint: string }[] = [
  { kind: "meal", icon: "🍽", label: "Refeição", hint: "O que você comeu?" },
  { kind: "bowel", icon: "🚽", label: "Evacuação", hint: "Bristol, urgência e foto" },
  { kind: "urine", icon: "💧", label: "Urina", hint: "Jato, cor e ardência" },
  { kind: "stress", icon: "🧠", label: "Estresse", hint: "Nível de estresse do dia" },
  { kind: "symptom", icon: "✦", label: "Sintoma", hint: "Cólica, gases ou outro" },
  { kind: "tea", icon: "🍵", label: "Chá", hint: "Tipo e quantidade" },
  { kind: "medication", icon: "💊", label: "Suplementação", hint: "Suplemento, vitamina ou enzima" },
  { kind: "water", icon: "💧", label: "Água", hint: "Quantidade ingerida" },
  { kind: "weight", icon: "⚖", label: "Peso", hint: "Medição do dia" },
  { kind: "sleep", icon: "☾", label: "Sono", hint: "Como você dormiu" },
  { kind: "exercise", icon: "🏃", label: "Atividade", hint: "Movimento ou exercício" },
  { kind: "note", icon: "📝", label: "Nota", hint: "Outro evento importante" },
];

function timeNow() {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export default function Home() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const configured = isSupabaseConfigured();
  // Dados de demonstração só aparecem quando o Supabase não está configurado.
  const [events, setEvents] = useState<TimelineEvent[]>(() => configured ? [] : initialEvents);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(configured);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<EventKind | null>(null);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeFilter, setActiveFilter] = useState<EventKind | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiLocked, setAiLocked] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const selectedDateLabel = selectedDate === today ? `Hoje, ${new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date())}` : new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date(`${selectedDate}T12:00:00`));
  const dayEvents = events.filter((event) => event.date === selectedDate);

  useEffect(() => {
    setAiSummary(null);
    setAiLocked(false);
    setAiError(null);
  }, [selectedDate]);

  async function evaluateDay() {
    if (aiLocked) return;
    setAiBusy(true); setAiError(null); setAiSummary(null);
    try {
      const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      if (!sessionData.session) { setAiError("Sua sessão expirou. Entre novamente para avaliar o dia."); return; }
      const response = await fetch("/api/ai/daily-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ date: selectedDate }),
      });
      const data = await response.json() as { summary?: string; error?: string };
      if (!response.ok) setAiError(data.error || "Não foi possível avaliar este dia.");
      else { setAiSummary(data.summary || null); setAiLocked(true); }
    } catch {
      setAiError("Não foi possível conectar à análise por IA.");
    } finally {
      setAiBusy(false);
    }
  }

  async function exportDayData() {
    const lines = [
      "Meu Intestino — REGISTRO DO DIA",
      `Data: ${selectedDate}`,
      "",
      "EVENTOS REGISTRADOS:",
      ...(dayEvents.length ? dayEvents.sort((a, b) => a.time.localeCompare(b.time)).map((event) => `- ${event.time} | ${event.kind} | ${event.title} | ${event.detail}${event.tags?.length ? ` | tags: ${event.tags.join(", ")}` : ""}`) : ["Nenhum evento registrado."]),
      "",
      "Observação: estes dados são registros pessoais e não representam um diagnóstico médico.",
    ];
    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `meuintestino-${selectedDate}.txt`; link.click();
    URL.revokeObjectURL(url);
    try { await navigator.clipboard.writeText(content); setExportMessage("Arquivo baixado e dados copiados. Agora você pode colar em outra IA."); }
    catch { setExportMessage("Arquivo baixado. Abra-o para copiar os dados para outra IA."); }
  }

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let mounted = true;
    async function fetchEventsDirect(userId: string, sessionToken?: string) {
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      let accessToken = sessionToken;
      if (!accessToken) {
        const { data: sessionData } = await client.auth.getSession();
        accessToken = sessionData.session?.access_token;
      }
      if (!baseUrl || !publishableKey || !accessToken) throw new Error("session");
      const query = new URLSearchParams({ select: "id,event_date,event_kind,event_time,title,detail,badge,tags,photo_path", user_id: `eq.${userId}`, order: "event_time.asc" });
      const response = await fetch(`${baseUrl}/rest/v1/health_events?${query.toString()}`, { headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      if (!response.ok) throw new Error(`REST ${response.status}`);
      return await response.json() as Array<{ id: string; event_date: string; event_kind: EventKind; event_time: string; title: string; detail: string; badge: string | null; tags: string[] | null; photo_path?: string | null }>;
    }
    async function fetchEventsThroughApp(userId: string, sessionToken?: string) {
      if (!sessionToken) throw new Error("session");
      const response = await fetch("/api/events", { headers: { Authorization: `Bearer ${sessionToken}` }, cache: "no-store" });
      if (!response.ok) throw new Error(`APP ${response.status}`);
      return await response.json() as Array<{ id: string; event_date: string; event_kind: EventKind; event_time: string; title: string; detail: string; badge: string | null; tags: string[] | null; photo_path?: string | null }>;
    }
    async function loadEvents(userId: string, sessionToken?: string) {
      try {
        const appRows = await Promise.race([
          fetchEventsThroughApp(userId, sessionToken),
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("app-timeout")), 7000)),
        ]);
        if (appRows.length > 0) {
          if (mounted) setEvents(appRows.map(mapDatabaseEvent));
          return;
        }
      } catch {
        // tenta os caminhos diretos abaixo
      }
      // O endpoint REST evita que uma instância do SDK fique presa no Chrome
      // mobile. Se ele falhar, mantemos a tentativa pelo SDK como fallback.
      try {
        const directRows = await Promise.race([
          fetchEventsDirect(userId, sessionToken),
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("rest-timeout")), 6000)),
        ]);
        // Uma resposta vazia pode ocorrer enquanto o token ainda está sendo
        // sincronizado no Chrome mobile; só encerramos aqui quando há dados.
        if (directRows.length > 0) {
          if (mounted) setEvents(directRows.map(mapDatabaseEvent));
          return;
        }
      } catch {
        // fallback abaixo
      }
      let result: { data: Array<{ id: string; event_date: string; event_kind: EventKind; event_time: string; title: string; detail: string; badge: string | null; tags: string[] | null; photo_path?: string | null }> | null; error: { message: string } | null };
      try {
        result = await Promise.race([
          client.from("health_events").select("id,event_date,event_kind,event_time,title,detail,badge,tags,photo_path").eq("user_id", userId).order("event_time", { ascending: true }),
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), 8000)),
        ]);
      } catch {
        const rows = await fetchEventsDirect(userId, sessionToken);
        if (mounted) setEvents(rows.map(mapDatabaseEvent));
        return;
      }
      if (!mounted) return;
      if (result.error) throw new Error(result.error.message);
      const sdkRows = result.data ?? [];
      if (sdkRows.length > 0) {
        setEvents(sdkRows.map(mapDatabaseEvent));
        return;
      }
      // Última tentativa depois da renovação/sincronização da sessão.
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      const retryRows = await fetchEventsDirect(userId, sessionToken);
      if (mounted) setEvents(retryRows.map(mapDatabaseEvent));
    }
    async function load() {
      try {
        // Recupera a sessão persistida primeiro. Em Chrome mobile, getUser pode
        // aguardar a rede mesmo com uma sessão válida já salva no navegador.
        const sessionResult = await Promise.race([
          client.auth.getSession(),
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("session-timeout")), 8000)),
        ]);
        let account = sessionResult.data.session?.user ?? null;
        if (!account) {
          const userResult = await Promise.race([
            client.auth.getUser(),
            new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("user-timeout")), 8000)),
          ]);
          account = userResult.data.user ?? null;
        }
        if (!account) { setUser(null); setEvents([]); setAuthLoading(false); return; }
        if (!mounted) return;
        setUser(account); setEvents([]); setAuthError(null);
        await loadEvents(account.id, sessionResult.data.session?.access_token);
      } catch {
        if (mounted) setAuthError("Não foi possível carregar seus registros. Verifique a conexão e tente novamente.");
      } finally { if (mounted) setAuthLoading(false); }
    }
    void load();
    const { data: authSubscription } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(true);
      if (session?.user) {
        setEvents([]);
        setAuthError(null);
        void loadEvents(session.user.id, session.access_token).catch(() => setAuthError("Não foi possível carregar seus registros. Verifique a conexão e tente novamente.")).finally(() => setAuthLoading(false));
      } else {
        setEvents([]);
        setAuthLoading(false);
      }
    });
    return () => { mounted = false; authSubscription.subscription.unsubscribe(); };
  }, [router, supabase]);

  const summary = useMemo(
    () => ({
      meals: events.filter((event) => event.kind === "meal").length,
      bowel: events.filter((event) => event.kind === "bowel").length,
      symptoms: events.filter((event) => event.kind === "symptom").length,
    }),
    [events],
  );

  if (configured && !authLoading && !user) return <LandingPage />;

  async function addEvent(event: TimelineEvent) {
    // Fecha a modal imediatamente no celular; upload de foto e persistência
    // continuam em segundo plano e não prendem a interação do usuário.
    setActiveForm(null);
    const eventWithDate = { ...event, date: selectedDate };
    setEvents((current) => [...current, eventWithDate].sort((a, b) => a.time.localeCompare(b.time)));
    if (supabase && user) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { setAuthError("Sua sessão expirou. Entre novamente para salvar o registro."); return; }
      let photoPath: string | null = null;
      if (eventWithDate.photoFile) {
        const requestedPath = `${user.id}/${eventWithDate.id}-${eventWithDate.photoFile.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
        const photoForm = new FormData(); photoForm.append("file", eventWithDate.photoFile); photoForm.append("path", requestedPath);
        const photoResponse = await fetch("/api/event-photo", { method: "POST", headers: { Authorization: `Bearer ${sessionData.session.access_token}` }, body: photoForm });
        if (photoResponse.ok) photoPath = String((await photoResponse.json()).path || requestedPath);
        else setAuthError("Registro criado, mas a foto não pôde ser enviada. Você pode tentar novamente.");
      }
      const saveResponse = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` }, body: JSON.stringify({ id: eventWithDate.id, event_date: selectedDate, event_kind: eventWithDate.kind, event_time: eventWithDate.time, title: eventWithDate.title, detail: eventWithDate.detail, badge: eventWithDate.badge ?? null, tags: eventWithDate.tags ?? [], photo_path: photoPath }) });
      const saveResult = await saveResponse.json().catch(() => ({})) as { error?: string };
      if (!saveResponse.ok) setAuthError(`Não foi possível salvar: ${saveResult.error || `HTTP ${saveResponse.status}`}`);
      if (saveResponse.ok && eventWithDate.kind === "bowel" && photoPath) {
        {
          const response = await fetch("/api/ai/classify-bowel-photo", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` }, body: JSON.stringify({ eventId: eventWithDate.id, photoPath }) });
          if (!response.ok) setAuthError("Evacuação registrada, mas a classificação da foto pela IA ainda não foi concluída.");
          else {
            const result = await response.json() as { bristolType?: number; confidence?: string };
            if (result.bristolType) setEvents((current) => current.map((item) => item.id === eventWithDate.id ? { ...item, detail: `${item.detail} · Bristol ${result.bristolType} (IA)`, badge: `B${result.bristolType}`, tags: ["foto", "classificado pela IA"] } : item));
          }
        }
      }
    }
  }

  async function removeEvent(event: TimelineEvent) {
    if (!window.confirm(`Excluir o registro “${event.title}”?`)) return;
    setAuthError(null);
    if (supabase && user) {
      const { error } = await supabase.from("health_events").delete().eq("id", event.id).eq("user_id", user.id);
      if (error) { setAuthError(`Não foi possível excluir: ${error.message}`); return; }
      if (event.photoPath) {
        const bucket = event.kind === "meal" || event.kind === "bowel" ? "health-event-photos" : null;
        if (bucket) await supabase.storage.from(bucket).remove([event.photoPath]);
      }
    }
    setEvents((current) => current.filter((item) => item.id !== event.id));
  }

  async function updateEvent(event: TimelineEvent) {
    if (supabase && user) {
      const { error } = await supabase.from("health_events").update({ event_time: event.time, title: event.title, detail: event.detail }).eq("id", event.id).eq("user_id", user.id);
      if (error) { setAuthError(`Não foi possível editar: ${error.message}`); return; }
    }
    setEvents((current) => current.map((item) => item.id === event.id ? event : item).sort((a, b) => a.time.localeCompare(b.time)));
    setEditingEvent(null);
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-[#fcfcf9] px-5 pb-28 text-[#18342b]">
      <header className="flex items-center justify-between pt-8">
        <div>
          <p className="text-sm font-medium text-[#698076]">Meu Intestino</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Olá, Bruno.</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => window.location.reload()} aria-label="Atualizar registros" className="flex items-center gap-1.5 rounded-full border border-[#cbd9ce] bg-white px-3 py-2 text-sm font-semibold text-[#38624c] transition active:scale-95"><span aria-hidden="true">↻</span><span>Atualizar</span></button>
          <Link href="/profile" aria-label="Minha conta" className="flex items-center gap-2 rounded-full bg-[#e6f1e9] px-3 py-2 text-sm font-semibold text-[#38624c] transition active:scale-95"><span className="text-lg">👤</span><span>Conta</span></Link>
        </div>
      </header>

      {configured && authLoading && <div className="mt-5 rounded-2xl bg-white p-4 text-sm text-[#698076]">Carregando seus registros…</div>}
      {authError && !authLoading && <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-[#fae8e5] p-4 text-sm text-[#9b4438]"><span>{authError}</span><button type="button" onClick={() => window.location.reload()} className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#9b4438]">Tentar novamente</button></div>}

      <section className="mt-7 rounded-[28px] bg-[#e9f3eb] p-5 shadow-[0_8px_30px_rgba(38,81,59,0.08)]">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#38624c]">{selectedDateLabel}</p>
            <h2 className="mt-1 text-xl font-semibold">Como está seu intestino?</h2>
          </div>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <button
              type="button"
              aria-label="Ver registros de hoje"
              aria-pressed={selectedDate === today}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition ${selectedDate === today ? "bg-[#1e6341] text-white" : "bg-white text-[#38624c]"}`}
              onClick={() => { setSelectedDate(today); setShowDatePicker(false); setActiveFilter(null); }}
            >
              Hoje
            </button>
            <button
              type="button"
              aria-label="Trocar dia"
              className="whitespace-nowrap rounded-full bg-white px-3 py-2 text-sm font-medium text-[#38624c]"
              onClick={() => setSelectedDate((date) => shiftDate(date, -1))}
            >
              ‹ Dia
            </button>
            <button type="button" className="rounded-full bg-white px-3 py-2 text-sm font-medium text-[#38624c]" onClick={() => setShowDatePicker((open) => !open)} aria-label="Abrir calendário">▣</button>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/75 p-4">
          <span className="text-2xl">🟡</span>
          <div>
            <p className="font-semibold">Resumo inteligente do dia</p>
            <p className="mt-0.5 text-sm leading-snug text-[#698076]">{gutSummary(dayEvents)}</p>
            <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void evaluateDay()} disabled={aiBusy || aiLocked} className="rounded-full bg-[#1e6341] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{aiBusy ? "Recriando análise…" : aiLocked ? "Avaliação realizada hoje" : "✦ Avaliar meu dia"}</button><button type="button" onClick={() => void exportDayData()} className="rounded-full border border-[#b9cfc0] bg-white px-4 py-2 text-xs font-semibold text-[#39734f]">⇩ Exportar dados</button></div>
          </div>
        </div>
        {aiBusy && <p className="mt-3 rounded-xl bg-white/80 p-3 text-sm text-[#527063]">Recriando a análise com todos os registros deste dia e seu histórico intestinal…</p>}
        {aiLocked && !aiBusy && <p className="mt-3 text-xs text-[#819189]">A avaliação deste dia já foi realizada. Uma nova avaliação estará disponível em outro dia.</p>}
        {exportMessage && <p className="mt-3 rounded-xl bg-white/80 p-3 text-xs text-[#527063]">{exportMessage}</p>}
        {aiError && <p className="mt-3 rounded-xl bg-[#fae8e5] p-3 text-sm text-[#9b4438]">{aiError}</p>}
        {aiSummary && <div className="mt-3 rounded-2xl border border-[#cfe0d1] bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#39734f]">Análise dos seus registros</p><p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#527063]">{aiSummary}</p><p className="mt-3 text-xs leading-relaxed text-[#819189]">Associação observada nos seus registros. Isso não significa necessariamente relação de causa e efeito.</p></div>}
        {showDatePicker && <div className="mt-3 rounded-2xl border border-[#dce5dd] bg-white p-4 shadow-lg">
          <label className="text-sm font-semibold">Escolha o dia
            <input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setShowDatePicker(false); setActiveFilter(null); }} className="mt-2 block w-full rounded-xl border border-[#dce5dd] px-3 py-3" />
          </label>
        </div>}
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-end justify-between">
          <div>
          <p className="text-sm font-medium text-[#698076]">{selectedDateLabel}</p>
            <h2 className="text-xl font-semibold">Seu resumo</h2>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {eventOptions.map((option) => {
            const count = dayEvents.filter((event) => event.kind === option.kind).length;
            return <Metric key={option.kind} value={count} label={option.label} icon={option.icon} active={activeFilter === option.kind} onClick={() => setActiveFilter(activeFilter === option.kind ? null : option.kind)} />;
          })}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#698076]">{selectedDateLabel}</p>
            <h2 className="text-xl font-semibold">Linha do tempo</h2>
          </div>
          {activeFilter && <button onClick={() => setActiveFilter(null)} className="text-sm font-semibold text-[#39734f]">Limpar filtro</button>}
        </div>
        <div className="space-y-3">
          {dayEvents.filter((event) => !activeFilter || event.kind === activeFilter).map((event) => (
            <TimelineCard event={event} key={event.id} onEdit={() => setEditingEvent(event)} onDelete={() => void removeEvent(event)} />
          ))}
          {dayEvents.filter((event) => !activeFilter || event.kind === activeFilter).length === 0 && <div className="rounded-2xl border border-dashed border-[#cbd9ce] p-5 text-center text-sm text-[#698076]">Nenhum registro nesta categoria para este dia.</div>}
        </div>
      </section>

      <button
        className="fixed bottom-5 left-1/2 flex w-[calc(100%-40px)] max-w-md -translate-x-1/2 items-center justify-center gap-2 rounded-2xl bg-[#1e6341] px-5 py-4 font-semibold text-white shadow-[0_12px_28px_rgba(30,99,65,0.25)]"
        onClick={() => setShowEventPicker(true)}
      >
        <span className="text-xl leading-none">+</span> Registro
      </button>

      {showEventPicker && <EventPicker onClose={() => setShowEventPicker(false)} onSelect={(kind) => { setShowEventPicker(false); setActiveForm(kind); }} />}
      {activeForm && <QuickForm kind={activeForm} onClose={() => setActiveForm(null)} onSave={addEvent} />}
      {editingEvent && <EditEventForm event={editingEvent} onClose={() => setEditingEvent(null)} onSave={(event) => void updateEvent(event)} />}
    </main>
  );
}

function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fcfcf9] text-[#18342b]">
      <section className="relative mx-auto max-w-6xl px-5 pb-16 pt-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="Meu Intestino" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"><img src="/meu-intestino-icon.png" alt="" className="h-11 w-11 rounded-xl" />Meu Intestino</Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[#698076] sm:flex"><a href="#recursos" className="transition hover:text-[#39734f]">Recursos</a><a href="#como-funciona" className="transition hover:text-[#39734f]">Como funciona</a></nav>
          <Link href="/login" className="rounded-full border border-[#cbd9ce] bg-white px-4 py-2 text-sm font-semibold text-[#38624c]">Entrar</Link>
        </header>
        <div className="grid items-center gap-12 pb-4 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
          <div>
            <p className="inline-flex rounded-full bg-[#e9f3eb] px-3 py-1.5 text-sm font-semibold text-[#39734f]">Seu corpo conta uma história</p>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">Entenda melhor o seu intestino, um registro de cada vez.</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#698076]">Registre refeições, evacuações, sintomas, hábitos e exames em um só lugar. O Meu Intestino ajuda você a perceber padrões nos seus próprios dados.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/login" className="rounded-2xl bg-[#1e6341] px-6 py-4 text-center font-semibold text-white shadow-[0_12px_28px_rgba(30,99,65,0.22)] transition hover:bg-[#185436]">Criar minha conta</Link><Link href="/login" className="rounded-2xl border border-[#cbd9ce] bg-white px-6 py-4 text-center font-semibold text-[#38624c]">Já tenho uma conta</Link></div>
            <p className="mt-4 text-xs text-[#819189]">Seus registros são pessoais e protegidos. O app não faz diagnósticos.</p>
          </div>
          <div className="relative mx-auto w-full max-w-md"><div className="absolute -inset-5 rounded-[42px] bg-[#e9f3eb] blur-2xl" /><div className="relative rounded-[32px] border border-[#e1e9e1] bg-white p-5 shadow-[0_20px_60px_rgba(32,62,45,0.12)]"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-[#698076]">Hoje</p><h2 className="mt-1 text-xl font-semibold">Como está seu intestino?</h2></div><span className="rounded-full bg-[#fff2d9] px-3 py-2 text-xl">🟡</span></div><div className="mt-5 rounded-2xl bg-[#e9f3eb] p-4"><p className="font-semibold">Resumo do dia</p><p className="mt-1 text-sm leading-relaxed text-[#698076]">Sua linha do tempo reúne alimentação, sintomas e evacuações em um só lugar.</p></div><div className="mt-5 space-y-3"><div className="flex items-center gap-3 rounded-2xl border border-[#edf1ed] p-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9f3eb]">🍽</span><div><p className="text-xs text-[#819189]">12:15</p><p className="font-semibold">Almoço</p></div></div><div className="flex items-center gap-3 rounded-2xl border border-[#edf1ed] p-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff2d9]">🚽</span><div><p className="text-xs text-[#819189]">14:25</p><p className="font-semibold">Evacuação registrada</p></div></div></div></div></div>
        </div>
      </section>
      <section id="recursos" className="border-y border-[#e8eee8] bg-white px-5 py-16 sm:px-8"><div className="mx-auto max-w-6xl"><div className="max-w-xl"><p className="text-sm font-semibold text-[#39734f]">Feito para a vida real</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Um diário leve, com o que realmente importa.</h2><p className="mt-3 leading-relaxed text-[#698076]">Registre o seu dia sem complicação e transforme informações soltas em uma visão clara da sua rotina.</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Feature icon="⚡" title="Registro rápido" text="Adicione um evento em poucos segundos, sem formulários enormes." /><Feature icon="◷" title="Linha do tempo" text="Veja o que aconteceu antes e depois de cada sintoma." /><Feature icon="✦" title="Análise por IA" text="Avalie o dia completo e encontre associações observadas nos seus próprios registros." /><Feature icon="🔒" title="Memória individual" text="Seu histórico e suas análises ficam separados por usuário." /><Feature icon="📄" title="Exames privados" text="Guarde PDFs e imagens de exames no seu perfil, com acesso protegido e controle para excluir quando quiser." /><Feature icon="◈" title="MCP + Claude" text="Conecte seu diário ao Claude para consultar eventos e relatórios, sempre com sua autorização." /></div></div></section>
      <section id="como-funciona" className="border-b border-[#cfe8df] bg-[#e8f5f2] px-5 py-16 sm:px-8"><div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"><div><p className="text-sm font-semibold text-[#1b8b6f]">Do registro ao entendimento</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#245443]">Mais clareza para conversar sobre a sua saúde.</h2><p className="mt-4 leading-relaxed text-[#527063]">O Meu Intestino organiza alimentação, evacuações, sintomas, hidratação, sono, medicamentos e atividades em um único lugar.</p><Link href="/login" className="mt-7 inline-flex rounded-2xl bg-[#1b8b6f] px-5 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(27,139,111,0.2)]">Começar meu diário</Link></div><div className="grid gap-3 sm:grid-cols-3"><Step number="01" title="Registre" text="Anote o que aconteceu, no seu ritmo." /><Step number="02" title="Observe" text="Veja sua linha do tempo e seus padrões." /><Step number="03" title="Compartilhe" text="Use o MCP para consultar seus dados no Claude." /></div></div></section>
      <section className="bg-[#1b8b6f] px-5 py-14 text-white sm:px-8"><div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-[28px] bg-[#15704a] p-7 sm:flex-row sm:items-center sm:p-10"><div><p className="text-sm font-semibold text-[#c8f0e4]">Seu diário, suas escolhas</p><h2 className="mt-2 max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">Comece a transformar dúvidas em informações úteis.</h2><p className="mt-3 max-w-xl text-sm leading-relaxed text-[#d8f2eb]">Crie sua conta gratuitamente e registre o primeiro evento do seu dia.</p></div><Link href="/login" className="shrink-0 rounded-2xl bg-white px-5 py-3 font-semibold text-[#1b8b6f] shadow-lg">Criar minha conta</Link></div></section>
      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-[#819189] sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© {new Date().getFullYear()} Meu Intestino</span><span>Seus dados, sua história, seu ritmo.</span></footer>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <article className="rounded-3xl border border-[#e5ece5] bg-[#fcfcf9] p-5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e9f3eb] text-xl">{icon}</span><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-[#698076]">{text}</p></article>;
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <article className="rounded-3xl border border-[#e5ece5] bg-white p-5"><span className="text-sm font-bold text-[#39734f]">{number}</span><h3 className="mt-6 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-[#698076]">{text}</p></article>;
}

function Metric({ value, label, icon, active, onClick }: { value: number; label: string; icon?: string; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl border p-3 text-left transition ${active ? "border-[#39734f] bg-[#e9f3eb]" : "border-[#e8ece8] bg-white"}`}>
      <p className="text-lg">{icon}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs leading-tight text-[#698076]">{label}</p>
      {active && <p className="mt-2 text-[10px] font-semibold text-[#39734f]">filtrando</p>}
    </button>
  );
}

function gutSummary(events: TimelineEvent[]) {
  if (!events.length) return "Ainda não há registros na sua linha do tempo hoje.";
  const labels = new Map<EventKind, string>(eventOptions.map((option) => [option.kind, option.label.toLowerCase()]));
  const counts = [...new Set(events.map((event) => event.kind))].map((kind) => {
    const count = events.filter((event) => event.kind === kind).length;
    const label = labels.get(kind) || "evento";
    return `${count} ${label}${count === 1 ? "" : "s"}`;
  });
  return `Hoje foram registrados ${events.length} ${events.length === 1 ? "evento" : "eventos"}: ${counts.join(", ")}.`;
}

function mapDatabaseEvent(row: { id: string; event_date: string; event_kind: EventKind; event_time: string; title: string; detail: string; badge: string | null; tags: string[] | null; photo_path?: string | null }): TimelineEvent {
  return { id: row.id, date: row.event_date, kind: row.event_kind, time: row.event_time.slice(0, 5), title: row.title, detail: row.detail, badge: row.badge ?? undefined, tags: row.tags ?? [], photoPath: row.photo_path ?? undefined };
}

function TimelineCard({ event, onEdit, onDelete }: { event: TimelineEvent; onEdit: () => void; onDelete: () => void }) {
  const icon = eventOptions.find((option) => option.kind === event.kind)?.icon || "📝";
  const color = event.kind === "meal" ? "bg-[#e9f3eb]" : event.kind === "bowel" ? "bg-[#fff2d9]" : "bg-[#fae8e5]";
  const supabase = getSupabaseBrowserClient();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !event.photoPath) return;
    let active = true;
    void supabase.storage.from("health-event-photos").createSignedUrl(event.photoPath, 3600).then(({ data }) => {
      if (active && data?.signedUrl) setPhotoUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [event.photoPath, supabase]);

  return (
    <article className="flex gap-3 rounded-2xl border border-[#e8ece8] bg-white p-4 shadow-[0_5px_16px_rgba(32,62,45,0.04)]">
      <time className="w-10 pt-1 text-sm font-semibold text-[#527063]">{event.time}</time>
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${color}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{event.title}</h3>
          <div className="flex items-center gap-1">{event.badge && <span className="rounded-full bg-[#f2f5f1] px-2 py-1 text-xs font-semibold text-[#527063]">{event.badge}</span>}<button type="button" onClick={onEdit} aria-label={`Editar ${event.title}`} className="rounded-full px-2 py-1 text-sm font-semibold text-[#39734f] transition hover:bg-[#e9f3eb]">Editar</button><button type="button" onClick={onDelete} aria-label={`Excluir ${event.title}`} className="rounded-full px-2 py-1 text-sm text-[#a34a3d] transition hover:bg-[#fae8e5]">Excluir</button></div>
        </div>
        <p className="mt-1 text-sm leading-snug text-[#698076]">{event.detail}</p>
        {photoUrl && <img src={photoUrl} alt={`Foto de ${event.title}`} className="mt-3 h-28 w-full rounded-2xl object-cover" />}
        {event.tags && event.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">
          {event.tags.map((tag) => <span className="rounded-full bg-[#eef5ef] px-2 py-1 text-[11px] font-semibold text-[#39734f]" key={tag}>#{tag}</span>)}
        </div>}
      </div>
    </article>
  );
}

function EventPicker({ onClose, onSelect }: { onClose: () => void; onSelect: (kind: EventKind) => void }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end bg-[#18342b]/25" role="dialog" aria-modal="true" aria-label="Escolher tipo de registro">
      <div className="w-full rounded-t-[30px] bg-[#fcfcf9] px-5 pb-8 pt-4 shadow-2xl">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-[#d3ddd5]" />
        <div className="mt-5 flex items-center justify-between">
          <div><h2 className="text-xl font-semibold">O que você quer registrar?</h2><p className="mt-1 text-sm text-[#698076]">Todos os eventos ficam na mesma linha do tempo.</p></div>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-2 text-sm font-semibold text-[#527063]">Cancelar</button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {eventOptions.map((option) => <button key={option.kind} type="button" onClick={() => onSelect(option.kind)} className="min-h-24 rounded-2xl border border-[#e6ebe5] bg-white p-3 text-left shadow-sm transition active:scale-[0.98]"><span className="text-2xl">{option.icon}</span><span className="mt-2 block text-sm font-semibold">{option.label}</span><span className="mt-1 block text-[11px] leading-tight text-[#698076]">{option.hint}</span></button>)}
        </div>
      </div>
    </div>
  );
}

function ManagedSelect({ name, storageKey, defaults, placeholder, required = false }: { name: string; storageKey: string; defaults: string[]; placeholder: string; required?: boolean }) {
  const [options, setOptions] = useState(defaults);
  const [value, setValue] = useState("");
  const [managing, setManaging] = useState(false);
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`meuintestino:${storageKey}`) || "null");
      if (Array.isArray(saved)) setOptions([...new Set(saved.map(String))]);
    } catch { /* usa as opções padrão */ }
  }, [storageKey]);

  function persist(next: string[]) {
    setOptions(next);
    localStorage.setItem(`meuintestino:${storageKey}`, JSON.stringify(next));
  }

  function addItem() {
    const item = newItem.trim();
    if (!item || options.includes(item)) return;
    persist([...options, item]); setNewItem(""); setValue(item); setManaging(false);
  }

  function editItem(item: string) {
    const next = window.prompt("Editar item", item)?.trim();
    if (!next || next === item || options.includes(next)) return;
    const updated = options.map((option) => option === item ? next : option);
    persist(updated); if (value === item) setValue(next);
  }

  function deleteItem(item: string) {
    if (!window.confirm(`Excluir “${item}” da lista?`)) return;
    persist(options.filter((option) => option !== item)); if (value === item) setValue("");
  }

  return <div className="mt-2"><div className="flex gap-2"><select name={name} required={required} value={value} onChange={(event) => setValue(event.target.value)} className="block min-w-0 flex-1 rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base"><option value="">{placeholder}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><button type="button" onClick={() => setManaging((open) => !open)} className="rounded-xl border border-[#b9cfc0] px-3 text-xs font-semibold text-[#39734f]">Gerenciar</button></div>{managing && <div className="mt-2 rounded-2xl border border-[#dce5dd] bg-white p-3"><div className="flex gap-2"><input value={newItem} onChange={(event) => setNewItem(event.target.value)} placeholder="Novo item" className="min-w-0 flex-1 rounded-lg border border-[#dce5dd] px-2 py-2 text-sm" /><button type="button" onClick={addItem} className="rounded-lg bg-[#e9f3eb] px-3 text-xs font-semibold text-[#39734f]">Adicionar</button></div><div className="mt-3 space-y-2">{options.map((option) => <div key={option} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{option}</span><span className="flex gap-2"><button type="button" onClick={() => editItem(option)} className="text-xs font-semibold text-[#39734f]">Editar</button><button type="button" onClick={() => deleteItem(option)} className="text-xs text-[#a34a3d]">Excluir</button></span></div>)}</div></div>}</div>;
}

function QuickForm({ kind, onClose, onSave }: { kind: EventKind; onClose: () => void; onSave: (event: TimelineEvent) => void }) {
  const title = `Registrar ${eventOptions.find((option) => option.kind === kind)?.label.toLowerCase() || "evento"}`;
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const time = String(form.get("time") || timeNow());
    const value = String(form.get("value") || "").trim();
    const intensity = String(form.get("intensity") || "");
    const details = String(form.get("details") || "").trim();
    const tags = String(form.get("tags") || "")
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 6);
    const category = String(form.get("category") || "").trim();

    const streamQuality = String(form.get("streamQuality") || "").trim();
    const urineColor = String(form.get("urineColor") || "").trim();
    const burning = String(form.get("burning") || "").trim();
    if (!value && kind !== "bowel" && kind !== "urine" && kind !== "stress") return;
    const item: TimelineEvent =
      kind === "meal"
        ? { id: crypto.randomUUID(), kind, time, title: category || "Refeição", detail: `${value}${photoName ? " · foto anexada" : ""}`, tags: photoName ? [...tags, "foto"] : tags, photoFile: photoFile ?? undefined }
        : kind === "bowel"
          ? { id: crypto.randomUUID(), kind, time, title: "Evacuação", detail: `Evacuação registrada${intensity ? ` · urgência ${intensity}/5` : ""}${details ? ` · ${details}` : ""}${photoName ? " · foto anexada" : ""}`, badge: photoName ? "IA" : undefined, tags: photoName ? ["foto", "classificação pendente"] : undefined, photoFile: photoFile ?? undefined }
        : kind === "stress"
          ? { id: crypto.randomUUID(), kind, time, title: "Estresse", detail: `Nível ${intensity}/5${details ? ` · ${details}` : ""}`, badge: intensity ? `${intensity}/5` : undefined }
        : kind === "urine"
          ? { id: crypto.randomUUID(), kind, time, title: "Urina", detail: `Jato: ${streamQuality || "não informado"} · Cor: ${urineColor || "não informada"} · Ardência: ${burning || "não informada"}` }
        : kind === "symptom"
            ? { id: crypto.randomUUID(), kind, time, title: value, detail: `${intensity ? `Intensidade ${intensity}/10` : ""}${details ? `${intensity ? " · " : ""}${details}` : ""}`, badge: intensity ? `${intensity}/10` : undefined }
            : kind === "sleep"
              ? { id: crypto.randomUUID(), kind, time, title: "Sono", detail: `${value} ${Number(value) === 1 ? "hora" : "horas"}${details ? ` · ${details}` : ""}` }
            : kind === "exercise"
              ? { id: crypto.randomUUID(), kind, time, title: category || "Atividade", detail: `${value} ${Number(value) === 1 ? "minuto" : "minutos"}` }
            : kind === "tea"
              ? { id: crypto.randomUUID(), kind, time, title: value, detail: `${intensity} ml` }
            : { id: crypto.randomUUID(), kind, time, title: category || eventOptions.find((option) => option.kind === kind)?.label || "Evento", detail: value };
    onSave(item);
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-[#18342b]/25" role="dialog" aria-modal="true" aria-label={title}>
      <form onSubmit={submit} className="w-full rounded-t-[30px] bg-[#fcfcf9] px-5 pb-8 pt-4 shadow-2xl">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-[#d3ddd5]" />
        <div className="mt-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-2 text-sm font-semibold text-[#527063]">Cancelar</button>
        </div>
        <label className="mt-5 block text-sm font-semibold">Horário
          <input name="time" type="time" defaultValue={timeNow()} className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
        </label>
        {(kind === "meal" || kind === "exercise") && <label className="mt-4 block text-sm font-semibold">Categoria <span className="font-normal text-[#698076]">(opcional)</span>
          <ManagedSelect name="category" storageKey={`${kind}-categories`} defaults={kind === "meal" ? ["Café da manhã", "Almoço", "Lanche", "Jantar", "Ceia"] : ["Caminhada", "Corrida", "Musculação"]} placeholder="Sem categoria" />
        </label>}
        {kind === "urine" && <div className="mt-4 space-y-4"><label className="block text-sm font-semibold">Qualidade do jato
          <ManagedSelect name="streamQuality" storageKey="urine-stream-quality" defaults={["Normal", "Fraco", "Interrompido", "Muito forte"]} placeholder="Selecione a qualidade" required />
        </label><label className="block text-sm font-semibold">Cor da urina
          <ManagedSelect name="urineColor" storageKey="urine-color" defaults={["Transparente", "Amarelo claro", "Amarelo escuro", "Âmbar", "Avermelhada", "Outra"]} placeholder="Selecione a cor" required />
        </label><label className="block text-sm font-semibold">Ardência ao urinar
          <ManagedSelect name="burning" storageKey="urine-burning" defaults={["Não", "Leve", "Moderada", "Intensa"]} placeholder="Selecione uma opção" required />
        </label></div>}
        {kind === "stress" && <div className="mt-4 space-y-4"><label className="block text-sm font-semibold">Nível de estresse (0 a 5)
          <input name="intensity" required type="number" min="0" max="5" defaultValue="0" className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
        </label><label className="block text-sm font-semibold">Observação (opcional)
          <textarea name="details" className="mt-2 block min-h-20 w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" placeholder="Ex.: dia mais intenso no trabalho" />
        </label></div>}
        {kind === "meal" && <label className="mt-4 block text-sm font-semibold">O que você comeu?
          <textarea name="value" required placeholder="Ex.: arroz, feijão e abacate" className="mt-2 block min-h-24 w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
        </label>}
        {kind === "meal" && <label className="mt-4 block text-sm font-semibold">Tags para mapear o histórico <span className="font-normal text-[#698076]">(opcional)</span>
          <input name="tags" placeholder="Ex.: gordura, fibras, café (separe por vírgula)" className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
          <span className="mt-1 block text-xs font-normal text-[#698076]">Use tags consistentes para comparar registros depois.</span>
        </label>}
        {kind === "tea" && <label className="mt-4 block text-sm font-semibold">Tipo de chá
          <ManagedSelect name="value" storageKey="tea-types" defaults={["Camomila", "Hortelã", "Erva-doce", "Gengibre", "Verde", "Preto", "Outro"]} placeholder="Selecione o chá" />
        </label>}
        {kind === "water" && <label className="mt-4 block text-sm font-semibold">Quantidade de água (ml)
          <input name="value" required type="number" min="1" step="1" placeholder="Ex.: 250" className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
        </label>}
        {kind === "weight" && <label className="mt-4 block text-sm font-semibold">Peso (kg)
          <input name="value" required type="number" min="1" step="0.1" placeholder="Ex.: 70,5" className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
        </label>}
        {kind === "sleep" && <label className="mt-4 block text-sm font-semibold">Quantidade de sono (horas)
          <input name="value" required type="number" min="0.5" step="0.5" placeholder="Ex.: 7,5" className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
        </label>}
        {kind === "exercise" && <label className="mt-4 block text-sm font-semibold">Tempo (minutos)
          <input name="value" required type="number" min="1" step="1" placeholder="Ex.: 30" className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
        </label>}
        {kind === "tea" && <label className="mt-4 block text-sm font-semibold">Quantidade (ml)
          <input name="intensity" required type="number" min="1" step="1" placeholder="Ex.: 250" className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
        </label>}
        {!['meal', 'bowel', 'urine', 'stress', 'symptom', 'tea', 'water', 'weight', 'sleep', 'exercise'].includes(kind) && <label className="mt-4 block text-sm font-semibold">Detalhes do registro
          <textarea name="value" required placeholder={eventOptions.find((option) => option.kind === kind)?.hint} className="mt-2 block min-h-24 w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
        </label>}
        {(kind === "bowel" || kind === "meal") && <div className="mt-4 rounded-2xl border border-dashed border-[#b9cfc0] bg-[#f3f8f3] p-4">
          <p className="text-sm font-semibold">Foto {kind === "bowel" ? "da evacuação" : "da refeição"} <span className="font-normal text-[#698076]">(opcional)</span></p>
          <p className="mt-1 text-xs leading-relaxed text-[#698076]">{kind === "bowel" ? "Após salvar, a IA poderá analisar a foto e sugerir a escala de Bristol automaticamente." : "A foto fica vinculada ao evento da refeição para consulta futura."}</p>
          <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl bg-white px-3 py-3 text-sm font-semibold text-[#39734f] shadow-sm">
            {photoName ? "Trocar foto" : "Selecionar foto"}
            <input type="file" accept="image/*" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setPhotoName(file.name);
              setPhotoFile(file);
              setPhotoPreview(URL.createObjectURL(file));
            }} />
          </label>
          {photoPreview && <div className="mt-3 flex items-center gap-3">
            <img src={photoPreview} alt="Pré-visualização da evacuação" className="h-16 w-16 rounded-xl object-cover" />
            <div className="min-w-0 flex-1"><p className="truncate text-xs text-[#527063]">{photoName}</p>
            </div>
          </div>}
        </div>}
        {kind === "symptom" && <label className="mt-4 block text-sm font-semibold">Sintoma
          <ManagedSelect name="value" storageKey="symptoms" defaults={["Cólica", "Gases", "Estufamento", "Náusea", "Refluxo", "Outro"]} placeholder="Selecione o sintoma" required />
        </label>}
        {(kind === "bowel" || kind === "symptom") && <label className="mt-4 block text-sm font-semibold">{kind === "bowel" ? "Urgência (0 a 5)" : "Intensidade (0 a 10)"}
          <input name="intensity" type="number" min="0" max={kind === "bowel" ? "5" : "10"} defaultValue={kind === "bowel" ? "0" : "5"} className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
        </label>}
        {kind === "bowel" && <label className="mt-4 block text-sm font-semibold">Observação (opcional)
          <textarea name="details" className="mt-2 block min-h-20 w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" placeholder="Ex.: sensação de evacuação incompleta" />
        </label>}
        {kind === "symptom" && <label className="mt-4 block text-sm font-semibold">Observação (opcional)
          <input name="details" className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
        </label>}
        {kind === "sleep" && <label className="mt-4 block text-sm font-semibold">Detalhes (opcional)
          <textarea name="details" className="mt-2 block min-h-20 w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" placeholder="Ex.: acordei algumas vezes" />
        </label>}
        <button className="mt-6 w-full rounded-2xl bg-[#1e6341] py-4 font-semibold text-white">Salvar registro</button>
      </form>
    </div>
  );
}

function EditEventForm({ event, onClose, onSave }: { event: TimelineEvent; onClose: () => void; onSave: (event: TimelineEvent) => void }) {
  const [time, setTime] = useState(event.time);
  const [title, setTitle] = useState(event.title);
  const [detail, setDetail] = useState(event.detail);
  return <div className="fixed inset-0 z-20 flex items-end bg-[#18342b]/25" role="dialog" aria-modal="true" aria-label="Editar registro">
    <form onSubmit={(formEvent) => { formEvent.preventDefault(); onSave({ ...event, time, title: title.trim() || event.title, detail: detail.trim() }); }} className="w-full rounded-t-[30px] bg-[#fcfcf9] px-5 pb-8 pt-4 shadow-2xl">
      <div className="mx-auto h-1.5 w-10 rounded-full bg-[#d3ddd5]" />
      <div className="mt-5 flex items-center justify-between"><div><p className="text-sm text-[#698076]">Editar registro</p><h2 className="text-xl font-semibold">{event.title}</h2></div><button type="button" onClick={onClose} className="rounded-full px-3 py-2 text-sm font-semibold text-[#527063]">Cancelar</button></div>
      <label className="mt-5 block text-sm font-semibold">Horário<input required type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" /></label>
      <label className="mt-4 block text-sm font-semibold">Título<input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" /></label>
      <label className="mt-4 block text-sm font-semibold">Detalhes<textarea value={detail} onChange={(e) => setDetail(e.target.value)} className="mt-2 block min-h-24 w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" /></label>
      <button className="mt-6 w-full rounded-2xl bg-[#1e6341] py-4 font-semibold text-white">Salvar edição</button>
    </form>
  </div>;
}
