import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "A análise por IA ainda não foi configurada neste ambiente." }, { status: 503 });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!supabaseUrl || !supabaseKey || !authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Sessão não autenticada." }, { status: 401 });
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  let body: { date?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos para análise." }, { status: 400 }); }
  const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
  if (!date) return NextResponse.json({ error: "Data inválida para análise." }, { status: 400 });
  const { data: rows, error: eventsError } = await supabase.from("health_events").select("event_kind,event_time,title,detail,badge,tags").eq("user_id", userData.user.id).eq("event_date", date).order("event_time", { ascending: true }).limit(100);
  if (eventsError) return NextResponse.json({ error: "Não foi possível carregar os registros deste usuário." }, { status: 500 });
  const events = (rows ?? []).map((event) => ({ tipo: event.event_kind, horário: event.event_time, título: event.title, detalhe: event.detail, marcador: event.badge ?? "", tags: event.tags ?? [] }));
  const intestinalHistory = String(userData.user.user_metadata?.intestinal_history ?? "").slice(0, 4000);
  const { data: memories } = await supabase.from("ai_daily_summaries").select("event_date,summary").eq("user_id", userData.user.id).order("event_date", { ascending: false }).limit(5);
  const prompt = `Analise os registros de saúde gastrointestinal do usuário no dia ${date}.\n\nRegistros:\n${JSON.stringify(events, null, 2)}\n\nHistórico intestinal informado pelo usuário (contexto inicial, não diagnóstico):\n${intestinalHistory || "Nenhum histórico informado."}\n\nResumos anteriores do mesmo usuário, para manter continuidade (não misture com outros usuários):\n${JSON.stringify(memories ?? [], null, 2)}\n\nEscreva um resumo curto em português do Brasil, com no máximo 3 parágrafos. Aponte apenas padrões temporais ou associações observadas nos registros, sem afirmar causa, diagnóstico, intolerância ou recomendação de tratamento. Se não houver dados suficientes, diga isso claramente. Não invente informações. Sempre inclua uma frase final equivalente a: "Isso é uma associação observada nos seus registros e não significa necessariamente causa e efeito."`;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5-mini", instructions: "Você é um assistente de diário de saúde. Não diagnostique doenças e não dê orientações médicas. Seja claro, cuidadoso e baseado somente nos dados recebidos.", input: prompt, store: false }) });
    const data = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }>; error?: { message?: string } };
    if (!response.ok) return NextResponse.json({ error: data.error?.message || "Não foi possível gerar a análise." }, { status: 502 });
    const text = data.output_text || data.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join(" ").trim();
    if (!text) return NextResponse.json({ error: "A IA não retornou um resumo." }, { status: 502 });
    const { error: memoryError } = await supabase.from("ai_daily_summaries").upsert({ user_id: userData.user.id, event_date: date, summary: text, model: process.env.OPENAI_MODEL || "gpt-5-mini" }, { onConflict: "user_id,event_date" });
    if (memoryError) return NextResponse.json({ error: "A análise foi gerada, mas não pôde ser gravada na memória segura do usuário." }, { status: 500 });
    return NextResponse.json({ summary: text });
  } catch { return NextResponse.json({ error: "Não foi possível conectar ao serviço de IA." }, { status: 502 }); }
}
