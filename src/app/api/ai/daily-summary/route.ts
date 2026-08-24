import { NextResponse } from "next/server";

type SummaryEvent = {
  kind?: string;
  date?: string;
  time?: string;
  title?: string;
  detail?: string;
  badge?: string;
  tags?: string[];
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "A análise por IA ainda não foi configurada neste ambiente." }, { status: 503 });
  }

  let body: { date?: string; events?: SummaryEvent[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos para análise." }, { status: 400 });
  }

  const events = Array.isArray(body.events) ? body.events.slice(0, 100).map((event) => ({
    tipo: String(event.kind ?? "evento"),
    horário: String(event.time ?? ""),
    título: String(event.title ?? ""),
    detalhe: String(event.detail ?? ""),
    marcador: String(event.badge ?? ""),
    tags: Array.isArray(event.tags) ? event.tags.slice(0, 10).map(String) : [],
  })) : [];

  const prompt = `Analise os registros de saúde gastrointestinal do usuário no dia ${body.date ?? "informado"}.

Registros:
${JSON.stringify(events, null, 2)}

Escreva um resumo curto em português do Brasil, com no máximo 3 parágrafos. Aponte apenas padrões temporais ou associações observadas nos registros, sem afirmar causa, diagnóstico, intolerância ou recomendação de tratamento. Se não houver dados suficientes, diga isso claramente. Não invente informações. Sempre inclua uma frase final equivalente a: "Isso é uma associação observada nos seus registros e não significa necessariamente causa e efeito."`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        instructions: "Você é um assistente de diário de saúde. Não diagnostique doenças e não dê orientações médicas. Seja claro, cuidadoso e baseado somente nos dados recebidos.",
        input: prompt,
        store: false,
      }),
    });
    const data = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }>; error?: { message?: string } };
    if (!response.ok) return NextResponse.json({ error: data.error?.message || "Não foi possível gerar a análise." }, { status: 502 });
    const text = data.output_text || data.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join(" ").trim();
    if (!text) return NextResponse.json({ error: "A IA não retornou um resumo." }, { status: 502 });
    return NextResponse.json({ summary: text });
  } catch {
    return NextResponse.json({ error: "Não foi possível conectar ao serviço de IA." }, { status: 502 });
  }
}
