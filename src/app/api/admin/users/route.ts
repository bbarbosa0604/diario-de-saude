import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAILS = new Set(["bbarbosa0604@gmail.com"]);

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !publishableKey || !authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });

  const sessionClient = createClient(url, publishableKey, { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } });
  const { data: sessionData } = await sessionClient.auth.getUser();
  const email = sessionData.user?.email?.toLowerCase();
  if (!email || !ADMIN_EMAILS.has(email)) return NextResponse.json({ error: "Acesso administrativo não autorizado." }, { status: 403 });
  if (!serviceRoleKey) return NextResponse.json({ error: "Configure SUPABASE_SERVICE_ROLE_KEY na Vercel para ativar o painel administrativo." }, { status: 503 });

  const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const allUsers: Array<{ id: string; email?: string; created_at: string; last_sign_in_at?: string | null; user_metadata?: Record<string, unknown> }> = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return NextResponse.json({ error: "Não foi possível listar os usuários." }, { status: 500 });
    allUsers.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const { data: events, error: eventsError } = await adminClient.from("health_events").select("user_id,event_date,created_at");
  if (eventsError) return NextResponse.json({ error: "Não foi possível calcular a frequência de uso." }, { status: 500 });
  const usage = new Map<string, { totalEvents: number; activeDays: Set<string>; lastActivity: string | null }>();
  for (const event of events ?? []) {
    const current = usage.get(event.user_id) ?? { totalEvents: 0, activeDays: new Set<string>(), lastActivity: null };
    current.totalEvents += 1;
    current.activeDays.add(event.event_date);
    if (!current.lastActivity || event.created_at > current.lastActivity) current.lastActivity = event.created_at;
    usage.set(event.user_id, current);
  }
  const users = allUsers.map((user) => {
    const stats = usage.get(user.id);
    return { id: user.id, email: user.email, name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null, createdAt: user.created_at, lastSignInAt: user.last_sign_in_at ?? null, totalEvents: stats?.totalEvents ?? 0, activeDays: stats?.activeDays.size ?? 0, lastActivity: stats?.lastActivity ?? null };
  }).sort((a, b) => (b.lastActivity || b.lastSignInAt || b.createdAt).localeCompare(a.lastActivity || a.lastSignInAt || a.createdAt));
  return NextResponse.json({ totalUsers: users.length, users });
}
