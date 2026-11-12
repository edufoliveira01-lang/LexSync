import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/** Assinatura das chamadas entre o painel/sistema Sales & Associados e a ponte. O mesmo formato existe do outro lado (server/src/atendimento/assinatura.ts). */
export const JANELA_SEGUNDOS = 300;
const sha256 = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const hmac = (chave: string, texto: string) => createHmac("sha256", chave).update(texto).digest("hex");
const igual = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export interface DadosDaRequisicao { metodo: string; caminho: string; corpo: string }
export const assinarRequisicao = (segredo: string, d: DadosDaRequisicao, ts: number) => hmac(segredo, `${ts}.${d.metodo.toUpperCase()}.${d.caminho}.${sha256(d.corpo)}`);

export function verificarRequisicao(segredo: string, d: DadosDaRequisicao, ts: string | undefined, assinatura: string | undefined, agora = Math.floor(Date.now() / 1000)): boolean {
  const n = Number(ts);
  if (!segredo || !assinatura || !Number.isInteger(n) || Math.abs(agora - n) > JANELA_SEGUNDOS) return false;
  return igual(assinarRequisicao(segredo, d, n), assinatura);
}

/** Chave própria de cada escritório para a entrada direta: o sistema do escritório nunca recebe o segredo geral. */
export const chaveSso = (segredo: string, slug: string) => hmac(segredo, `sso:${slug}`);
export interface TokenSso { slug: string; email: string; exp: number; jti: string; src?: string }
export function emitirTokenSso(chave: string, d: { slug: string; email: string; src?: string }, agora = Math.floor(Date.now() / 1000), validadeS = 60): string {
  const carga = b64u(JSON.stringify({ slug: d.slug, email: d.email, ...(d.src ? { src: d.src } : {}), exp: agora + validadeS, jti: randomUUID() } satisfies TokenSso));
  return `${carga}.${hmac(chave, carga)}`;
}
export function lerTokenSso(segredo: string, token: string, agora = Math.floor(Date.now() / 1000)): TokenSso | null {
  const [carga, assinatura, resto] = String(token).split(".");
  if (!carga || !assinatura || resto !== undefined) return null;
  let d: TokenSso;
  try { d = JSON.parse(Buffer.from(carga, "base64url").toString("utf8")) as TokenSso; } catch { return null; }
  if (typeof d?.slug !== "string" || typeof d.email !== "string" || typeof d.jti !== "string" || !Number.isInteger(d.exp) || !/^[a-z0-9-]{2,40}$/.test(d.slug)) return null;
  if (!igual(hmac(chaveSso(segredo, d.slug), carga), assinatura) || d.exp < agora) return null;
  return d;
}
