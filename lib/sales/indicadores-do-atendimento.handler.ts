/**
 * Fork Sales — empurra o retrato dos indicadores do atendimento para o Sales quando o funil muda (negócio criado, trocou de etapa, ganho,
 * perdido), em vez de esperar o relógio. Sai para fora (rede), então não roda com a organização parada.
 */
import type { EventHandler, EventRow, HandlerResult } from "@/lib/event-log/dispatcher";

import { agendarRetratoDaOrganizacao } from "./indicadores-do-atendimento";

const CONSUMER_KEY = "sales.indicadores-do-atendimento";

async function handle(row: EventRow): Promise<HandlerResult> {
  if (!row.organization_id) return { consumer_key: CONSUMER_KEY, status: "skipped", detail: "sem_organizacao" };
  agendarRetratoDaOrganizacao(row.organization_id);
  return { consumer_key: CONSUMER_KEY, status: "ok", detail: "retrato_agendado" };
}

export const indicadoresDoAtendimentoHandler: EventHandler = {
  key: CONSUMER_KEY,
  naOrgParada: "pula",
  events: ["lead.created", "lead.stage_changed", "lead.won", "lead.lost"],
  handle,
};
