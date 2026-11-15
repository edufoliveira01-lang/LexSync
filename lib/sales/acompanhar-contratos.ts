/**
 * Fork Sales — o acompanhamento da assinatura NO SERVIDOR.
 *
 * Antes, quem percebia "o cliente assinou" era o navegador do atendente (`useAcompanharContratos`), então um contrato enviado pelo agente de IA
 * ficava parado se ninguém estivesse com a caixa de entrada aberta. Agora o servidor confere de tempos em tempos (e a rota GET usa a MESMA função):
 * ao assinar, move o negócio, aplica a etiqueta, fecha a conversa se for o caso, escreve "Contrato assinado" na conversa e manda a mensagem de
 * agradecimento ao cliente. Uma assinatura é tratada UMA vez: o evento "Contrato assinado" é gravado antes de qualquer outro passo.
 *
 * Uma instância do app por instalação: a trava abaixo é em memória e basta para a rota GET e a rodada do servidor não agirem juntas.
 */
import { randomUUID } from "node:crypto";

import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import { createLeadHandler } from "@/app/api/v1/leads/_handler";
import { registrarEventoNaConversa } from "@/lib/inbox/evento-na-conversa";
import { MARCA_DE_EVENTO } from "@/lib/inbox/evento-na-conversa-marca";
import { logger } from "@/lib/logger";
import { depsDoRitmo, registrarEnvioPorToken, segurarEnvioPorToken } from "@/lib/messaging/ritmo-do-envio-por-token";
import { escolhaEfetiva, lerDadosEmbutidos, lerEscolhaEmbutida, mensagemAposAssinatura, resumoDoQueFoiFeito } from "@/lib/sales/apos-assinatura";
import { aplicar, padraoDaOrg, slugDaOrg } from "@/lib/sales/contrato-na-conversa";
import { configDosContratos, estadoDoContrato } from "@/lib/sales/contratos";
import { moverParaEtapaDoContrato, temNegocioAbertoNoFunil } from "@/lib/sales/etapa-do-contrato";
import { acordarAgenteAposAssinatura, fecharEtapasPosAssinatura } from "@/lib/sales/pos-assinatura";
import { sendMessageSchema } from "@/lib/schemas/messaging";
import { createAdminClient } from "@/lib/supabase/admin";

const ATOR = { type: "api_token", id: "sales-contrato" } as const;
const emAndamento = new Set<string>();

