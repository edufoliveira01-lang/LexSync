/**
 * Envia as mensagens programadas do Inbox que já venceram. Usada pela tarefa `cron/scheduled-messages` e pela rodada própria do
 * servidor (`iniciarEnvioDeMensagensProgramadas`, ligada em `instrumentation.ts`, porque o agendador desta instalação é o da imagem
 * original e não conhece a tarefa nova).
 *
 * Para cada mensagem vencida:
 *   1. REIVINDICA a linha (`pending → sending`, só se ainda `pending`): rodadas simultâneas nunca enviam a mesma.
 *   2. Se "cancelar se o cliente responder" está ligado e o cliente escreveu DEPOIS de a mensagem ser programada, CANCELA
 *      (`canceled_reason = 'cliente_respondeu'`) e deixa um evento na conversa. Com a opção desligada, envia mesmo assim.
 *   3. Envia pelo MESMO `sendMessageHandler` de todo envio, com a pessoa que programou como autora — valem todas as guardas de sempre
 *      (organização operante, número do atendente, janela do canal oficial, contato bloqueado ou pessoal).
 *   4. Marca `sent` (com o id da mensagem) ou `failed` (com o motivo) e registra o evento na conversa.
 */
import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import { espacarEnvio } from "@/lib/automation/throttle";
import { registrarEventoNaConversa } from "@/lib/inbox/evento-na-conversa";
import { logger } from "@/lib/logger";
import { deveCancelarPorResposta } from "@/lib/mensagens-programadas/regras";
import { OrgNaoOperanteError } from "@/lib/organizacao/operante";
import { createAdminClient } from "@/lib/supabase/admin";

const LOTE = 50;

interface Vencida {
  id: string;
  organization_id: string;
  conversation_id: string;
  body: string;
  cancel_on_reply: boolean;
  created_at: string;
  created_by_user_id: string | null;
}

export interface ResultadoDaRodada {
  examinadas: number;
  enviadas: number;
  canceladas: number;
  falhas: number;
}

export async function enviarMensagensProgramadasVencidas(requestId: string): Promise<ResultadoDaRodada> {
  const admin = createAdminClient();
  const agora = new Date().toISOString();
  const { data, error } = await admin
    .from("scheduled_messages")
    .select("id, organization_id, conversation_id, body, cancel_on_reply, created_at, created_by_user_id")
    .eq("status", "pending")
    .lte("send_at", agora)
    .order("send_at", { ascending: true })
    .limit(LOTE);
  if (error) throw new Error(error.message);

  let enviadas = 0;
  let canceladas = 0;
  let falhas = 0;

  for (const m of (data ?? []) as Vencida[]) {
    // 1. reivindica
    const { data: reivindicada } = await admin
      .from("scheduled_messages")
      .update({ status: "sending" })
      .eq("id", m.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!reivindicada) continue;

    const concluir = async (campos: Record<string, unknown>) => {
      await admin.from("scheduled_messages").update({ ...campos, processed_at: new Date().toISOString() }).eq("id", m.id);
    };

    try {
      const { data: conversa } = await admin
        .from("conversations")
        .select("id, status, last_inbound_at, channel_session_id")
        .eq("id", m.conversation_id)
        .eq("organization_id", m.organization_id)
        .maybeSingle();
      const c = conversa as { status: string; last_inbound_at: string | null; channel_session_id: string | null } | null;
      if (!c) {
        await concluir({ status: "failed", error: "Conversa não encontrada." });
        falhas += 1;
        continue;
      }

      // 2. o cliente respondeu antes do horário?
      if (deveCancelarPorResposta({ cancelOnReply: m.cancel_on_reply, createdAt: m.created_at, lastInboundAt: c.last_inbound_at })) {
        await concluir({ status: "canceled", canceled_reason: "cliente_respondeu" });
        void registrarEventoNaConversa({
          organizationId: m.organization_id,
          conversationId: m.conversation_id,
          userId: null,
          acao: "programada_cancelada",
          detalhe: "o cliente respondeu antes do horário",
        });
        canceladas += 1;
        continue;
      }

      if (c.status === "archived") {
        await concluir({ status: "failed", error: "A conversa foi arquivada antes do horário." });
        falhas += 1;
        continue;
      }

      // 3. envia pelo caminho de sempre, em nome de quem programou
      if (c.channel_session_id) await espacarEnvio(c.channel_session_id);
      const mensagem = await sendMessageHandler(
        admin,
        {
          organization_id: m.organization_id,
          actor: m.created_by_user_id ? { type: "user", id: m.created_by_user_id } : { type: "webhook_source", id: m.id },
          requestId: `scheduled-messages:${m.id}`,
        },
        { conversation_id: m.conversation_id, type: "text", body: m.body } as Parameters<typeof sendMessageHandler>[2],
      );

      // 4. registra
      await concluir({ status: "sent", message_id: (mensagem as { id?: string }).id ?? null });
      void registrarEventoNaConversa({
        organizationId: m.organization_id,
        conversationId: m.conversation_id,
        userId: null,
        acao: "programada_enviada",
      });
      enviadas += 1;
    } catch (err) {
      const motivo =
        err instanceof OrgNaoOperanteError
          ? "A organização estava parada no horário."
          : err instanceof Error
            ? err.message.slice(0, 300)
            : "Falha desconhecida.";
      logger.warn("[scheduled-messages] envio falhou", { id: m.id, organization_id: m.organization_id, motivo, requestId });
      await concluir({ status: "failed", error: motivo });
      void registrarEventoNaConversa({
        organizationId: m.organization_id,
        conversationId: m.conversation_id,
        userId: null,
        acao: "programada_falhou",
        detalhe: motivo,
      });
      falhas += 1;
    }
  }

  return { examinadas: (data ?? []).length, enviadas, canceladas, falhas };
}
