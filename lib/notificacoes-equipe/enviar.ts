/**
 * Fork Sales — manda UM aviso de WhatsApp para um número da equipe, pela conexão escolhida na central.
 *
 * Reaproveita as mesmas peças do envio de conversa nova (`crm_start_conversation_and_send`): abre/reabre a conversa 1:1 com o número NA CONEXÃO
 * ESCOLHIDA (nunca na do atendimento) e envia pelo mesmo `sendMessageHandler`, com o mesmo freio anti-bloqueio. O número da equipe vira um contato
 * marcado como "da equipe", para a IA nunca tratá-lo como cliente.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import { fraseDaFalhaDeCanal } from "@/lib/channels/frases-de-falha";
import { logger } from "@/lib/logger";
import { openSharedContactConversation } from "@/lib/messaging/open-shared-contact-conversation";
import { depsDoRitmo, registrarEnvioPorToken, segurarEnvioPorToken } from "@/lib/messaging/ritmo-do-envio-por-token";
import { sendMessageSchema } from "@/lib/schemas/messaging";
import { createAdminClient } from "@/lib/supabase/admin";

const ATOR = { type: "api_token", id: "notificacoes-equipe" } as const;
const ETIQUETA_PADRAO = "equipe";

export interface ResultadoDoAviso { ok: boolean; erro?: string }

/** A etiqueta que a organização usa para "contato da equipe" (a primeira configurada) ou `equipe`. */
async function etiquetaDaEquipe(admin: SupabaseClient, orgId: string): Promise<string> {
  try {
    const { data } = await admin.from("organizations").select("settings").eq("id", orgId).maybeSingle();
    const tags = ((data as { settings?: { crm?: { team_contact_tags?: unknown } } } | null)?.settings?.crm?.team_contact_tags);
    const primeira = Array.isArray(tags) ? tags.find((t): t is string => typeof t === "string" && t.trim() !== "") : undefined;
    return primeira?.trim() || ETIQUETA_PADRAO;
  } catch { return ETIQUETA_PADRAO; }
}

/** Marca o contato do número como da equipe (melhor esforço: nunca impede o aviso). */
async function marcarComoEquipe(admin: SupabaseClient, orgId: string, contactId: string): Promise<void> {
  try {
    const etiqueta = await etiquetaDaEquipe(admin, orgId);
    const { data } = await admin.from("contacts").select("tags").eq("id", contactId).eq("organization_id", orgId).maybeSingle();
    const atuais = ((data as { tags?: string[] | null } | null)?.tags ?? []) as string[];
    if (atuais.some((t) => t.toLowerCase() === etiqueta.toLowerCase())) return;
    await admin.from("contacts").update({ tags: [...atuais, etiqueta] }).eq("id", contactId).eq("organization_id", orgId);
  } catch { /* só organização */ }
}

export async function enviarAviso(a: { orgId: string; canalId: string; telefone: string; texto: string; admin?: SupabaseClient }): Promise<ResultadoDoAviso> {
  const admin = a.admin ?? createAdminClient();
  const requestId = randomUUID();
  try {
    const mensagem = sendMessageSchema.parse({ conversation_id: "00000000-0000-0000-0000-000000000000", type: "text", body: a.texto });
    const ritmo = await depsDoRitmo(admin);
    const segurado = await segurarEnvioPorToken(ritmo, { organizationId: a.orgId, channelSessionId: a.canalId, requestId });
    const aberta = await openSharedContactConversation(admin, a.orgId, { channel_session_id: a.canalId, phone_number: a.telefone, name: "Equipe (avisos)" });
    await marcarComoEquipe(admin, a.orgId, aberta.contact_id);
    const enviada = await sendMessageHandler(admin, { organization_id: a.orgId, actor: ATOR, requestId }, { ...mensagem, conversation_id: aberta.conversation_id });
    await registrarEnvioPorToken(ritmo, a.orgId, segurado, enviada.status);
    if (enviada.status !== "failed") return { ok: true };
    // O motivo real fica na própria mensagem (error_code / error_message): sem ele a tela só dizia "recusou" e ninguém sabia o que consertar.
    const m = enviada as { error_code?: string | null; error_message?: string | null };
    const frase = fraseDaFalhaDeCanal(m.error_code);
    const detalhe = (frase ?? m.error_message ?? m.error_code ?? "").toString().trim();
    logger.warn("[notificacoes-equipe] o canal recusou o aviso", { org: a.orgId, canal: a.canalId, codigo: m.error_code ?? null, erro: (m.error_message ?? "").toString().slice(0, 200) });
    return { ok: false, erro: detalhe ? `O WhatsApp recusou o envio: ${detalhe}`.slice(0, 300) : "O WhatsApp recusou o envio (sem detalhe do canal)." };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    logger.warn("[notificacoes-equipe] aviso não enviado", { org: a.orgId, erro: erro.slice(0, 200) });
    return { ok: false, erro: erro.slice(0, 200) };
  }
}
