"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const groups = [
  { key: "meal-categories", title: "Categorias de refeição", defaults: ["Café da manhã", "Almoço", "Lanche", "Jantar", "Ceia"] },
  { key: "exercise-categories", title: "Atividades físicas", defaults: ["Caminhada", "Corrida", "Musculação"] },
  { key: "tea-types", title: "Tipos de chá", defaults: ["Camomila", "Hortelã", "Erva-doce", "Gengibre", "Verde", "Preto", "Outro"] },
  { key: "supplements", title: "Suplementos", defaults: ["Probiótico", "Magnésio", "Vitamina D", "Ômega 3", "Glutamina", "Enzima digestiva"] },
  { key: "symptoms", title: "Sintomas", defaults: ["Cólica", "Gases", "Estufamento", "Náusea", "Refluxo", "Outro"] },
  { key: "natural-treatments", title: "Tratamentos naturais", defaults: ["Escalda-pés", "Banho de tronco", "Banho de assento"] },
  { key: "urine-stream-quality", title: "Qualidade do jato", defaults: ["Normal", "Fraco", "Interrompido", "Muito forte"] },
  { key: "urine-color", title: "Cores da urina", defaults: ["Transparente", "Amarelo claro", "Amarelo escuro", "Âmbar", "Avermelhada", "Outra"] },
  { key: "urine-burning", title: "Ardência ao urinar", defaults: ["Não", "Leve", "Moderada", "Intensa"] },
];

function CategoryGroup({ group }: { group: (typeof groups)[number] }) {
  const [items, setItems] = useState(group.defaults);
  const [newItem, setNewItem] = useState("");
  const isSupplement = group.key === "supplements";
  const [schedules, setSchedules] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSchedule, setEditSchedule] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`meuintestino:${group.key}`) || "null");
      if (Array.isArray(saved)) setItems([...new Set(saved.map(String))]);
    } catch { /* usa padrões */ }
  }, [group.key]);

  useEffect(() => {
    if (!isSupplement) return;
    try {
      const saved = JSON.parse(localStorage.getItem("meuintestino:supplement-schedules") || "{}");
      if (saved && typeof saved === "object") setSchedules(saved);
    } catch { /* usa horários vazios */ }
  }, [isSupplement]);

  function persist(next: string[]) {
    setItems(next);
    localStorage.setItem(`meuintestino:${group.key}`, JSON.stringify(next));
  }

  function add() {
    const value = newItem.trim();
    if (!value || items.includes(value)) return;
    persist([...items, value]);
    setNewItem("");
  }

  function edit(item: string) {
    if (isSupplement) {
      setEditing(item); setEditName(item); setEditSchedule(schedules[item] || ""); return;
    }
    const value = window.prompt("Editar item", item)?.trim();
    if (!value || value === item || items.includes(value)) return;
    persist(items.map((current) => current === item ? value : current));
  }

  function saveSupplement() {
    if (!editing) return;
    const name = editName.trim();
    if (!name || (name !== editing && items.includes(name))) return;
    if (name !== editing) persist(items.map((item) => item === editing ? name : item));
    const next = { ...schedules };
    delete next[editing]; next[name] = editSchedule.trim();
    setSchedules(next); localStorage.setItem("meuintestino:supplement-schedules", JSON.stringify(next));
    setEditing(null);
  }

  function remove(item: string) {
    if (!window.confirm(`Excluir “${item}” da lista?`)) return;
    persist(items.filter((current) => current !== item));
  }

  return <section className="rounded-3xl border border-[#e8f5f2] bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-[#18342b]">{group.title}</h2>{isSupplement && <p className="mt-1 text-xs text-[#698076]">Clique em editar para alterar nome e horário/frequência de uso.</p>}<div className="mt-3 space-y-2">{items.map((item) => <div key={item} className="flex items-center justify-between gap-3 rounded-xl bg-[#f7faf7] px-3 py-2.5"><span className="min-w-0 truncate text-sm">{item}{isSupplement && schedules[item] && <span className="ml-2 text-xs text-[#698076]">· {schedules[item]}</span>}</span><span className="flex shrink-0 gap-3"><button type="button" onClick={() => edit(item)} className="text-xs font-semibold text-[#39734f]">Editar</button><button type="button" onClick={() => remove(item)} className="text-xs text-[#a34a3d]">Excluir</button></span></div>)}</div><div className="mt-4 flex gap-2"><input value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") add(); }} placeholder="Adicionar item" className="min-w-0 flex-1 rounded-xl border border-[#dce5dd] px-3 py-2.5 text-sm" /><button type="button" onClick={add} className="rounded-xl bg-[#e9f3eb] px-3 text-xs font-semibold text-[#39734f]">Adicionar</button></div>{editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#18342b]/35 px-5" role="dialog" aria-modal="true" aria-label="Editar suplemento"><div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"><h3 className="text-xl font-bold">Editar suplemento</h3><label className="mt-4 block text-sm font-semibold">Nome<input value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-base" /></label><label className="mt-4 block text-sm font-semibold">Horário ou frequência de uso<input value={editSchedule} onChange={(event) => setEditSchedule(event.target.value)} placeholder="Ex.: 08:00 ou após o café" className="mt-2 w-full rounded-xl border border-[#dce5dd] px-3 py-3 text-base" /></label><div className="mt-5 flex gap-3"><button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-xl border border-[#b9cfc0] py-3 font-semibold text-[#39734f]">Cancelar</button><button type="button" onClick={saveSupplement} className="flex-1 rounded-xl bg-[#1b8b6f] py-3 font-semibold text-white">Salvar</button></div></div></div>}</section>;
}

export default function CategoriesPage() {
  return <main className="min-h-screen bg-[#fcfcf9] px-5 pb-12 pt-8 text-[#18342b]"><div className="mx-auto max-w-2xl"><Link href="/profile" className="text-sm font-semibold text-[#39734f]">← Minha conta</Link><p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-[#1b8b6f]">Personalização</p><h1 className="mt-1 text-3xl font-bold">Gerenciar categorias</h1><p className="mt-2 text-sm leading-relaxed text-[#698076]">Cadastre, edite ou exclua os itens que aparecem nos seus formulários. As listas ficam salvas neste dispositivo.</p><div className="mt-6 space-y-4">{groups.map((group) => <CategoryGroup key={group.key} group={group} />)}</div></div></main>;
}
