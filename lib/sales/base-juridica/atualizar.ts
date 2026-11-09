/**
 * Fork Sales — atualização AUTOMÁTICA da base jurídica a partir de fontes OFICIAIS.
 *
 * Como funciona (e por que dá para confiar):
 *   1. Para cada ficha, o sistema baixa as páginas oficiais da própria ficha (e as que a busca restrita a domínios oficiais indicar).
 *   2. Um modelo compara o texto oficial com a ficha e propõe mudanças, cada uma com um TRECHO LITERAL da fonte.
 *   3. O sistema confere o trecho NO TEXTO BAIXADO. Mudança sem trecho que confira é descartada. Campos críticos (prazos, requisitos) exigem
 *      trechos conferidos de DUAS fontes diferentes; os demais, de uma.
 *   4. O que passa é gravado (nova versão da ficha, em quarentena de revisão: o agente passa a responder com ressalva) e o antes e o depois
 *      ficam no histórico, para o advogado ver e desfazer.
 * Só domínios oficiais (gov.br, jus.br, leg.br). Nada aqui derruba o atendimento: qualquer falha vira log e a ficha anterior continua valendo.
 */
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

import { carregarBase, limparCacheDaBase } from "./armazem";
import type { FichaJuridica } from "./fichas";
import { valorVigente } from "./valores";

export const SUFIXOS_OFICIAIS = ["gov.br", "jus.br", "leg.br"] as const;
export const DOMINIOS_DA_BUSCA = ["planalto.gov.br", "gov.br", "in.gov.br", "stf.jus.br", "stj.jus.br", "tst.jus.br", "jus.br", "camara.leg.br", "senado.leg.br"];

