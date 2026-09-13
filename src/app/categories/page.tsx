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

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`meuintestino:${group.key}`) || "null");
      if (Array.isArray(saved)) setItems([...new Set(saved.map(String))]);
    } catch { /* usa padrões */ }
  }, [group.key]);

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
    const value = window.prompt("Editar item", item)?.trim();
    if (!value || value === item || items.includes(value)) return;
    persist(items.map((current) => current === item ? value : current));
  }

  function remove(item: string) {
    if (!window.confirm(`Excluir “${item}” da lista?`)) return;
    persist(items.filter((current) => current !== item));
  }

  return <section className="rounded-3xl border border-[#e8f5f2] bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-[#18342b]">{group.title}</h2><div className="mt-3 space-y-2">{items.map((item) => <div key={item} className="flex items-center justify-between gap-3 rounded-xl bg-[#f7faf7] px-3 py-2.5"><span className="truncate text-sm">{item}</span><span className="flex shrink-0 gap-3"><button type="button" onClick={() => edit(item)} className="text-xs font-semibold text-[#39734f]">Editar</button><button type="button" onClick={() => remove(item)} className="text-xs text-[#a34a3d]">Excluir</button></span></div>)}</div><div className="mt-4 flex gap-2"><input value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") add(); }} placeholder="Adicionar item" className="min-w-0 flex-1 rounded-xl border border-[#dce5dd] px-3 py-2.5 text-sm" /><button type="button" onClick={add} className="rounded-xl bg-[#e9f3eb] px-3 text-xs font-semibold text-[#39734f]">Adicionar</button></div></section>;
}

export default function CategoriesPage() {
  return <main className="min-h-screen bg-[#fcfcf9] px-5 pb-12 pt-8 text-[#18342b]"><div className="mx-auto max-w-2xl"><Link href="/profile" className="text-sm font-semibold text-[#39734f]">← Minha conta</Link><p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-[#1b8b6f]">Personalização</p><h1 className="mt-1 text-3xl font-bold">Gerenciar categorias</h1><p className="mt-2 text-sm leading-relaxed text-[#698076]">Cadastre, edite ou exclua os itens que aparecem nos seus formulários. As listas ficam salvas neste dispositivo.</p><div className="mt-6 space-y-4">{groups.map((group) => <CategoryGroup key={group.key} group={group} />)}</div></div></main>;
}
