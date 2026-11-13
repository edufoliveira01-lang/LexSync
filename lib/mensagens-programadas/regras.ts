/**
 * As regras puras das mensagens programadas (sem banco, sem relógio escondido): o horário aceito e a decisão "cancelar porque o cliente
 * respondeu". Ficam aqui para a rota, a tarefa do servidor e a tela dizerem a mesma coisa — e para serem testadas sem infraestrutura.
 */

/** Antecedência mínima: abaixo disso o atendente deveria simplesmente enviar. */
export const ANTECEDENCIA_MINIMA_MS = 60_000;
/** Teto: um ano. Mais que isso é quase certamente um erro de digitação do ano. */
export const ANTECEDENCIA_MAXIMA_MS = 365 * 24 * 60 * 60 * 1000;
export const TAMANHO_MAXIMO_DO_TEXTO = 4000;

export type ProblemaDoHorario = "invalido" | "muito_cedo" | "muito_longe";

/** `null` = horário aceito. */
export function problemaDoHorario(sendAt: string | Date, agora: Date = new Date()): ProblemaDoHorario | null {
  const quando = sendAt instanceof Date ? sendAt : new Date(sendAt);
  const ms = quando.getTime();
  if (Number.isNaN(ms)) return "invalido";
  const faltam = ms - agora.getTime();
  if (faltam < ANTECEDENCIA_MINIMA_MS) return "muito_cedo";
  if (faltam > ANTECEDENCIA_MAXIMA_MS) return "muito_longe";
  return null;
}

/**
 * O cliente escreveu DEPOIS de a mensagem ser programada? Só então `cancel_on_reply` cancela. `lastInboundAt` nulo = o cliente nunca
 * escreveu; data inválida em qualquer ponta = não cancela (falha para o lado de enviar o que a pessoa pediu, e a tarefa registra).
 */
export function clienteRespondeuDepois(createdAt: string | null | undefined, lastInboundAt: string | null | undefined): boolean {
  if (!createdAt || !lastInboundAt) return false;
  const criada = Date.parse(createdAt);
  const recebida = Date.parse(lastInboundAt);
  if (Number.isNaN(criada) || Number.isNaN(recebida)) return false;
  return recebida > criada;
}

export function deveCancelarPorResposta(p: {
  cancelOnReply: boolean;
  createdAt: string | null | undefined;
  lastInboundAt: string | null | undefined;
}): boolean {
  return p.cancelOnReply && clienteRespondeuDepois(p.createdAt, p.lastInboundAt);
}