/** `true` só para https em domínio oficial. */
export function urlOficial(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && SUFIXOS_OFICIAIS.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export function textoDaPagina(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[\s ]+/g, " ").trim();

/** O trecho citado aparece, literalmente (ignorando acento, caixa e espaços), no texto da fonte? */
export function evidenciaConfere(trecho: string, textoDaFonte: string): boolean {
  const t = norm(trecho);
  return t.length >= 25 && norm(textoDaFonte).includes(t);
}

export function extrairJson(texto: string): unknown {
  const cerca = /```(?:json)?\s*([\s\S]*?)```/i.exec(texto);
  const candidato = cerca?.[1] ?? texto;
  const ini = candidato.indexOf("{");
  if (ini < 0) return null;
  let nivel = 0, emTexto = false, esc = false;
  for (let i = ini; i < candidato.length; i++) {
    const c = candidato[i]!;
    if (emTexto) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') emTexto = false; continue; }
    if (c === '"') emTexto = true; else if (c === "{") nivel++; else if (c === "}" && --nivel === 0) { try { return JSON.parse(candidato.slice(ini, i + 1)); } catch { return null; } }
  }
  return null;
}

export const CAMPOS_ATUALIZAVEIS = ["resumo", "requisitos", "alegacoes_comuns_do_inss", "teses_e_flexibilizacoes", "prazos", "a_favor", "contra", "perguntas_que_faltam", "cuidados"] as const;
type Campo = (typeof CAMPOS_ATUALIZAVEIS)[number];
/** Campos em que um erro custa caro: exigem trechos conferidos de DUAS fontes diferentes. */
export const CAMPOS_CRITICOS: readonly Campo[] = ["prazos", "requisitos"];

export interface Evidencia { campo: string; url: string; trecho: string }
export interface MudancaDecidida { campo: Campo; antes: unknown; depois: unknown; aceita: boolean; motivo: string; fontes: string[] }

/** Compara a proposta com a ficha atual e decide, campo a campo, o que vale. `textos` = texto baixado de cada URL citada. */
export function decidirAtualizacao(
  atual: FichaJuridica,
  proposta: Partial<Record<Campo, unknown>>,
  evidencias: readonly Evidencia[],
  textos: Readonly<Record<string, string>>,
  hoje = new Date(),
): { nova: FichaJuridica; mudancas: MudancaDecidida[]; aplicada: boolean } {
  const mudancas: MudancaDecidida[] = [];
  const nova: FichaJuridica = { ...atual };
  for (const campo of CAMPOS_ATUALIZAVEIS) {
    if (!(campo in proposta)) continue;
    const depois = proposta[campo];
    const antes = atual[campo];
    if (JSON.stringify(antes) === JSON.stringify(depois)) continue;
    const tipoOk = campo === "resumo" ? typeof depois === "string" && depois.trim().length > 20 : Array.isArray(depois) && depois.length > 0 && depois.every((x) => typeof x === "string" && x.trim());
    if (!tipoOk) { mudancas.push({ campo, antes, depois, aceita: false, motivo: "formato inválido", fontes: [] }); continue; }
    const validas = evidencias.filter((e) => e.campo === campo && urlOficial(e.url) && textos[e.url] && evidenciaConfere(e.trecho, textos[e.url]!));
    const fontes = [...new Set(validas.map((e) => e.url))];
    const exigidas = CAMPOS_CRITICOS.includes(campo) ? 2 : 1;
    if (fontes.length < exigidas) { mudancas.push({ campo, antes, depois, aceita: false, motivo: `a confirmar: ${fontes.length} fonte(s) oficial(is) com trecho conferido, e o campo exige ${exigidas}`, fontes }); continue; }
    (nova as unknown as Record<string, unknown>)[campo] = depois;
    mudancas.push({ campo, antes, depois, aceita: true, motivo: "trecho literal conferido na fonte oficial", fontes });
  }
  const aceitas = mudancas.filter((m) => m.aceita);
  if (aceitas.length === 0) return { nova: atual, mudancas, aplicada: false };
  const novasFontes = [...new Set(aceitas.flatMap((m) => m.fontes))].filter((u) => !atual.fontes.some((f) => f.url === u)).map((u) => ({ titulo: `Fonte oficial consultada em ${hoje.toISOString().slice(0, 10)}`, url: u }));
  nova.fontes = [...atual.fontes, ...novasFontes];
  nova.revisado_em = hoje.toISOString().slice(0, 10);
  // mudou por conta do sistema: fica em quarentena até um advogado conferir (o agente responde com ressalva)
  nova.status = "pendente_revisao";
  return { nova, mudancas, aplicada: true };
}

export interface Dependencias {
  baixar: (url: string) => Promise<string | null>;
  modelo: (prompt: string, opts: { busca: boolean }) => Promise<string | null>;
}

const UA = "Mozilla/5.0 (compatible; base-juridica/1.0)";

export const baixarOficial: Dependencias["baixar"] = async (url) => {
  if (!urlOficial(url)) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20_000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" }, signal: ctl.signal, redirect: "follow" });
    if (!r.ok || !urlOficial(r.url || url)) return null;
    return textoDaPagina((await r.text()).slice(0, 2_000_000)).slice(0, 200_000);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
};

export const modeloAnthropic: Dependencias["modelo"] = async (prompt, { busca }) => {
  const chave = process.env.BASE_JURIDICA_ANTHROPIC_KEY;
  if (!chave) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 180_000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.BASE_JURIDICA_MODEL || "claude-sonnet-5-5",
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
        ...(busca ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6, allowed_domains: DOMINIOS_DA_BUSCA }] } : {}),
      }),
      signal: ctl.signal,
    });
    if (!r.ok) { logger.warn("[base-juridica] o modelo recusou a chamada", { status: r.status }); return null; }
    const j = (await r.json()) as { content?: { type: string; text?: string }[] };
    return (j.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
  } catch (e) {
    logger.warn("[base-juridica] falha ao chamar o modelo", { erro: e instanceof Error ? e.message : String(e) });
    return null;
  } finally {
    clearTimeout(t);
  }
};

function promptDaFicha(ficha: FichaJuridica, fontes: Record<string, string>): string {
  const textos = Object.entries(fontes).map(([u, t]) => `### FONTE ${u}\n${t.slice(0, 60_000)}`).join("\n\n");
  return `Você revisa uma ficha jurídica brasileira usada por um atendente virtual de escritório de advocacia. Compare a FICHA ATUAL com as fontes OFICIAIS abaixo (e, se tiver busca, com o que for mais recente em fontes oficiais: leis, decretos, portarias, súmulas, temas do STF/STJ/TNU).
REGRAS: proponha mudança SOMENTE onde a fonte oficial mostrar que a ficha está desatualizada, incompleta ou errada. Cada mudança precisa de uma evidência com a URL oficial e um TRECHO LITERAL (copiado, entre 40 e 300 caracteres) dessa fonte; trecho que não existir na fonte será descartado. Não invente. Se nada mudou, devolva ficha_proposta vazia.
Devolva APENAS um JSON: {"ficha_proposta": {<campo>: <novo valor completo do campo>}, "evidencias": [{"campo": "<campo>", "url": "<url oficial>", "trecho": "<trecho literal>"}], "observacao": "<resumo curto>"}.
Campos permitidos: ${CAMPOS_ATUALIZAVEIS.join(", ")} (resumo é texto; os demais são listas de frases). Para prazos e requisitos, traga evidências de DUAS fontes diferentes.

FICHA ATUAL:
${JSON.stringify(Object.fromEntries(CAMPOS_ATUALIZAVEIS.map((c) => [c, ficha[c]])), null, 1)}

${textos}`;
}

