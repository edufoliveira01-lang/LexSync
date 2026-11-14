/**
 * PASSAGEM ENTRE AGENTES COM RESPOSTA NA HORA.
 *
 * Quando um agente passa a conversa para outro (`crm_passar_para_agente`), o sistema só trocava o agente da conversa e, se o destino tinha
 * mensagem de abertura, mandava esse texto fixo: o agente novo só RODAVA na próxima mensagem do cliente. Quem já tinha feito o pedido
 * ("quero saber do meu processo") precisava repetir, e a abertura terminava em "em que posso ajudar?".
 *
 * Aqui, depois de a passagem dar certo, nasce um turno `inbound_turn` do agente de destino para a MESMA mensagem do cliente. O turno lê a
 * conversa inteira (inclusive o que o agente de origem disse) e responde o pedido original.
 *
 * ## O que protege esse turno
 *
 *  - **Só nasce de um turno de resposta** (`inbound_turn`) com todos os ponteiros no payload. Follow-up de retomada não tem mensagem do cliente
 *    para responder: segue como antes (abertura fixa, se houver).
 *  - **Uma vez por job de origem** (`passagem_de_job`): o retry do job de origem não cria um segundo turno.
 *  - **Sem laço**: o turno criado aqui leva `passagem_imediata: true`, e um turno com essa marca NÃO cria outro. Lígia e Helena não ficam
 *    passando a conversa uma à outra para a mesma mensagem; a seguinte passagem espera a próxima mensagem do cliente.
 *  - **A régua "uma resposta por mensagem"** (`turno-ja-respondido.ts`) calaria este turno, porque o agente de origem já respondeu (ou
 *    viu) a mensagem. O worker a ignora quando o payload traz `passagem_imediata`.
 *  - **Serializado por contato** (`uniq_job_queue_one_running_per_contact`): o turno novo só começa quando o de origem termina. Sai com
 *    uma folga de segundos de propósito.
 *
 * Nunca lança: `enfileirado: false` faz quem chamou voltar ao comportamento anterior (abertura fixa).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const payloadDoTurno = z
  .object({
    conversation_id: z.string().uuid(),
    contact_id: z.string().uuid(),
    channel_session_id: z.string().uuid(),
    inbound_message_id: z.string().uuid(),
    crm_event_id: z.string().uuid(),
  })
  .passthrough();

/** Folga antes de o turno do destino nascer: o de origem ainda está encerrando (a fila é serializada por contato). */
const FOLGA_MS = 2_000;

export type ResultadoDoTurnoImediato =
  | { enfileirado: true; jaExistia: boolean }
  | { enfileirado: false; motivo: "sem_job" | "origem_nao_e_turno_de_resposta" | "origem_sem_ponteiros" | "sem_laco" | "contato_diferente" | "erro" };

export async function enfileirarTurnoDeDestino(p: {
  admin: SupabaseClient;
  organizationId: string;
  contactId: string;
  /** O job do turno que está passando a conversa (`ctx.sourceJobId`). */
  jobDeOrigemId: string | undefined;
  agora?: () => Date;
}): Promise<ResultadoDoTurnoImediato> {
  try {
    if (!p.jobDeOrigemId) return { enfileirado: false, motivo: "sem_job" };

    const { data: origem } = await p.admin
      .from("job_queue")
      .select("id, kind, payload")
      .eq("id", p.jobDeOrigemId)
      .eq("organization_id", p.organizationId)
      .maybeSingle();
    const job = origem as { id: string; kind: string; payload: unknown } | null;
    if (!job || job.kind !== "inbound_turn") return { enfileirado: false, motivo: "origem_nao_e_turno_de_resposta" };

    const lido = payloadDoTurno.safeParse(job.payload);
    if (!lido.success) return { enfileirado: false, motivo: "origem_sem_ponteiros" };
    const payload = lido.data as Record<string, unknown>;
    if (payload.passagem_imediata === true) return { enfileirado: false, motivo: "sem_laco" };
    if (payload.contact_id !== p.contactId) return { enfileirado: false, motivo: "contato_diferente" };

    // Uma vez por job de origem.
    const { data: existente } = await p.admin
      .from("job_queue")
      .select("id")
      .eq("organization_id", p.organizationId)
      .eq("kind", "inbound_turn")
      .filter("payload->>passagem_de_job", "eq", job.id)
      .limit(1);
    if (Array.isArray(existente) && existente.length > 0) return { enfileirado: true, jaExistia: true };

    const runAfter = new Date((p.agora?.() ?? new Date()).getTime() + FOLGA_MS).toISOString();
    const { error } = await p.admin.from("job_queue").insert({
      organization_id: p.organizationId,
      contact_id: p.contactId,
      kind: "inbound_turn",
      payload: { ...payload, passagem_imediata: true, passagem_de_job: job.id },
      run_after: runAfter,
      max_attempts: 3,
    });
    if (error) return { enfileirado: false, motivo: "erro" };
    return { enfileirado: true, jaExistia: false };
  } catch {
    return { enfileirado: false, motivo: "erro" };
  }
}
