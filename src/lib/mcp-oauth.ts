import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  // Mantém compatibilidade com instalações já configuradas apenas com a
  // chave de serviço. Uma variável MCP_OAUTH_SECRET própria continua sendo
  // preferível quando disponível.
  const value = process.env.MCP_OAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("MCP_OAUTH_SECRET não configurado");
  return value;
}

function encode(value: string) { return Buffer.from(value).toString("base64url"); }
function decode(value: string) { return Buffer.from(value, "base64url").toString("utf8"); }

export function signMcpToken(payload: Record<string, unknown>) {
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret()).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyMcpToken(token: string) {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;
    const expected = createHmac("sha256", secret()).update(`${header}.${body}`).digest();
    const received = Buffer.from(signature, "base64url");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const payload = JSON.parse(decode(body)) as Record<string, unknown>;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}
