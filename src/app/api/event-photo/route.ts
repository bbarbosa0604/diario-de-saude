import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!authorization?.startsWith("Bearer ") || !url || !key) return NextResponse.json({ error: "Sessão não disponível." }, { status: 401 });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  const requestedPath = String(form.get("path") || "");
  if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Imagem inválida ou maior que 10 MB." }, { status: 400 });
  const path = requestedPath.startsWith(`${userData.user.id}/`) ? requestedPath : `${userData.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const { error } = await client.storage.from("health-event-photos").upload(path, file, { upsert: false, contentType: file.type });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path }, { status: 201 });
}
