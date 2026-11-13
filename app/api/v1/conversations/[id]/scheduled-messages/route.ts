/**
 * GET/POST /api/v1/conversations/[id]/scheduled-messages — as mensagens programadas de uma conversa.
 *
 * Qualquer atendente (agent ou acima) que enxerga a conversa pode programar. O envio em si é da tarefa `cron/scheduled-messages`.
 * O client é o da SESSÃO: a RLS de `scheduled_messages` (migration 9109) é quem decide quem lê e quem inclui.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { registrarEventoNaConversa } from "@/lib/inbox/evento-na-conversa";
import { problemaDoHorario, TAMANHO_MAXIMO_DO_TEXTO } from "@/lib/mensagens-programadas/regras";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COLUNAS = "id, conversation_id, body, send_at, cancel_on_reply, status, created_by_user_id, created_at, processed_at, canceled_reason, error";

const criarSchema = z.object({
  body: z.string().trim().min(1).max(TAMANHO_MAXIMO_DO_TEXTO),
  send_at: z.string().min(1),
  cancel_on_reply: z.boolean().default(true),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "scheduled_messages" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { org } = authz;
  const { id } = await params;
  const supabase = await createClient();

  const { data: conversa } = await supabase.from("conversations").select("id").eq("id", id).eq("organization_id", org.orgId).maybeSingle();
  if (!conversa) return fail("not_found", t("Conversa não encontrada."), 404, { requestId });

  const { data, error } = await supabase
    .from("scheduled_messages")
    .select(COLUNAS)
    .eq("organization_id", org.orgId)
    .eq("conversation_id", id)
    .in("status", ["pending", "sending", "failed"])
    .order("send_at", { ascending: true })
    .limit(50);
  if (error) return fail("internal_error", t("Não foi possível listar as mensagens programadas."), 500, { requestId });
  return ok(data ?? [], { requestId });
}

export async function POST(req: NextRequest, { params }: RouteParams): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "scheduled_messages" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { user, org } = authz;
  const { id } = await params;
  const supabase = await createClient();

  const { data: conversa } = await supabase
    .from("conversations")
    .select("id, status")
    .eq("id", id)
    .eq("organization_id", org.orgId)
    .maybeSingle();
  if (!conversa) return fail("not_found", t("Conversa não encontrada."), 404, { requestId });
  if ((conversa as { status: string }).status === "archived") {
    return fail("conflict", t("Esta conversa está arquivada."), 409, { requestId });
  }

  const parsed = criarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }
  const problema = problemaDoHorario(parsed.data.send_at);
  if (problema) {
    const frase = {
      invalido: t("Escolha uma data e hora válidas."),
      muito_cedo: t("Escolha um horário pelo menos um minuto à frente."),
      muito_longe: t("Escolha um horário dentro de um ano."),
    }[problema];
    return fail("validation_failed", frase, 422, { requestId, details: { send_at: [frase] } });
  }

  const sendAt = new Date(parsed.data.send_at).toISOString();
  const { data, error } = await supabase
    .from("scheduled_messages")
    .insert({
      organization_id: org.orgId,
      conversation_id: id,
      body: parsed.data.body,
      send_at: sendAt,
      cancel_on_reply: parsed.data.cancel_on_reply,
      created_by_user_id: user.id,
    })
    .select(COLUNAS)
    .single();
  if (error || !data) return fail("internal_error", t("Não foi possível programar a mensagem."), 500, { requestId });

  const quando = new Date(sendAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  void registrarEventoNaConversa({
    organizationId: org.orgId,
    conversationId: id,
    userId: user.id,
    acao: "programou_mensagem",
    detalhe: `para ${quando}${parsed.data.cancel_on_reply ? " (cancela se o cliente responder)" : " (envio permanente)"}`,
  });
  return ok(data, { requestId, status: 201 });
}
