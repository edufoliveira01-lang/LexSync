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
  variante?: "comum" | "representado" | "rogo";
  representante?: PessoaDoContrato; a_rogo?: PessoaDoContrato;
  campos?: Record<string, string>; modelo_honorarios?: string;
  /** De onde o lead veio e quando entrou: o Sales guarda no negócio do cliente (tela Captação). */
  fonte?: string; data_entrada?: string;
}
/** Quem assina no lugar do cliente: o representante (menor, incapaz) ou quem assina a rogo. */
export interface PessoaDoContrato { nome?: string; nacionalidade?: string; estado_civil?: string; profissao?: string; rg?: string; cpf?: string; endereco?: string; qualidade?: string }
/** O que o escritório configurou no Sales: tipos de documento, valores próprios e modelos de cláusula de honorários. */
export interface OpcoesDoEscritorio {
  variantes: { id: "comum" | "representado" | "rogo"; nome: string }[];
  campos: { id: string; rotulo: string; tipo: string; padrao: string }[];
  modelos_honorarios: { id: string; nome: string }[];
}
export interface EnvelopePedido { tipo: string; nome: string; sign_url: string }
export interface ContratoPedido { id: number; pessoa_id: number; status: string; sign_url: string; documentos: EnvelopePedido[]; email_enviado: boolean }
export interface EstadoDoContrato { id: number; status: "enviado" | "assinado"; assinado_em: string | null; arquivo_salvo?: boolean; assinados?: number; total?: number }

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export function configDosContratos(env: NodeJS.ProcessEnv = process.env): { url: string; segredo: string } | null {
  const url = (env.SALES_PAINEL_URL || "").trim().replace(/\/+$/, "");
  const segredo = (env.CONTRATOS_SEGREDO || "").trim();
  return url && segredo.length >= 32 ? { url, segredo } : null;
}

export function assinar(segredo: string, metodo: string, caminho: string, corpo: string, ts: number): string {
  return createHmac("sha256", segredo).update(`${ts}.${metodo.toUpperCase()}.${caminho}.${sha256(corpo)}`).digest("hex");
}

