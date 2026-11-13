/**
 * DELETE /api/v1/conversations/[id]/scheduled-messages/[scheduledId] — cancela uma mensagem programada que ainda não saiu.
 * Só cancela `pending`: se a tarefa já a reivindicou (`sending`) ou enviou, devolve 409 e nada muda.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { registrarEventoNaConversa } from "@/lib/inbox/evento-na-conversa";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; scheduledId: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "scheduled_messages" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { user, org } = authz;
  const { id, scheduledId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("scheduled_messages")
    .update({ status: "canceled", canceled_reason: "manual", processed_at: new Date().toISOString() })
    .eq("id", scheduledId)
    .eq("conversation_id", id)
    .eq("organization_id", org.orgId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) return fail("internal_error", t("Não foi possível cancelar."), 500, { requestId });
  if (!data) return fail("conflict", t("Esta mensagem já foi enviada, cancelada ou está sendo enviada."), 409, { requestId });

  void registrarEventoNaConversa({ organizationId: org.orgId, conversationId: id, userId: user.id, acao: "programada_cancelada", detalhe: `cancelada por ${user.full_name ?? "um atendente"}` });
  return ok({ id: scheduledId, status: "canceled" }, { requestId });
}
