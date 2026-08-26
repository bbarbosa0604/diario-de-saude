import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyMcpToken } from "@/lib/mcp-oauth";

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
    { name: "get_medical_exams", description: "Lista os exames e documentos privados cadastrados pelo usuário.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true } },
    { name: "get_intestinal_history", description: "Consulta o histórico intestinal informado pelo usuário no perfil.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true } },
  ];
}

async function authenticatedClient(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !key || !authorization?.startsWith("Bearer ")) return null;
  let supabaseAuthorization = authorization;
  if (authorization.startsWith("Bearer mcp_")) {
    const payload = verifyMcpToken(authorization.slice("Bearer mcp_".length));
    if (!payload || payload.typ !== "mcp_access_token" || typeof payload.supabase_access_token !== "string") return null;
    supabaseAuthorization = `Bearer ${payload.supabase_access_token}`;
  }
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: supabaseAuthorization } } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, user: data.user };
}

function textResult(data: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export async function GET() {
  return NextResponse.json({ name: "Meu Intestino MCP", protocolVersion, tools: tools().map((tool) => tool.name), authentication: "Bearer Supabase user access token" });
}

export async function POST(request: Request) {
  let message: { id?: string | number | null; method?: string; params?: Record<string, unknown> };
  try { message = await request.json(); } catch { return errorRpc(null, -32700, "JSON inválido."); }
  const id = message.id ?? null;
  if (message.method === "initialize") {
    const requested = typeof message.params?.protocolVersion === "string" ? message.params.protocolVersion : "";
    const negotiatedVersion = ["2025-06-18", "2025-03-26", "2024-11-05"].includes(requested) ? requested : protocolVersion;
    return jsonRpc(id, { protocolVersion: negotiatedVersion, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "Meu Intestino MCP", version: "1.0.0" } });
  }
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
    return jsonRpc(id, { content: [{ type: "text", text: JSON.stringify({ date: args.date, events: data ?? [] }, null, 2) }] });
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
    return jsonRpc(id, textResult({ startDate: args.startDate, endDate: args.endDate, totalEvents: events.length, byKind, events }));
  }
  if (name === "get_medical_exams") {
    const { data, error } = await auth.client.from("medical_documents").select("id,name,exam_date,mime_type,size_bytes,created_at,storage_path").eq("user_id", auth.user.id).order("exam_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    if (error) return errorRpc(id, -32000, "Não foi possível consultar os exames. Verifique se a tabela medical_documents foi criada no Supabase.");
    const documents = await Promise.all((data ?? []).map(async (document) => {
      const { data: signed } = await auth.client.storage.from("medical-exams").createSignedUrl(document.storage_path, 300);
      return { id: document.id, name: document.name, examDate: document.exam_date, mimeType: document.mime_type, sizeBytes: document.size_bytes, createdAt: document.created_at, temporaryUrl: signed?.signedUrl ?? null };
    }));
    return jsonRpc(id, textResult({ documents, note: "Os links dos arquivos são temporários e expiram em 5 minutos." }));
  }
  if (name === "get_intestinal_history") {
    const history = typeof auth.user.user_metadata?.intestinal_history === "string" ? auth.user.user_metadata.intestinal_history : "";
    return jsonRpc(id, textResult({ history: history || null, available: Boolean(history), note: "Este texto é um contexto pessoal informado pelo usuário e não representa diagnóstico médico." }));
  }
  return errorRpc(id, -32602, "Ferramenta MCP não encontrada.");
}