async function chamar<T>(slug: string, metodo: "GET" | "POST", sufixo: string, corpo: unknown, http: typeof fetch, recurso: "contratos" | "agente" | "documentos" | "armazenamento" | "indicadores" | "anotacoes" | "cadastro" | "cobranca" = "contratos"): Promise<T> {
  const cfg = configDosContratos();
  if (!cfg) throw new ErroContratoSales("A geração de contratos ainda não foi ligada neste servidor (SALES_PAINEL_URL e CONTRATOS_SEGREDO).", 503);
  const caminho = `/v1/offices/${encodeURIComponent(slug)}/${recurso}${sufixo}`;
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
export const opcoesDoEscritorio = (slug: string, http: typeof fetch = fetch) => chamar<OpcoesDoEscritorio>(slug, "GET", "/opcoes", undefined, http);

/** O prompt do agente deste escritório, montado pelo Sales a partir do cadastro (Atendimento com IA + dados do escritório). */
export interface PromptDoAgente { prompt: string; nome_agente: string; pendencias: string[] }
export const promptDoAgenteDoEscritorio = (slug: string, http: typeof fetch = fetch) => chamar<PromptDoAgente>(slug, "GET", "/prompt", undefined, http, "agente");

/** Documento que o cliente mandou pelo chat, já classificado. O arquivo vai por LINK TEMPORÁRIO (o Sales baixa); depois da assinatura do contrato, segue para o drive. */
export interface DocumentoDoChatParaOSales {
  origem_ref: string; tipo: string; titulo: string; extensao: string; url: string;
  telefone?: string; cpf?: string; data?: string;
}
export type SituacaoDoDocumentoNoSales = "enfileirado" | "aguardando_assinatura" | "ja_recebido" | "drive_nao_configurado";
export const enviarDocumentoDoChat = (slug: string, dados: DocumentoDoChatParaOSales, http: typeof fetch = fetch) =>
  chamar<{ situacao: SituacaoDoDocumentoNoSales }>(slug, "POST", "", dados, http, "documentos");

/** A saúde do envio ao drive deste escritório (o Sales devolve um `problema` em frase quando há erro, e uma `chave` estável do problema). */
export interface SaudeDoArmazenamento { ligado: boolean; problema: string | null; chave: string; aguardando_pasta: number; esperando_assinatura: number }
export const saudeDoArmazenamento = (slug: string, http: typeof fetch = fetch) => chamar<SaudeDoArmazenamento>(slug, "GET", "/saude", undefined, http, "armazenamento");

/** O retrato dos indicadores do atendimento, que o Deskcomm empurra para a tela Início do Sales. */
export const enviarIndicadoresDoAtendimento = (slug: string, retrato: unknown, http: typeof fetch = fetch) =>
  chamar<{ ok: boolean }>(slug, "POST", "", retrato, http, "indicadores");

/** Anotação rápida (Alt+N na conversa): o Sales acha o cliente pelo telefone e grava no cadastro ou no processo escolhido. */
export interface ClienteParaAnotar {
  encontrado: boolean;
  pessoa?: { id: number; nome: string };
  processos?: { id: number; pasta: string; numero: string; titulo: string; status: string }[];
  recentes?: { autor: string; texto: string; criado_em: string; onde: string }[];
  /** Anotações IMPORTANTES ainda não cumpridas (Sales ≥ 3.33.0; versões antigas não mandam). */
  pendencias?: PendenciaDoSales[];
}
/** Anotação marcada como importante que ninguém deu por cumprida: o aviso que o atendente vê na conversa. */
export interface PendenciaDoSales { id: number; origem: "cadastro" | "processo"; autor: string; texto: string; criado_em: string; onde: string }
export const buscarClienteParaAnotar = (slug: string, telefone: string, http: typeof fetch = fetch) =>
  chamar<ClienteParaAnotar>(slug, "POST", "/buscar", { telefone }, http, "anotacoes");
export const anotarNoSales = (slug: string, dados: { pessoa_id: number; processo_id?: number; texto: string; importante?: boolean; autor_nome: string; autor_email: string }, http: typeof fetch = fetch) =>
  chamar<{ ok: boolean; destino: "cadastro" | "processo" }>(slug, "POST", "", dados, http, "anotacoes");

/** As pendências do cliente desta conversa (só elas, leve): o aviso que fica no chat. */
export const pendenciasDoClienteNoSales = (slug: string, telefone: string, http: typeof fetch = fetch) =>
  chamar<{ encontrado: boolean; pessoa?: { id: number; nome: string }; pendencias: PendenciaDoSales[] }>(slug, "POST", "/pendencias", { telefone }, http, "anotacoes");
/** O atendente dá a pendência por cumprida (ou a reabre): no Sales ela some do aviso e a anotação segue no histórico, com o nome de quem cumpriu. */
export const cumprirPendenciaNoSales = (slug: string, dados: { origem: "cadastro" | "processo"; id: number; cumprida?: boolean; autor_nome: string; autor_email: string }, http: typeof fetch = fetch) =>
  chamar<{ ok: boolean }>(slug, "POST", "/cumprir", dados, http, "anotacoes");

/** Correção do cadastro do cliente pelo atendimento: o Sales troca só os campos de contato e endereço (os demais ele ignora) e deixa o histórico na ficha. */
export interface ResultadoDoCadastroNoSales { ok: boolean; pessoa_id: number; alterados: string[]; iguais: string[]; ignorados: string[] }
export const atualizarCadastroNoSales = (slug: string, dados: { pessoa_id: number; campos: Record<string, string>; autor_nome: string; autor_email?: string }, http: typeof fetch = fetch) =>
  chamar<ResultadoDoCadastroNoSales>(slug, "POST", "", dados, http, "cadastro");

/** A cobrança (boleto + PIX) de uma parcela em aberto do cliente do telefone. O Sales gera no Asaas (ou devolve a que já existe). */
export interface CobrancaDoCliente {
  lancamento_id: number; descricao: string; valor_centavos: number; vencimento: string;
  link: string; linha_digitavel: string; pix: string; boleto_pdf_base64: string | null; boleto_pdf_nome: string | null; outras_em_aberto: number;
}
export const cobrancaDoClienteNoSales = (slug: string, dados: { telefone: string; lancamento_id?: number }, http: typeof fetch = fetch) =>
  chamar<CobrancaDoCliente>(slug, "POST", "", dados, http, "cobranca");
