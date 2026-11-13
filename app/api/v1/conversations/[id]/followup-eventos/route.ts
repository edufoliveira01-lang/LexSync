/**
 * GET /api/v1/conversations/[id]/followup-eventos — o que os follow-ups fizeram com o contato desta conversa.
 *
 * O Inbox mostra esses acontecimentos como cápsulas na linha do tempo ("Follow-up «X»: mensagem enviada", "…concluído"…), ao lado de
 * assumiu/transferiu/fechou. Só entram os tipos que importam a quem atende (entrada, envio, resposta, pausa, fim); o passo a passo
 * interno do motor continua no dossiê do follow-up.
 *
 * O client é o da SESSÃO (RLS), e uma falha de leitura devolve lista vazia: a conversa nunca deixa de abrir por causa disto.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { descreveEvento } from "@/lib/followup/eventos-legiveis";
import { traduzir } from "@/lib/i18n/dicionario";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LIMITE = 80;

/** Os acontecimentos de follow-up que merecem uma cápsula na conversa. */
const TIPOS = [
  "enrolled_by_stage_change",
  "enrolled_by_case_opened",
  "enrolled_by_lead_created",
  "enrolled_by_inbound_after_silence",
  "roteiro_iniciado",
  "action_sent",
  "reactivity_replied",
  "reactivity_opted_out",
  "handoff_paused",
  "handoff_resumed",
  "paused_manual",
  "resumed_manual",
  "snoozed_manual",
  "cancelled_manual",
  "cancelled_by_case_closed",
  "cancelled_by_stage_change",
  "replaced_by_rule",
  "flow_completed",
  "flow_dead",
  "roteiro_concluido",
  "roteiro_cancelado",
  "roteiro_expirado",
] as const;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "followup_enrollment_events" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { org } = authz;
  const { id } = await params;
  const supabase = await createClient();

  const { data: conversa } = await supabase
    .from("conversations")
    .select("id, contact_id")
    .eq("id", id)
    .eq("organization_id", org.orgId)
    .maybeSingle();
  if (!conversa) return fail("not_found", t("Conversa não encontrada."), 404, { requestId });
  const contactId = (conversa as { contact_id: string | null }).contact_id;
  if (!contactId) return ok([], { requestId });

  try {
    const { data: inscricoes, error: erroInscricoes } = await supabase
      .from("followup_enrollments")
      .select("id, pointer_id")
      .eq("organization_id", org.orgId)
      .eq("contact_id", contactId)
      .order("started_at", { ascending: false })
      .limit(40);
    if (erroInscricoes || !inscricoes || inscricoes.length === 0) return ok([], { requestId });

    const pointerPorInscricao = new Map(inscricoes.map((i) => [i.id as string, i.pointer_id as string]));
    const { data: pointers } = await supabase
      .from("followup_flow_pointers")
      .select("id, name")
      .in("id", [...new Set([...pointerPorInscricao.values()])]);
    const nomePorPointer = new Map((pointers ?? []).map((p) => [p.id as string, (p as { name?: string }).name ?? ""]));

    const { data: eventos, error } = await supabase
      .from("followup_enrollment_events")
      .select("id, enrollment_id, node_id, event_type, payload, created_at")
      .eq("organization_id", org.orgId)
      .in("enrollment_id", [...pointerPorInscricao.keys()])
      .in("event_type", [...TIPOS])
      .order("created_at", { ascending: false })
      .limit(LIMITE);
    if (error) throw new Error(error.message);

    const saida = (eventos ?? []).map((e) => {
      const evento = {
        id: e.id as string,
        node_id: (e.node_id as string | null) ?? null,
        event_type: e.event_type as string,
        payload: (e.payload as Record<string, unknown>) ?? {},
        created_at: e.created_at as string,
      };
      const lido = descreveEvento(evento, {}, authz.user.idioma);
      const fluxo = nomePorPointer.get(pointerPorInscricao.get(e.enrollment_id as string) ?? "") ?? "";
      return {
        id: evento.id,
        created_at: evento.created_at,
        event_type: evento.event_type,
        fluxo,
        titulo: lido.titulo,
        detalhe: lido.detalhe,
      };
    });
    return ok(saida, { requestId });
  } catch (err) {
    logger.warn("[followup-eventos] leitura falhou", {
      conversation_id: id,
      organization_id: org.orgId,
      error: err instanceof Error ? err.message : String(err),
      requestId,
    });
    return ok([], { requestId });
  }
}
