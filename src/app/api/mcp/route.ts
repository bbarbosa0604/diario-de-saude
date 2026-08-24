import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const protocolVersion = "2025-06-18";

function jsonRpc(id: string | number | null, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function errorRpc(id: string | number | null, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: 400 });
}

function tools() {
  return [
    { name: "get_daily_events", description: "Consulta todos os eventos de saúde do usuário em uma data.", inputSchema: { type: "object", properties: { date: { type: "string", description: "Data no formato YYYY-MM-DD" } }, required: ["date"] }, annotations: { readOnlyHint: true } },
    { name: "get_daily_summary", description: "Consulta a análise de IA já salva para uma data do usuário.", inputSchema: { type: "object", properties: { date: { type: "string", description: "Data no formato YYYY-MM-DD" } }, required: ["date"] }, annotations: { readOnlyHint: true } },
    { name: "get_period_report", description: "Gera estatísticas estruturadas dos registros do usuário em um período.", inputSchema: { type: "object", properties: { startDate: { type: "string" }, endDate: { type: "string" } }, required: ["startDate", "endDate"] }, annotations: { readOnlyHint: true } },
  ];
}

async function authenticatedClient(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !key || !authorization?.startsWith("Bearer ")) return null;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, user: data.user };
}

function textResult(data: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export async function GET() {
  return NextResponse.json({ name: "Meuintestino MCP", protocolVersion, tools: tools().map((tool) => tool.name), authentication: "Bearer Supabase user access token" });
}

export async function POST(request: Request) {
  let message: { id?: string | number | null; method?: string; params?: Record<string, unknown> };
  try { message = await request.json(); } catch { return errorRpc(null, -32700, "JSON inválido."); }
  const id = message.id ?? null;
  if (message.method === "initialize") return jsonRpc(id, { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "Meuintestino MCP", version: "1.0.0" } });
  if (message.method === "notifications/initialized") return new NextResponse(null, { status: 204 });
  if (message.method === "tools/list") return jsonRpc(id, { tools: tools() });
  if (message.method !== "tools/call") return errorRpc(id, -32601, "Método MCP não suportado.");

  const auth = await authenticatedClient(request);
  if (!auth) return errorRpc(id, -32001, "Autenticação necessária.");
  const params = message.params ?? {};
  const name = String(params.name ?? "");
  const args = (params.arguments ?? {}) as Record<string, unknown>;
  const validDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

  if (name === "get_daily_events") {
    if (!validDate(args.date)) return errorRpc(id, -32602, "Informe date no formato YYYY-MM-DD.");
    const { data, error } = await auth.client.from("health_events").select("id,event_date,event_kind,event_time,title,detail,badge,tags,photo_path").eq("user_id", auth.user.id).eq("event_date", args.date).order("event_time", { ascending: true });
    if (error) return errorRpc(id, -32000, "Não foi possível consultar os eventos.");
    return jsonRpc(id, { content: [{ type: "text", text: JSON.stringify({ userId: auth.user.id, date: args.date, events: data ?? [] }, null, 2) }] });
  }
  if (name === "get_daily_summary") {
    if (!validDate(args.date)) return errorRpc(id, -32602, "Informe date no formato YYYY-MM-DD.");
    const { data, error } = await auth.client.from("ai_daily_summaries").select("event_date,summary,model,created_at").eq("user_id", auth.user.id).eq("event_date", args.date).maybeSingle();
    if (error) return errorRpc(id, -32000, "Não foi possível consultar o resumo.");
    return jsonRpc(id, textResult(data ?? { date: args.date, summary: null }));
  }
  if (name === "get_period_report") {
    if (!validDate(args.startDate) || !validDate(args.endDate)) return errorRpc(id, -32602, "Informe startDate e endDate no formato YYYY-MM-DD.");
    const { data, error } = await auth.client.from("health_events").select("event_date,event_kind,event_time,title,detail,badge,tags").eq("user_id", auth.user.id).gte("event_date", args.startDate).lte("event_date", args.endDate).order("event_date", { ascending: true }).order("event_time", { ascending: true });
    if (error) return errorRpc(id, -32000, "Não foi possível gerar o relatório.");
    const events = data ?? [];
    const byKind = Object.fromEntries([...new Set(events.map((event) => event.event_kind))].map((kind) => [kind, events.filter((event) => event.event_kind === kind).length]));
    return jsonRpc(id, textResult({ userId: auth.user.id, startDate: args.startDate, endDate: args.endDate, totalEvents: events.length, byKind, events }));
  }
  return errorRpc(id, -32602, "Ferramenta MCP não encontrada.");
}
