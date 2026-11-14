/**
 * PATCH /api/v1/agenda/google/calendarios/titulos — liga ou desliga o título dos eventos de UMA agenda do Google.
 *
 * Decisão do dono (9110): o título aparece para a equipe SÓ nas agendas marcadas aqui, e vem desligado.
 * Cada pessoa liga as agendas da PRÓPRIA conexão (como a seleção de agendas): a agenda pessoal de um colega
 * nunca é alcançada por quem não é dono dela.
 *
 * Desligar apaga os títulos já guardados dessa agenda na hora; a função de leitura já os esconde pela
 * própria coluna, e a limpeza é a segunda trava (o dado deixa de existir).
 */
import { randomUUID } from "node:crypto";

import { z } from "zod";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { ok, fail } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { pedirReleituraCompleta } from "@/lib/agenda/google/releitura-completa";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpo = z.object({ calendar_id: z.uuid(), show_titles: z.boolean() }).strict();

export async function PATCH(req: Request) {
  const denied = await requireSupportWrite();
  if (denied) return denied;
  const requestId = randomUUID();
  const auth = await requireRole("agent", { requestId, resource: "agenda" });
  if (!auth.ok) return auth.response;
  const parsed = corpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Confira a agenda escolhida.", 422, { requestId });

  const org = auth.org.orgId;
  // Só a agenda de uma conexão DA PRÓPRIA pessoa: a leitura passa pela sessão (RLS) e a conexão é conferida pelo dono.
  const sessao = await createClient();
  const { data: agenda } = await sessao
    .from("calendar_connection_calendars")
    .select("id, connection_id, external_calendar_id")
    .eq("organization_id", org)
    .eq("id", parsed.data.calendar_id)
    .maybeSingle();
  if (!agenda) return fail("not_found", "Agenda não encontrada.", 404, { requestId });
  const { data: conexao } = await sessao
    .from("calendar_connections")
    .select("id")
    .eq("organization_id", org)
    .eq("id", agenda.connection_id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!conexao) return fail("forbidden", "Você só altera as agendas da sua própria conexão.", 403, { requestId });

  const admin = createAdminClient();
  const { error } = await admin
    .from("calendar_connection_calendars")
    .update({ show_titles: parsed.data.show_titles })
    .eq("organization_id", org)
    .eq("id", agenda.id);
  if (error) return fail("internal_error", "Não foi possível salvar. Tente de novo.", 500, { requestId });

  // Ligando: a leitura é incremental e os eventos que já estavam lá não voltam; pede a releitura completa para os títulos aparecerem em minutos.
  if (parsed.data.show_titles) await pedirReleituraCompleta(admin, org, agenda.id);

  if (!parsed.data.show_titles) {
    await admin
      .from("calendar_external_event_titles")
      .delete()
      .eq("organization_id", org)
      .eq("connection_id", agenda.connection_id)
      .eq("external_calendar_id", agenda.external_calendar_id);
  }

  void audit({
    action: "agenda.google_titulos_alterado",
    organizationId: org,
    actorUserId: auth.user.id,
    requestId,
    metadata: { calendar_id: agenda.id, show_titles: parsed.data.show_titles },
  });
  return ok({ saved: true, show_titles: parsed.data.show_titles }, { requestId });
}
