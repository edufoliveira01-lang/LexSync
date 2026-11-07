/**
 * Fork Sales — o funil anda sozinho com o contrato, sem o escritório precisar configurar nada:
 *   - ao ENVIAR o contrato, o negócio aberto do contato vai para a etapa "Contrato enviado" do funil dele;
 *   - ao ASSINAR (quando o escritório não escolheu outro destino em "depois da assinatura"), vai para a etapa de ganho ("Contrato assinado").
 * A mudança usa a função oficial de mover negócio (`moveLeadHandler`), com todas as regras do funil. Qualquer recusa só fica no log:
 * o contrato já foi tratado e o card pode ser movido à mão.
 */
import { randomUUID } from "node:crypto";

import { moveLeadHandler } from "@/app/api/v1/leads/_handler";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export type MomentoDoContrato = "enviado" | "assinado";

export interface EtapaDoFunil { id: string; name: string; is_won: boolean; is_lost: boolean; agent_stage_hint?: string | null }

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** A etapa do funil que corresponde ao momento do contrato. `undefined` quando o funil não tem uma etapa que sirva. */
export function escolherEtapaDoContrato(etapas: readonly EtapaDoFunil[], momento: MomentoDoContrato): EtapaDoFunil | undefined {
  const porNome = (nome: string) => etapas.find((e) => !e.is_lost && semAcento(e.name) === nome);
  if (momento === "enviado") return porNome("contrato enviado");
  return etapas.find((e) => e.is_won && e.agent_stage_hint === "won") ?? etapas.find((e) => e.is_won) ?? porNome("contrato assinado");
}

const ATOR = { type: "api_token", id: "sales-contrato" } as const;

/** Move o negócio aberto do contato desta conversa. Devolve o nome da etapa quando moveu; `null` caso contrário. */
export async function moverParaEtapaDoContrato(orgId: string, conversationId: string, momento: MomentoDoContrato): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data: conv } = await admin.from("conversations").select("contact_id").eq("id", conversationId).eq("organization_id", orgId).maybeSingle();
    const contactId = (conv as { contact_id: string | null } | null)?.contact_id;
    if (!contactId) return null;
    const { data: negocios } = await admin.from("crm_leads").select("id, stage_id, pipeline_id").eq("organization_id", orgId).eq("contact_id", contactId).eq("status", "open").order("created_at", { ascending: false }).limit(5);
    for (const n of (negocios ?? []) as { id: string; stage_id: string; pipeline_id: string }[]) {
      const { data: etapas } = await admin.from("crm_stages").select("id, name, is_won, is_lost, agent_stage_hint").eq("organization_id", orgId).eq("pipeline_id", n.pipeline_id);
      const alvo = escolherEtapaDoContrato((etapas ?? []) as EtapaDoFunil[], momento);
      if (!alvo) continue;
      if (alvo.id === n.stage_id) return alvo.name;
      await moveLeadHandler(admin, { organization_id: orgId, actor: ATOR, requestId: randomUUID() }, n.id, { to_stage_id: alvo.id, reason: momento === "enviado" ? "Contrato enviado para assinatura" : "Contrato assinado" });
      return alvo.name;
    }
  } catch (err) {
    logger.warn("[sales.contrato] não consegui mover o negócio de etapa", { conversation_id: conversationId, momento, erro: err instanceof Error ? err.message : String(err) });
  }
  return null;
}