export interface ResultadoDaFicha { tema: string; aplicada: boolean; mudancas: MudancaDecidida[]; erro?: string }

/** Atualiza UMA ficha. Não grava: devolve a decisão (quem chama grava). */
export async function atualizarFicha(ficha: FichaJuridica, deps: Dependencias, hoje = new Date()): Promise<{ nova: FichaJuridica; resultado: ResultadoDaFicha }> {
  const textos: Record<string, string> = {};
  for (const f of ficha.fontes) { if (!urlOficial(f.url)) continue; const t = await deps.baixar(f.url); if (t) textos[f.url] = t; }
  if (Object.keys(textos).length === 0) return { nova: ficha, resultado: { tema: ficha.tema, aplicada: false, mudancas: [], erro: "nenhuma fonte oficial pôde ser baixada" } };
  const resposta = await deps.modelo(promptDaFicha(ficha, textos), { busca: true });
  const j = resposta ? (extrairJson(resposta) as { ficha_proposta?: Partial<Record<Campo, unknown>>; evidencias?: Evidencia[] } | null) : null;
  if (!j || typeof j.ficha_proposta !== "object" || !j.ficha_proposta) return { nova: ficha, resultado: { tema: ficha.tema, aplicada: false, mudancas: [], erro: "resposta do modelo ausente ou ilegível" } };
  const evidencias = Array.isArray(j.evidencias) ? j.evidencias.filter((e) => e && typeof e.url === "string" && typeof e.trecho === "string" && typeof e.campo === "string") : [];
  // fontes citadas que não estavam na ficha (achadas pela busca): baixa para conferir o trecho (só as oficiais, no máximo 8)
  for (const u of [...new Set(evidencias.map((e) => e.url))].slice(0, 8)) if (!textos[u] && urlOficial(u)) { const t = await deps.baixar(u); if (t) textos[u] = t; }
  const d = decidirAtualizacao(ficha, j.ficha_proposta, evidencias, textos, hoje);
  return { nova: d.nova, resultado: { tema: ficha.tema, aplicada: d.aplicada, mudancas: d.mudancas } };
}

type Escreve = { upsert: (v: unknown, o?: unknown) => Promise<{ error: { message: string } | null }>; insert: (v: unknown) => Promise<{ error: { message: string } | null }> };
const escreve = (nome: string): Escreve => (createAdminClient() as unknown as { from: (n: string) => Escreve }).from(nome);

async function gravarFicha(antes: FichaJuridica, r: ResultadoDaFicha, nova: FichaJuridica): Promise<void> {
  const up = await escreve("sales_base_juridica_fichas").upsert({ tema: nova.tema, conteudo: nova, status: nova.status, revisado_em: nova.revisado_em, atualizado_em: new Date().toISOString(), atualizado_por: "sistema" }, { onConflict: "tema" });
  if (up.error) throw new Error(up.error.message);
  const h = await escreve("sales_base_juridica_historico").insert({ tema: nova.tema, antes, depois: nova, mudancas: r.mudancas, fontes: nova.fontes, motivo: "atualização automática" });
  if (h.error) logger.warn("[base-juridica] não consegui gravar o histórico", { tema: nova.tema, erro: h.error.message });
}

