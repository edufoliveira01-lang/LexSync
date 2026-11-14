/**
 * O atendimento agendado, remarcado ou desmarcado pela EQUIPE vira uma cápsula na conversa do cliente ("Fulano agendou um atendimento — sex., 20/11,
 * às 14h30 (Consulta)"). Quem agenda pelo Inbox vê o resultado ali mesmo, e quem abre a conversa depois entende o que foi combinado.
 *
 * Só para pessoa da equipe: o agente de IA já deixa a própria linha ("marcou um compromisso na agenda") pelo wrapper das ferramentas. Melhor-esforço:
 * nunca derruba nem atrasa o agendamento que já está gravado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { quandoLegivel } from "@/lib/agenda/quando-legivel";
import { registrarEventoNaConversa } from "@/lib/inbox/evento-na-conversa";
import { logger } from "@/lib/logger";

export type AtividadeDaAgenda = "appointment_scheduled" | "appointment_rescheduled" | "appointment_cancelled" | string;

const ACAO: Record<string, "agendou" | "remarcou" | "desmarcou"> = {
  appointment_scheduled: "agendou",
  appointment_rescheduled: "remarcou",
  appointment_cancelled: "desmarcou",
};

export async function registrarAgendamentoNoChat(
  admin: SupabaseClient,
  p: { organizationId: string; appointmentId: string; contactId: string | null; atividade: AtividadeDaAgenda | null; userId: string | null; nomeDoTipo: string },
): Promise<void> {
  try {
    const acao = p.atividade ? ACAO[p.atividade] : undefined;
    if (!acao || !p.contactId || !p.userId) return;
    const [{ data: conv }, { data: ag }] = await Promise.all([
      admin.from("conversations").select("id").eq("organization_id", p.organizationId).eq("contact_id", p.contactId).order("last_inbound_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
      admin.from("calendar_appointments").select("starts_at, time_zone").eq("organization_id", p.organizationId).eq("id", p.appointmentId).maybeSingle(),
    ]);
    const conversationId = (conv as { id: string } | null)?.id;
    if (!conversationId) return;
    const a = ag as { starts_at: string; time_zone: string | null } | null;
    const quando = a?.starts_at ? quandoLegivel(a.starts_at, a.time_zone ?? "America/Sao_Paulo") : null;
    const detalhe = [quando, p.nomeDoTipo ? `(${p.nomeDoTipo})` : null].filter(Boolean).join(" ") || null;
    await registrarEventoNaConversa({ organizationId: p.organizationId, conversationId, userId: p.userId, acao, detalhe });
  } catch (err) {
    logger.warn("[agenda] não consegui registrar o agendamento na conversa", { appointment_id: p.appointmentId, erro: err instanceof Error ? err.message : String(err) });
  }
}
