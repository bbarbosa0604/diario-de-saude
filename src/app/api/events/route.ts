import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!authorization?.startsWith("Bearer ") || !url || !key) {
    return NextResponse.json({ error: "Sessão não disponível." }, { status: 401 });
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  const { data, error } = await client
    .from("health_events")
    .select("id,event_date,event_kind,event_time,title,detail,badge,tags,photo_path")
    .eq("user_id", userData.user.id)
    .order("event_time", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!authorization?.startsWith("Bearer ") || !url || !key) return NextResponse.json({ error: "Sessão não disponível." }, { status: 401 });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: string; event_date?: string; event_kind?: string; event_time?: string; title?: string; detail?: string; badge?: string | null; tags?: string[]; photo_path?: string | null } | null;
  if (!body?.id || !body.event_date || !body.event_kind || !body.event_time || !body.title) return NextResponse.json({ error: "Dados do evento incompletos." }, { status: 400 });
  const { data, error } = await client.from("health_events").insert({ id: body.id, user_id: userData.user.id, event_date: body.event_date, event_kind: body.event_kind, event_time: body.event_time, title: body.title, detail: body.detail || "", badge: body.badge || null, tags: Array.isArray(body.tags) ? body.tags : [], photo_path: body.photo_path || null }).select("id,event_date,event_kind,event_time,title,detail,badge,tags,photo_path").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201, headers: { "Cache-Control": "no-store" } });
}
