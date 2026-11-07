/**
 * Fork Sales — o que acontece DEPOIS da assinatura, sem a conversa parar (decisão do escritório: o agente continua, a equipe acompanha).
 *
 *   1. `acordarAgenteAposAssinatura`: agenda um retorno (o mecanismo do motor: uma linha em `cron_jobs` que enfileira um turno do agente) para
 *      daqui a pouco, com o motivo explicado. O agente então agradece, pede os documentos da área e segue conduzindo.
 *   2. `fecharEtapasPosAssinatura`: alguns minutos depois, se o negócio ainda está em "Contrato assinado", o sistema o leva à etapa de ganho
 *      ("Aguardando documentos"). É a garantia de que o funil anda mesmo que o agente não o mova.
 * Tudo falha sozinho: o contrato já foi tratado, e o card pode ser movido à mão.
 */
import { randomUUID } from "node:crypto";

import { moveLeadHandler } from "@/app/api/v1/leads/_handler";
import { resolveJanelaDeRetorno } from "@/lib/followup/janela";
import { agendaRetornoNoCrm } from "@/lib/followup/retorno-crm";
import { MARCA_DE_EVENTO } from "@/lib/inbox/evento-na-conversa-marca";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

const ATOR = { type: "api_token", id: "sales-contrato" } as const;

/** Daqui a quanto o agente volta a falar depois da assinatura (a mensagem fixa de agradecimento sai primeiro). */
export const ATRASO_DO_AGENTE_APOS_ASSINATURA_MS = 45_000;
/** Quanto tempo o negócio pode ficar em "Contrato assinado" antes de o sistema levá-lo a "Aguardando documentos". */
export const PRAZO_DO_AGENTE_PARA_MOVER_MS = 3 * 60_000;

export const MOTIVO_DO_RETORNO_APOS_ASSINATURA =
  "O cliente acabou de ASSINAR o contrato (o sistema já agradeceu por mensagem). Continue conduzindo: agradeça de forma breve, peça os documentos da área do cliente, " +
  "aos poucos (uma lista curta, foto nítida ou PDF), explique que pode enviar quando conseguir e registre em nota o que falta. Não gere outro contrato.";
export const PROMESSA_DO_RETORNO_APOS_ASSINATURA = "Pedir ao cliente os documentos que faltam, agora que o contrato foi assinado.";

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Agenda o turno do agente para logo após a assinatura. `false` quando não foi possível (já havia retorno vivo, contato sem conversa…). */
export async function acordarAgenteAposAssinatura(orgId: string, conversationId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data: conv } = await admin.from("conversations").select("contact_id").eq("id", conversationId).eq("organization_id", orgId).maybeSingle();
    const contactId = (conv as { contact_id: string | null } | null)?.contact_id;
    if (!contactId) return false;
    const agora = new Date();
    const r = await agendaRetornoNoCrm(
      // janela PRÓPRIA do sistema: o mínimo de 5 minutos vale para o modelo, não para este agendamento.
      { admin, orgId, actor: ATOR, requestId: randomUUID(), agora, janela: { ...resolveJanelaDeRetorno(process.env), minAheadMs: 1_000, staggerWindowMs: 0 } },
      { contactId },
      { motivo: MOTIVO_DO_RETORNO_APOS_ASSINATURA, prometidoPara: new Date(agora.getTime() + ATRASO_DO_AGENTE_APOS_ASSINATURA_MS).toISOString(), promessa: PROMESSA_DO_RETORNO_APOS_ASSINATURA, source: "contrato_assinado" },
    );
    if (!r.ok) logger.warn("[sales.contrato] não consegui acordar o agente após a assinatura", { conversation_id: conversationId, codigo: (r as { codigo?: string }).codigo });
    return r.ok;
  } catch (err) {
    logger.warn("[sales.contrato] erro ao acordar o agente após a assinatura", { conversation_id: conversationId, erro: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

const tentadas = new Set<string>();

/** Uma rodada: leva a "Aguardando documentos" os negócios que assinaram há mais de alguns minutos e seguem em "Contrato assinado". Devolve quantos moveu. */
export async function fecharEtapasPosAssinatura(agora = Date.now()): Promise<number> {
  let movidos = 0;
  try {
    const admin = createAdminClient();
    const desde = new Date(agora - 2 * 3_600_000).toISOString();
    const ate = new Date(agora - PRAZO_DO_AGENTE_PARA_MOVER_MS).toISOString();
    const { data } = await admin.from("conversation_notes").select("organization_id, conversation_id").like("body", `${MARCA_DE_EVENTO}Contrato assinado%`).gte("created_at", desde).lte("created_at", ate).limit(200);
    const conversas = new Map<string, string>();
    for (const r of (data ?? []) as { organization_id: string; conversation_id: string }[]) if (!tentadas.has(r.conversation_id)) conversas.set(r.conversation_id, r.organization_id);
    for (const [conversationId, orgId] of conversas) {
      tentadas.add(conversationId);
      try {
        const { data: conv } = await admin.from("conversations").select("contact_id").eq("id", conversationId).eq("organization_id", orgId).maybeSingle();
        const contactId = (conv as { contact_id: string | null } | null)?.contact_id;
        if (!contactId) continue;
        const { data: negocios } = await admin.from("crm_leads").select("id, stage_id, pipeline_id").eq("organization_id", orgId).eq("contact_id", contactId).eq("status", "open").order("created_at", { ascending: false }).limit(5);
        for (const n of (negocios ?? []) as { id: string; stage_id: string; pipeline_id: string }[]) {
          const { data: etapas } = await admin.from("crm_stages").select("id, name, is_won, agent_stage_hint").eq("organization_id", orgId).eq("pipeline_id", n.pipeline_id);
          const lista = (etapas ?? []) as { id: string; name: string; is_won: boolean; agent_stage_hint: string | null }[];
          const atual = lista.find((e) => e.id === n.stage_id);
          const ganho = lista.find((e) => e.is_won && e.agent_stage_hint === "won") ?? lista.find((e) => e.is_won);
          if (!atual || !ganho || atual.is_won || semAcento(atual.name) !== "contrato assinado") continue;
          await moveLeadHandler(admin, { organization_id: orgId, actor: ATOR, requestId: randomUUID() }, n.id, { to_stage_id: ganho.id, reason: "Contrato assinado: aguardando os documentos do cliente" });
          movidos += 1;
          break;
        }
      } catch (err) {
        logger.warn("[sales.contrato] não consegui levar o negócio a 'aguardando documentos'", { conversation_id: conversationId, erro: err instanceof Error ? err.message : String(err) });
      }
    }
  } catch (err) {
    logger.warn("[sales.contrato] rodada de etapas pós-assinatura falhou", { erro: err instanceof Error ? err.message : String(err) });
  }
  return movidos;
}
