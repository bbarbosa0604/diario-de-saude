import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!apiKey || !supabaseUrl || !supabaseKey || !authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Serviço de classificação não configurado." }, { status: 503 });
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const body = await request.json() as { eventId?: string; photoPath?: string };
  if (!body.eventId || !body.photoPath) return NextResponse.json({ error: "Evento e foto são obrigatórios." }, { status: 400 });
  const { data: event, error: eventError } = await supabase.from("health_events").select("id,event_kind,photo_path,detail,tags").eq("id", body.eventId).eq("user_id", userData.user.id).eq("event_kind", "bowel").maybeSingle();
  if (eventError || !event || event.photo_path !== body.photoPath) return NextResponse.json({ error: "Evacuação não encontrada." }, { status: 404 });
  const { data: signed, error: signedError } = await supabase.storage.from("health-event-photos").createSignedUrl(body.photoPath, 300);
  if (signedError || !signed?.signedUrl) return NextResponse.json({ error: "Não foi possível acessar a foto com segurança." }, { status: 500 });
  const prompt = "Analise exclusivamente a imagem de uma evacuação para estimar a escala de Bristol. Responda exatamente no formato: BRISTOL: N\nCONFIANCA: baixa|moderada|alta\nOBSERVACAO: frase curta. N deve ser um inteiro de 1 a 7. Se a imagem não permitir avaliação confiável, use BRISTOL: 0 e explique na observação. Não faça diagnóstico.";
  try {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5-mini", instructions: "Você é um classificador visual cauteloso. Não diagnostique nem recomende tratamento.", input: [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_image", image_url: signed.signedUrl, detail: "low" }] }], store: false }) });
    const data = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }>; error?: { message?: string } };
    if (!response.ok) return NextResponse.json({ error: data.error?.message || "A IA não conseguiu analisar a foto." }, { status: 502 });
    const text = data.output_text || data.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join(" ").trim() || "";
    const match = text.match(/BRISTOL\s*:\s*([0-7])/i);
    const bristolType = match ? Number(match[1]) : 0;
    if (bristolType < 1 || bristolType > 7) return NextResponse.json({ bristolType: 0, confidence: "baixa" });
    const cleanDetail = `${event.detail} · Bristol ${bristolType} (IA)`;
    const cleanTags = [...new Set([...(event.tags ?? []).filter((tag: string) => tag !== "classificação pendente"), "foto", "classificado pela IA", `bristol-${bristolType}`])];
    const { error: updateError } = await supabase.from("health_events").update({ detail: cleanDetail, badge: `B${bristolType}`, tags: cleanTags }).eq("id", event.id).eq("user_id", userData.user.id);
    if (updateError) return NextResponse.json({ error: "A foto foi analisada, mas o resultado não pôde ser salvo." }, { status: 500 });
    return NextResponse.json({ bristolType, confidence: text.match(/CONFIANCA\s*:\s*(baixa|moderada|alta)/i)?.[1] || "baixa" });
  } catch { return NextResponse.json({ error: "Não foi possível conectar ao serviço de IA." }, { status: 502 }); }
}
