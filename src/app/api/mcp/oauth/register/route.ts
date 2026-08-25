import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { redirect_uris?: string[]; client_name?: string };
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((uri) => typeof uri === "string") : [];
  if (!redirectUris.length) return NextResponse.json({ error: "redirect_uris é obrigatório" }, { status: 400 });
  const clientId = `meuintestino-${createHash("sha256").update(redirectUris.join("|")).digest("hex").slice(0, 20)}`;
  return NextResponse.json({ client_id: clientId, client_name: body.client_name || "Meu Intestino MCP", redirect_uris: redirectUris, token_endpoint_auth_method: "none" });
}