/** Salário mínimo: pesquisa em fontes oficiais, confere o número no texto da fonte citada e só então grava. */
export async function atualizarSalarioMinimo(deps: Dependencias, hoje = new Date()): Promise<{ gravado: boolean; motivo: string }> {
  const base = await carregarBase();
  const atual = valorVigente("salario_minimo", hoje, base.valores);
  const resposta = await deps.modelo(
    `Qual é o valor do salário mínimo nacional vigente no Brasil em ${hoje.toISOString().slice(0, 10)}? Use a busca, SOMENTE fontes oficiais (decreto no Diário Oficial, planalto.gov.br, gov.br). Devolva APENAS um JSON: {"valor": <número em reais, ex.: 1621>, "vigente_desde": "AAAA-MM-DD", "url": "<url oficial>", "trecho": "<trecho literal de 40 a 300 caracteres da página que traga o valor>"}.`,
    { busca: true },
  );
  const j = resposta ? (extrairJson(resposta) as { valor?: number; vigente_desde?: string; url?: string; trecho?: string } | null) : null;
  if (!j || typeof j.valor !== "number" || !j.url || !j.trecho || !/^\d{4}-\d{2}-\d{2}$/.test(j.vigente_desde ?? "")) return { gravado: false, motivo: "resposta ilegível" };
  if (atual && (j.valor < atual.valor * 0.9 || j.valor > atual.valor * 1.25)) return { gravado: false, motivo: "valor fora do plausível frente ao atual" };
  // mesmo valor e já confirmado: nada a fazer. Mesmo valor ainda "a confirmar": confere na fonte e marca como confirmado.
  if (atual && atual.valor === j.valor && atual.confirmado) return { gravado: false, motivo: "já está atualizado" };
  const texto = await deps.baixar(j.url);
  const formas = [j.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), j.valor.toLocaleString("pt-BR")];
  if (!texto || !evidenciaConfere(j.trecho, texto) || !formas.some((f) => norm(j.trecho!).includes(norm(f)))) return { gravado: false, motivo: "o trecho não confere com a fonte oficial" };
  const e = await escreve("sales_base_juridica_valores").upsert({ chave: "salario_minimo", vigente_desde: atual && atual.valor === j.valor ? atual.vigente_desde : j.vigente_desde, valor: j.valor, fonte: j.url, revisado_em: hoje.toISOString().slice(0, 10), confirmado: true }, { onConflict: "chave,vigente_desde" });
  if (e.error) return { gravado: false, motivo: e.error.message };
  limparCacheDaBase();
  return { gravado: true, motivo: "valor conferido na fonte oficial" };
}

export async function rodarAtualizacaoDaBase(deps: Dependencias = { baixar: baixarOficial, modelo: modeloAnthropic }): Promise<ResultadoDaFicha[]> {
  const resultados: ResultadoDaFicha[] = [];
  try {
    const sm = await atualizarSalarioMinimo(deps);
    logger.info("[base-juridica] salário mínimo", sm);
  } catch (e) {
    logger.warn("[base-juridica] salário mínimo falhou", { erro: e instanceof Error ? e.message : String(e) });
  }
  const base = await carregarBase();
  for (const ficha of base.fichas) {
    try {
      const { nova, resultado } = await atualizarFicha(ficha, deps);
      if (resultado.aplicada) await gravarFicha(ficha, resultado, nova);
      resultados.push(resultado);
      logger.info("[base-juridica] ficha revisada", { tema: ficha.tema, aplicada: resultado.aplicada, mudancas: resultado.mudancas.map((m) => `${m.campo}:${m.aceita ? "ok" : "recusada"}`), erro: resultado.erro });
    } catch (e) {
      resultados.push({ tema: ficha.tema, aplicada: false, mudancas: [], erro: e instanceof Error ? e.message : String(e) });
      logger.warn("[base-juridica] ficha falhou", { tema: ficha.tema, erro: e instanceof Error ? e.message : String(e) });
    }
  }
  limparCacheDaBase();
  return resultados;
}

let iniciado = false;
/** Liga a rotina: `BASE_JURIDICA_AUTO=1` e `BASE_JURIDICA_ANTHROPIC_KEY` definidos. Primeira rodada 3 min depois de subir; depois a cada `BASE_JURIDICA_INTERVALO_HORAS` (24). */
export function iniciarAtualizacaoDaBaseJuridica(): void {
  if (iniciado) return;
  if (process.env.BASE_JURIDICA_AUTO !== "1" || !process.env.BASE_JURIDICA_ANTHROPIC_KEY) return;
  iniciado = true;
  const horas = Math.max(1, Number(process.env.BASE_JURIDICA_INTERVALO_HORAS) || 24);
  const rodar = () => { void rodarAtualizacaoDaBase().catch((e) => logger.warn("[base-juridica] rodada falhou", { erro: e instanceof Error ? e.message : String(e) })); };
  setTimeout(rodar, 3 * 60_000).unref?.();
  setInterval(rodar, horas * 3_600_000).unref?.();
  logger.info("[base-juridica] atualização automática ligada", { cada_horas: horas });
}
