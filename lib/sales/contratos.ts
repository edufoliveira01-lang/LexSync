/**
 * Fork Sales — contratos pelo painel do Sales.
 *
 * O Deskcomm NÃO fala com o ZapSign nem com o cadastro do escritório: pede ao painel (Ubuntu), com um segredo
 * compartilhado (`CONTRATOS_SEGREDO`), e o painel repassa à instância do escritório. A assinatura cobre o corpo exato:
 * HMAC-SHA256 de `${ts}.${MÉTODO}.${caminho}.${sha256(corpo)}` — a mesma regra da ponte do atendimento.
 */
import { createHash, createHmac } from "node:crypto";

export class ErroContratoSales extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

export interface DadosDoContrato {
  nome: string; cpf: string; rg?: string; nacionalidade?: string; sexo?: string; estado_civil?: string; profissao?: string;
  logradouro: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; uf?: string; cep?: string;
  email?: string; telefone?: string; conversa_ref?: string; criado_por?: string;
}
export interface ContratoPedido { id: number; pessoa_id: number; status: string; sign_url: string; email_enviado: boolean }
export interface EstadoDoContrato { id: number; status: "enviado" | "assinado"; sign_url: string; assinado_em: string | null }

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export function configDosContratos(env: NodeJS.ProcessEnv = process.env): { url: string; segredo: string } | null {
  const url = (env.SALES_PAINEL_URL || "").trim().replace(/\/+$/, "");
  const segredo = (env.CONTRATOS_SEGREDO || "").trim();
  return url && segredo.length >= 32 ? { url, segredo } : null;
}

export function assinar(segredo: string, metodo: string, caminho: string, corpo: string, ts: number): string {
  return createHmac("sha256", segredo).update(`${ts}.${metodo.toUpperCase()}.${caminho}.${sha256(corpo)}`).digest("hex");
}

async function chamar<T>(slug: string, metodo: "GET" | "POST", sufixo: string, corpo: unknown, http: typeof fetch): Promise<T> {
  const cfg = configDosContratos();
  if (!cfg) throw new ErroContratoSales("A geração de contratos ainda não foi ligada neste servidor (SALES_PAINEL_URL e CONTRATOS_SEGREDO).", 503);
  const caminho = `/v1/offices/${encodeURIComponent(slug)}/contratos${sufixo}`;
  const texto = metodo === "POST" ? JSON.stringify(corpo ?? {}) : "";
  const ts = Math.floor(Date.now() / 1000);
  let r: Response;
  try {
    r = await http(`${cfg.url}/contratos${caminho}`, {
      method: metodo,
      headers: { "Content-Type": "application/json", "x-sales-timestamp": String(ts), "x-sales-signature": assinar(cfg.segredo, metodo, caminho, texto, ts) },
      body: metodo === "POST" ? texto : undefined,
      signal: AbortSignal.timeout(175_000),
    });
  } catch {
    throw new ErroContratoSales("Não foi possível falar com o painel do Sales. Tente de novo em instantes.", 504);
  }
  const json = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new ErroContratoSales(json.error || `O painel recusou o pedido (${r.status}).`, r.status === 401 ? 502 : r.status);
  return json as T;
}

export const pedirContrato = (slug: string, dados: DadosDoContrato, http: typeof fetch = fetch) => chamar<ContratoPedido>(slug, "POST", "", dados, http);
export const estadoDoContrato = (slug: string, id: number, http: typeof fetch = fetch) => chamar<EstadoDoContrato>(slug, "GET", `/${id}`, undefined, http);
