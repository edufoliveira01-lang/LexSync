/**
 * "Fechar a conversa ao terminar o fluxo" (nó Fim do follow-up). Quando o último nó é alcançado, fecha a conversa do contato —
 * a da inscrição, ou, sem ela, a mais recente ainda aberta. Não fecha o que a equipe assumiu (claimed) nem o que já está
 * encerrado. Melhor esforço: erro aqui nunca derruba o motor.
 */
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

import { registrarEventoNaConversa } from "@/lib/inbox/evento-na-conversa";

const ENCERRADAS = ["closed", "resolved", "archived"];

export async function fecharConversaAoFimDoFluxo(p: { organizationId: string; contactId: string; conversationId: string | null; detalhe?: string }): Promise<boolean> {
  try {
    const admin = createAdminClient();
    let q = admin.from("conversations").select("id, status, service_revision").eq("organization_id", p.organizationId);
    q = p.conversationId ? q.eq("id", p.conversationId) : q.eq("contact_id", p.contactId).not("status", "in", `(${ENCERRADAS.join(",")})`).order("last_message_at", { ascending: false, nullsFirst: false }).limit(1);
    const { data } = await q.maybeSingle();
    const c = data as { id: string; status: string; service_revision: number } | null;
    if (!c || ENCERRADAS.includes(c.status) || c.status === "claimed") return false;
    const { error } = await admin.rpc("fn_service_status", { p_org: p.organizationId, p_conversation: c.id, p_status: "closed", p_expected: c.service_revision });
    if (error) return false;
    await registrarEventoNaConversa({ organizationId: p.organizationId, conversationId: c.id, userId: null, acao: "fechou", detalhe: p.detalhe ?? "follow-up concluído" });
    return true;
  } catch (err) {
    logger.warn("followup: não consegui fechar a conversa ao fim do fluxo", { erro: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