/** Manda um texto ao cliente pelo mesmo caminho do atendimento (ritmo anti-ban incluído). `false` quando não saiu. */
export async function enviarTexto(orgId: string, conversationId: string, body: string): Promise<boolean> {
  const admin = createAdminClient();
  const requestId = randomUUID();
  try {
    const ritmo = await depsDoRitmo(admin);
    const segurado = await segurarEnvioPorToken(ritmo, { organizationId: orgId, conversationId, requestId });
    const m = await sendMessageHandler(admin, { organization_id: orgId, actor: ATOR, requestId }, sendMessageSchema.parse({ conversation_id: conversationId, type: "text", body }));
    await registrarEnvioPorToken(ritmo, orgId, segurado, m.status);
    return m.status !== "failed";
  } catch (e) {
    logger.warn("[sales.contrato] não consegui enviar a mensagem ao cliente", { conversation_id: conversationId, erro: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

export type ResultadoDoPdf = { ok: true } | { ok: false; motivo: string };

/** Igual a `enviarPdf`, mas diz POR QUE não saiu (cada etapa com o seu nome): quem atende precisa do motivo, não de um "falhou". */
export async function enviarPdfDetalhado(orgId: string, conversationId: string, nomeDoArquivo: string, conteudo: Buffer, legenda?: string): Promise<ResultadoDoPdf> {
  const admin = createAdminClient();
  const requestId = randomUUID();
  let etapa = "preparar o arquivo";
  try {
    const limpo = nomeDoArquivo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "boleto.pdf";
    const caminho = `${orgId}/${conversationId}/${Date.now()}-${limpo.endsWith(".pdf") ? limpo : `${limpo}.pdf`}`;
    etapa = "guardar o arquivo no armazenamento";
    const { error: erroUp } = await admin.storage.from("whatsapp-media").upload(caminho, conteudo, { contentType: "application/pdf", upsert: false });
    if (erroUp) throw new Error(erroUp.message);
    etapa = "respeitar o ritmo de envio";
    const ritmo = await depsDoRitmo(admin);
    const segurado = await segurarEnvioPorToken(ritmo, { organizationId: orgId, conversationId, requestId });
    etapa = "enviar ao cliente";
    const m = await sendMessageHandler(admin, { organization_id: orgId, actor: ATOR, requestId }, sendMessageSchema.parse({
      conversation_id: conversationId, type: "document", media_storage_path: caminho, media_mime: "application/pdf", media_size_bytes: conteudo.length, ...(legenda ? { body: legenda } : {}),
      // o nome bonito que o cliente vê (a chave do storage acima é só uma chave segura)
      metadata: { media_filename: nomeDoArquivo.endsWith(".pdf") ? nomeDoArquivo : `${nomeDoArquivo}.pdf` },
    }));
    await registrarEnvioPorToken(ritmo, orgId, segurado, m.status);
    if (m.status === "failed") return { ok: false, motivo: "o canal de WhatsApp recusou o envio do arquivo" };
    return { ok: true };
  } catch (e) {
    const detalhe = (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").slice(0, 160);
    logger.warn("[sales.cobranca] não consegui enviar o PDF ao cliente", { conversation_id: conversationId, etapa, erro: detalhe });
    return { ok: false, motivo: `falhou ao ${etapa}: ${detalhe}` };
  }
}

/** Manda um PDF ao cliente (guarda no mesmo armazenamento de mídia da conversa e envia como documento). `false` quando não saiu. */
export async function enviarPdf(orgId: string, conversationId: string, nomeDoArquivo: string, conteudo: Buffer, legenda?: string): Promise<boolean> {
  return (await enviarPdfDetalhado(orgId, conversationId, nomeDoArquivo, conteudo, legenda)).ok;
}

export interface ConferenciaDoContrato { pendentes: number; assinados: number; novos: number }

/** Confere os contratos "enviados" desta conversa que ainda não aparecem como assinados e trata o que acabou de ser assinado. */
export async function conferirContratosDaConversa(orgId: string, conversationId: string): Promise<ConferenciaDoContrato> {
  const vazio = { pendentes: 0, assinados: 0, novos: 0 };
  if (emAndamento.has(conversationId)) return vazio;
  emAndamento.add(conversationId);
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("conversation_notes").select("body").eq("conversation_id", conversationId).eq("organization_id", orgId).like("body", `${MARCA_DE_EVENTO}Contrato %`);
    const corpos = ((data ?? []) as { body: string }[]).map((n) => n.body);
    const numeros = (rx: RegExp) => new Set(corpos.filter((b) => rx.test(b)).map((b) => Number(/nº (\d+)/.exec(b)?.[1])).filter(Number.isInteger));
    const enviados = numeros(/Contrato enviado/), assinados = numeros(/Contrato assinado/);
    const corpoDoEnviado = (n: number) => corpos.find((b) => /Contrato enviado/.test(b) && new RegExp(`nº ${n}(?!\\d)`).test(b)) ?? "";
    const pendentes = [...enviados].filter((n) => !assinados.has(n));
    if (pendentes.length === 0) return { pendentes: 0, assinados: assinados.size, novos: 0 };
    const slug = await slugDaOrg(orgId);
    if (!slug) return { pendentes: pendentes.length, assinados: assinados.size, novos: 0 };

    let novos = 0;
    for (const n of pendentes) {
      try {
        const e = await estadoDoContrato(slug, n);
        if (e.status !== "assinado") continue;
        const escolhida = escolhaEfetiva(await padraoDaOrg(orgId), lerEscolhaEmbutida(corpoDoEnviado(n)));
        // etiqueta padrão: a equipe enxerga, na lista de conversas, quem já assinou (o escritório pode escolher outra)
        const escolha = escolhida.tag ? escolhida : { ...escolhida, tag: "Contrato assinado" };
        // O funil do PRÓPRIO cliente manda: um destino configurado só vale se o cliente tem negócio aberto naquele funil. Senão (ou sem destino),
        // o negócio dele vai para "Contrato assinado"; criar um negócio novo em outro funil duplicaria o cliente.
        let escolhaFinal = escolha;
        let etapaDoFunil: string | null = null;
        if (!escolha.stage_id || !escolha.pipeline_id || !(await temNegocioAbertoNoFunil(orgId, conversationId, escolha.pipeline_id))) {
          etapaDoFunil = await moverParaEtapaDoContrato(orgId, conversationId, "assinado");
          if (etapaDoFunil) escolhaFinal = { ...escolha, stage_id: undefined, pipeline_id: undefined };
        }
        const feito = await aplicar(orgId, conversationId, escolhaFinal, lerDadosEmbutidos(corpoDoEnviado(n)));
        if (etapaDoFunil) feito.moveu = etapaDoFunil;
        // sem negócio aberto no funil escolhido: cria um na etapa escolhida, pela mesma regra do botão "Novo negócio"
        if (feito.criarNegocio) {
          try { await createLeadHandler(admin, { organization_id: orgId, actor: ATOR, requestId: randomUUID() }, { ...feito.criarNegocio, tags: [], source: "contrato_assinado" } as never); } catch (err) {
            logger.warn("[sales.contrato] não consegui criar o negócio após a assinatura", { conversation_id: conversationId, erro: err instanceof Error ? err.message : String(err) });
            feito.criou = null; feito.semNegocio = true;
          }
        }
        const { data: org } = await admin.from("organizations").select("settings").eq("id", orgId).maybeSingle();
        const { data: cv } = await admin.from("conversations").select("contacts(display_name, name)").eq("id", conversationId).maybeSingle();
        const c0 = (cv as { contacts?: unknown } | null)?.contacts;
        const contato = (Array.isArray(c0) ? c0[0] : c0) as { display_name?: string | null; name?: string | null } | undefined;
        const mensagem = mensagemAposAssinatura(org?.settings, contato?.display_name ?? contato?.name ?? null);
        const resumo = resumoDoQueFoiFeito({ ...feito, mensagem: Boolean(mensagem) });
        // O evento é gravado ANTES de avisar o cliente: se algo falhar daqui em diante, o contrato já conta como tratado e a mensagem não sai duas vezes.
        await registrarEventoNaConversa({ organizationId: orgId, conversationId, userId: null, acao: "contrato_assinado", detalhe: `nº ${n}${resumo ? ` · ${resumo}` : ""}${e.arquivo_salvo ? " · arquivos salvos na pasta do cliente" : ""}` });
        if (mensagem) await enviarTexto(orgId, conversationId, mensagem);
        // a conversa não para: o agente volta a falar daqui a pouco (pede os documentos) e a equipe acompanha pela fila
        await acordarAgenteAposAssinatura(orgId, conversationId);
        novos += 1;
      } catch { /* o painel pode estar fora por instantes: tenta na próxima conferência */ }
    }
    return { pendentes: pendentes.length - novos, assinados: assinados.size + novos, novos };
  } finally {
    emAndamento.delete(conversationId);
  }
}

/** Uma rodada: acha as conversas com contrato enviado e sem assinatura registrada (últimos 30 dias) e confere cada uma. */
export async function conferirContratosPendentes(): Promise<number> {
  if (!configDosContratos()) return 0;
  const admin = createAdminClient();
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await admin.from("conversation_notes").select("organization_id, conversation_id, body").like("body", `${MARCA_DE_EVENTO}Contrato %`).gte("created_at", desde).order("created_at", { ascending: false }).limit(500);
  const porConversa = new Map<string, { org: string; enviados: Set<number>; assinados: Set<number> }>();
  for (const r of (data ?? []) as { organization_id: string; conversation_id: string; body: string }[]) {
    const g = porConversa.get(r.conversation_id) ?? { org: r.organization_id, enviados: new Set<number>(), assinados: new Set<number>() };
    const n = Number(/nº (\d+)/.exec(r.body)?.[1]);
    if (Number.isInteger(n)) (/Contrato assinado/.test(r.body) ? g.assinados : g.enviados).add(n);
    porConversa.set(r.conversation_id, g);
  }
  let tratados = 0;
  for (const [conversa, g] of porConversa) {
    if (![...g.enviados].some((n) => !g.assinados.has(n))) continue;
    const r = await conferirContratosDaConversa(g.org, conversa);
    tratados += r.novos;
  }
  return tratados;
}

let ligado = false;
/** Liga a rodada de 60 em 60 segundos (uma vez por processo). Sem a ligação com o Sales (SALES_PAINEL_URL e CONTRATOS_SEGREDO), não faz nada. */
export function iniciarAcompanhamentoDeContratos(intervaloMs = 60_000): void {
  if (ligado || !configDosContratos()) return;
  ligado = true;
  const rodada = () => {
    void conferirContratosPendentes().catch((e) => logger.warn("[sales.contrato] rodada falhou", { erro: e instanceof Error ? e.message : String(e) }));
    void fecharEtapasPosAssinatura().catch((e) => logger.warn("[sales.contrato] rodada das etapas pós-assinatura falhou", { erro: e instanceof Error ? e.message : String(e) }));
  };
  setTimeout(rodada, 20_000).unref();
  setInterval(rodada, intervaloMs).unref();
}
