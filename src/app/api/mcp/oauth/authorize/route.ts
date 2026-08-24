import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { signMcpToken } from "@/lib/mcp-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = new URL("/mcp/authorize", url.origin);
  url.searchParams.forEach((value, key) => destination.searchParams.set(key, value));
  return NextResponse.redirect(destination);
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey || !authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Sessão não autenticada" }, { status: 401 });
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } });
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  const body = await request.json() as { client_id?: string; redirect_uri?: string; state?: string; code_challenge?: string; code_challenge_method?: string };
  if (!body.client_id || !body.redirect_uri || !body.code_challenge || body.code_challenge_method !== "S256") return NextResponse.json({ error: "Parâmetros OAuth inválidos" }, { status: 400 });
  const redirect = new URL(body.redirect_uri);
  if (redirect.protocol !== "https:" && redirect.hostname !== "localhost") return NextResponse.json({ error: "redirect_uri não permitido" }, { status: 400 });
  const code = signMcpToken({ typ: "authorization_code", sub: data.user.id, supabase_access_token: authorization.slice(7), client_id: body.client_id, redirect_uri: body.redirect_uri, code_challenge: body.code_challenge, exp: Math.floor(Date.now() / 1000) + 120 });
  const callback = new URL(body.redirect_uri);
  callback.searchParams.set("code", code);
  if (body.state) callback.searchParams.set("state", body.state);
  return NextResponse.json({ redirect_uri: callback.toString() });
}
