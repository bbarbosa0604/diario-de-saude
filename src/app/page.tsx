"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

type EventKind = "meal" | "symptom" | "bowel" | "medication" | "water" | "weight" | "sleep" | "exercise" | "note";

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

const initialEvents: TimelineEvent[] = [
  {
    id: "1",
    kind: "meal",
    date: "2026-08-10",
    time: "12:15",
    title: "Almoço",
    detail: "Arroz, grão-de-bico, castanha e abacate",
    tags: ["leguminosas", "castanhas", "abacate"],
  },
  {
    id: "2",
    kind: "symptom",
    date: "2026-08-10",
    time: "14:05",
    title: "Cólica",
    detail: "Intensidade 6 de 10",
    badge: "6/10",
  },
  {
    id: "3",
    kind: "bowel",
    date: "2026-08-10",
    time: "14:25",
    title: "Evacuação",
    detail: "Bristol 6 · urgência moderada",
    badge: "B6",
  },
];

const eventOptions: { kind: EventKind; icon: string; label: string; hint: string }[] = [
  { kind: "meal", icon: "🍽", label: "Refeição", hint: "O que você comeu?" },
  { kind: "bowel", icon: "🚽", label: "Evacuação", hint: "Bristol, urgência e foto" },
  { kind: "symptom", icon: "✦", label: "Sintoma", hint: "Cólica, gases ou outro" },
  { kind: "medication", icon: "💊", label: "Medicamento", hint: "Medicamento ou suplemento" },
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
  const [events, setEvents] = useState<TimelineEvent[]>(initialEvents);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured());
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<EventKind | null>(null);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState("2026-08-10");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeFilter, setActiveFilter] = useState<EventKind | null>(null);

  const selectedDateLabel = selectedDate === "2026-08-10" ? "Hoje, 10 de agosto" : new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(new Date(`${selectedDate}T12:00:00`));
  const dayEvents = events.filter((event) => event.date === selectedDate);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let mounted = true;
    async function load() {
      const { data } = await client.auth.getUser();
      if (!mounted) return;
      setUser(data.user ?? null);
      setAuthLoading(false);
      if (!data.user) router.replace("/login");
      if (data.user) {
        const { data: rows, error } = await client.from("health_events").select("id,event_date,event_kind,event_time,title,detail,badge,tags,photo_path").eq("user_id", data.user.id).order("event_time", { ascending: true });
        if (error) setAuthError(error.message);
        else if (rows) setEvents(rows.map(mapDatabaseEvent));
      } else {
        setEvents([]);
      }
    }
    void load();
    const { data: authSubscription } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (session?.user) {
        void client.from("health_events").select("id,event_date,event_kind,event_time,title,detail,badge,tags,photo_path").eq("user_id", session.user.id).order("event_time", { ascending: true }).then(({ data: rows, error }) => {
          if (error) setAuthError(error.message);
          else if (rows) setEvents(rows.map(mapDatabaseEvent));
        });
      } else {
        setEvents([]);
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

  async function addEvent(event: TimelineEvent) {
    const eventWithDate = { ...event, date: selectedDate };
    setEvents((current) => [...current, eventWithDate].sort((a, b) => a.time.localeCompare(b.time)));
    if (supabase && user) {
      let photoPath: string | null = null;
      if (eventWithDate.photoFile) {
        photoPath = `${user.id}/${eventWithDate.id}-${eventWithDate.photoFile.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
        const { error: uploadError } = await supabase.storage.from("health-event-photos").upload(photoPath, eventWithDate.photoFile, { upsert: false });
        if (uploadError) setAuthError(`Registro criado, mas a foto não foi enviada: ${uploadError.message}`);
      }
      const { error } = await supabase.from("health_events").insert({
        id: eventWithDate.id,
        user_id: user.id,
        event_date: selectedDate,
        event_kind: eventWithDate.kind,
        event_time: eventWithDate.time,
        title: eventWithDate.title,
        detail: eventWithDate.detail,
        badge: eventWithDate.badge ?? null,
        tags: eventWithDate.tags ?? [],
        photo_path: photoPath,
      });
      if (error) setAuthError(`Não foi possível salvar: ${error.message}`);
    }
    setActiveForm(null);
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-[#fcfcf9] px-5 pb-28 text-[#18342b]">
      <header className="flex items-center justify-between pt-8">
        <div>
          <p className="text-sm font-medium text-[#698076]">Meuintestino</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Olá, Bruno.</h1>
        </div>
        <Link href="/profile" aria-label="Minha conta" className="grid h-11 w-11 place-items-center rounded-full bg-[#e6f1e9] text-xl transition active:scale-95">🌿</Link>
      </header>

      {isSupabaseConfigured() && authLoading && <div className="mt-5 rounded-2xl bg-white p-4 text-sm text-[#698076]">Verificando sua sessão segura…</div>}

      <section className="mt-7 rounded-[28px] bg-[#e9f3eb] p-5 shadow-[0_8px_30px_rgba(38,81,59,0.08)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#38624c]">{selectedDateLabel}</p>
            <h2 className="mt-1 text-xl font-semibold">Como está seu intestino?</h2>
          </div>
          <button
            aria-label="Trocar dia"
            className="rounded-full bg-white px-3 py-2 text-sm font-medium text-[#38624c]"
            onClick={() =>
              setSelectedDate((date) =>
                date === "2026-08-10" ? "2026-08-09" : "2026-08-10",
              )
            }
          >
            ‹ Dia
          </button>
          <button type="button" className="ml-2 rounded-full bg-white px-3 py-2 text-sm font-medium text-[#38624c]" onClick={() => setShowDatePicker((open) => !open)} aria-label="Abrir calendário">▣</button>
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/75 p-4">
          <span className="text-2xl">🟡</span>
          <div>
            <p className="font-semibold">Resumo inteligente do dia</p>
            <p className="mt-0.5 text-sm leading-snug text-[#698076]">{gutSummary(dayEvents)}</p>
          </div>
        </div>
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
          <span className="text-sm text-[#698076]">em construção</span>
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
            <TimelineCard event={event} key={event.id} />
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
    </main>
  );
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
  const symptoms = events.filter((event) => event.kind === "symptom").length;
  const bowel = events.filter((event) => event.kind === "bowel").length;
  if (!symptoms && !bowel) return "Ainda não há sintomas ou evacuações registrados hoje.";
  if (symptoms && bowel) return `Há ${symptoms} ${symptoms === 1 ? "sintoma" : "sintomas"} e ${bowel} ${bowel === 1 ? "evacuação" : "evacuações"} na sua linha do tempo.`;
  if (symptoms) return `Foram registrados ${symptoms} ${symptoms === 1 ? "sintoma" : "sintomas"} hoje.`;
  return `Foram registradas ${bowel} ${bowel === 1 ? "evacuação" : "evacuações"} hoje.`;
}

function mapDatabaseEvent(row: { id: string; event_date: string; event_kind: EventKind; event_time: string; title: string; detail: string; badge: string | null; tags: string[] | null; photo_path?: string | null }): TimelineEvent {
  return { id: row.id, date: row.event_date, kind: row.event_kind, time: row.event_time.slice(0, 5), title: row.title, detail: row.detail, badge: row.badge ?? undefined, tags: row.tags ?? [], photoPath: row.photo_path ?? undefined };
}

function TimelineCard({ event }: { event: TimelineEvent }) {
  const icon = eventOptions.find((option) => option.kind === event.kind)?.icon || "📝";
  const color = event.kind === "meal" ? "bg-[#e9f3eb]" : event.kind === "bowel" ? "bg-[#fff2d9]" : "bg-[#fae8e5]";
  return (
    <article className="flex gap-3 rounded-2xl border border-[#e8ece8] bg-white p-4 shadow-[0_5px_16px_rgba(32,62,45,0.04)]">
      <time className="w-10 pt-1 text-sm font-semibold text-[#527063]">{event.time}</time>
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${color}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{event.title}</h3>
          {event.badge && <span className="rounded-full bg-[#f2f5f1] px-2 py-1 text-xs font-semibold text-[#527063]">{event.badge}</span>}
        </div>
        <p className="mt-1 text-sm leading-snug text-[#698076]">{event.detail}</p>
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

function QuickForm({ kind, onClose, onSave }: { kind: EventKind; onClose: () => void; onSave: (event: TimelineEvent) => void }) {
  const title = `Registrar ${eventOptions.find((option) => option.kind === kind)?.label.toLowerCase() || "evento"}`;
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiBristol, setAiBristol] = useState<string | null>(null);

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

    if (!value) return;
    const item: TimelineEvent =
      kind === "meal"
        ? { id: crypto.randomUUID(), kind, time, title: category || "Refeição", detail: `${value}${photoName ? " · foto anexada" : ""}`, tags: photoName ? [...tags, "foto"] : tags, photoFile: photoFile ?? undefined }
        : kind === "bowel"
          ? { id: crypto.randomUUID(), kind, time, title: category || "Evacuação", detail: `Bristol ${value}${intensity ? ` · urgência ${intensity}/5` : ""}${photoName ? " · foto anexada" : ""}`, badge: `B${value}`, tags: photoName ? ["foto", "classificação pendente"] : undefined, photoFile: photoFile ?? undefined }
          : kind === "symptom"
            ? { id: crypto.randomUUID(), kind, time, title: value, detail: `${intensity ? `Intensidade ${intensity}/10` : ""}${details ? `${intensity ? " · " : ""}${details}` : ""}`, badge: intensity ? `${intensity}/10` : undefined }
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
        <label className="mt-4 block text-sm font-semibold">Categoria <span className="font-normal text-[#698076]">(opcional)</span>
          <select name="category" defaultValue="" className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base">
            <option value="">Sem categoria</option>
            {kind === "meal" && ["Café da manhã", "Almoço", "Lanche", "Jantar", "Ceia"].map((category) => <option key={category}>{category}</option>)}
            {kind === "symptom" && ["Cólica", "Gases", "Náusea", "Refluxo", "Dor abdominal"].map((category) => <option key={category}>{category}</option>)}
            {kind === "bowel" && ["Evacuação", "Evacuação urgente"].map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        {kind === "meal" && <label className="mt-4 block text-sm font-semibold">O que você comeu?
          <textarea name="value" required placeholder="Ex.: arroz, feijão e abacate" className="mt-2 block min-h-24 w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
        </label>}
        {kind === "meal" && <label className="mt-4 block text-sm font-semibold">Tags para mapear o histórico <span className="font-normal text-[#698076]">(opcional)</span>
          <input name="tags" placeholder="Ex.: gordura, fibras, café (separe por vírgula)" className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
          <span className="mt-1 block text-xs font-normal text-[#698076]">Use tags consistentes para comparar registros depois.</span>
        </label>}
        {!['meal', 'bowel', 'symptom'].includes(kind) && <label className="mt-4 block text-sm font-semibold">Detalhes do registro
          <textarea name="value" required placeholder={eventOptions.find((option) => option.kind === kind)?.hint} className="mt-2 block min-h-24 w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
        </label>}
        {kind === "bowel" && <label className="mt-4 block text-sm font-semibold">Escala de Bristol (1 a 7)
          <select name="value" value={aiBristol || "4"} onChange={(event) => setAiBristol(event.target.value)} className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base">{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </label>}
        {(kind === "bowel" || kind === "meal") && <div className="mt-4 rounded-2xl border border-dashed border-[#b9cfc0] bg-[#f3f8f3] p-4">
          <p className="text-sm font-semibold">Foto {kind === "bowel" ? "da evacuação" : "da refeição"} <span className="font-normal text-[#698076]">(opcional)</span></p>
          <p className="mt-1 text-xs leading-relaxed text-[#698076]">{kind === "bowel" ? "A foto poderá ser analisada por IA para sugerir uma escala de Bristol. Você sempre confirma antes de salvar." : "A foto fica vinculada ao evento da refeição para consulta futura."}</p>
          <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl bg-white px-3 py-3 text-sm font-semibold text-[#39734f] shadow-sm">
            {photoName ? "Trocar foto" : "Selecionar foto"}
            <input type="file" accept="image/*" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setPhotoName(file.name);
              setPhotoFile(file);
              setPhotoPreview(URL.createObjectURL(file));
              setAiStatus(null);
              setAiBristol(null);
            }} />
          </label>
          {photoPreview && <div className="mt-3 flex items-center gap-3">
            <img src={photoPreview} alt="Pré-visualização da evacuação" className="h-16 w-16 rounded-xl object-cover" />
            <div className="min-w-0 flex-1"><p className="truncate text-xs text-[#527063]">{photoName}</p>
              {kind === "bowel" && <button type="button" className="mt-1 text-xs font-semibold text-[#39734f]" onClick={() => setAiStatus("A análise automática será ativada quando o provedor de IA estiver configurado. Por enquanto, escolha a escala manualmente.")}>✨ Preparar análise com IA</button>}
            </div>
          </div>}
          {aiStatus && <p className="mt-2 text-xs font-medium text-[#39734f]">{aiStatus}</p>}
        </div>}
        {kind === "symptom" && <label className="mt-4 block text-sm font-semibold">Sintoma
          <select name="value" defaultValue="Cólica" className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base">{["Cólica", "Gases", "Estufamento", "Náusea", "Refluxo", "Outro"].map((s) => <option key={s}>{s}</option>)}</select>
        </label>}
        {(kind === "bowel" || kind === "symptom") && <label className="mt-4 block text-sm font-semibold">{kind === "bowel" ? "Urgência (0 a 5)" : "Intensidade (0 a 10)"}
          <input name="intensity" type="number" min="0" max={kind === "bowel" ? "5" : "10"} defaultValue={kind === "bowel" ? "0" : "5"} className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
        </label>}
        {kind === "symptom" && <label className="mt-4 block text-sm font-semibold">Observação (opcional)
          <input name="details" className="mt-2 block w-full rounded-xl border border-[#dce5dd] bg-white px-3 py-3 text-base" />
        </label>}
        <button className="mt-6 w-full rounded-2xl bg-[#1e6341] py-4 font-semibold text-white">Salvar registro</button>
      </form>
    </div>
  );
}
