/**
 * Fork Sales — a rodada própria do servidor que envia as mensagens programadas do Inbox na hora marcada.
 *
 * O agendador desta instalação é o da imagem original, que não conhece a tarefa nova; então o próprio servidor da aplicação confere,
 * de 60 em 60 segundos, as mensagens vencidas (mesmo padrão de `acompanhar-contratos`). É seguro com mais de uma réplica ou junto com
 * a rota `cron/scheduled-messages`: a linha é reivindicada (`pending → sending`) antes do envio, então ninguém envia em dobro.
 * Desligar: `MENSAGENS_PROGRAMADAS_AUTO=0`.
 */
import { randomUUID } from "node:crypto";

import { logger } from "@/lib/logger";

let ligado = false;

export function iniciarEnvioDeMensagensProgramadas(intervaloMs = 60_000): void {
  if (ligado || process.env.MENSAGENS_PROGRAMADAS_AUTO === "0") return;
  ligado = true;
  let rodando = false;
  const rodada = () => {
    if (rodando) return;
    rodando = true;
    void import("@/lib/mensagens-programadas/enviar-vencidas")
      .then((m) => m.enviarMensagensProgramadasVencidas(`auto:${randomUUID()}`))
      .catch((e) => logger.warn("[sales.programadas] rodada falhou", { erro: e instanceof Error ? e.message : String(e) }))
      .finally(() => {
        rodando = false;
      });
  };
  setTimeout(rodada, 30_000).unref();
  setInterval(rodada, intervaloMs).unref();
}
