/**
 * Fork Sales — registro visível, NA conversa, de quem assumiu, transferiu,
 * liberou ou fechou o atendimento.
 *
 * Grava uma nota interna cujo corpo começa com `MARCA_DE_EVENTO`. A tela
 * (`EventoDaConversa`) reconhece a marca e desenha uma linha centralizada em
 * vez do cartão de nota. Reaproveitar `conversation_notes` evita migration no
 * banco do cliente: a nota já é lida em tempo real e nunca sai para o cliente.
 */
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

import { MARCA_DE_EVENTO } from "@/lib/inbox/evento-na-conversa-marca";

async function nomeDe(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string> {
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    const meta = (data?.user?.user_metadata ?? {}) as { full_name?: string; name?: string };
    return meta.full_name?.trim() || meta.name?.trim() || data?.user?.email?.split("@")[0] || "Um atendente";
  } catch {
    return "Um atendente";
  }
}

export type AcaoDoEvento = "assumiu" | "transferiu" | "liberou" | "fechou" | "reabriu" | "arquivou" | "pausou_ia";

export async function registrarEventoNaConversa(p: {
  organizationId: string;
  conversationId: string;
  userId: string | null;
  acao: AcaoDoEvento;
  destinoNome?: string | null;
  detalhe?: string | null;
}): Promise<void> {
  try {
    const chave = env.SUPABASE_SERVICE_ROLE_KEY.trim();
    if (!chave || chave.startsWith("PLACEHOLDER")) return;
    const admin = createAdminClient();
    const nome = p.userId ? await nomeDe(admin, p.userId) : "O sistema";
    const destino = p.destinoNome?.trim();
    const frase: Record<AcaoDoEvento, string> = {
      assumiu: `${nome} assumiu a conversa`,
      transferiu: destino ? `${nome} transferiu a conversa para ${destino}` : `${nome} transferiu a conversa`,
      liberou: `${nome} devolveu a conversa para a fila`,
      fechou: `${nome} fechou a conversa`,
      reabriu: `${nome} reabriu a conversa`,
      arquivou: `${nome} arquivou a conversa`,
      pausou_ia: `${nome} assumiu e pausou a IA`,
    };
    const extra = p.detalhe?.trim() ? ` — ${p.detalhe.trim()}` : "";
    await admin.from("conversation_notes").insert({
      organization_id: p.organizationId,
      conversation_id: p.conversationId,
      body: `${MARCA_DE_EVENTO}${frase[p.acao]}${extra}`,
      created_by_user_id: p.userId,
      created_by_name: nome,
    });
  } catch (err) {
    logger.warn("[inbox.evento] registro na conversa falhou", {
      conversation_id: p.conversationId,
      erro: err instanceof Error ? err.message : String(err),
    });
  }
}
