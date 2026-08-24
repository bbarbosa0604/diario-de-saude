import { NextResponse } from "next/server";
import { pkceChallenge, signMcpToken, verifyMcpToken } from "@/lib/mcp-oauth";

export async function POST(request: Request) {
  const form = await request.formData();
  const code = String(form.get("code") || "");
  const verifier = String(form.get("code_verifier") || "");
  const clientId = String(form.get("client_id") || "");
  const redirectUri = String(form.get("redirect_uri") || "");
  const payload = verifyMcpToken(code);
  if (!payload || payload.typ !== "authorization_code" || payload.client_id !== clientId || payload.redirect_uri !== redirectUri || payload.code_challenge !== pkceChallenge(verifier)) return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  const accessToken = signMcpToken({ typ: "mcp_access_token", sub: payload.sub, supabase_access_token: payload.supabase_access_token, exp: Math.floor(Date.now() / 1000) + 3600 });
  return NextResponse.json({ access_token: `mcp_${accessToken}`, token_type: "Bearer", expires_in: 3600 });
}
