/**
 * "FEZ, ANOTOU, CLASSIFICOU, SEGUIU" — os marcos do atendimento só valem depois de a mensagem do marco SAIR.
 *
 * ## O defeito
 *
 * Dentro de um turno o modelo escolhe a ORDEM das ferramentas. Quando ele chamava `update_lead_state` / `crm_move_lead_stage` ANTES de
 * `send_message`, o funil dizia "Proposta enviada" (e os gatilhos de follow-up por etapa disparavam) segundos antes de a proposta existir —
 * e, se o envio fosse vetado, bloqueado ou falhasse, o cliente nunca a recebia e o funil ficava mentindo. No chat, a cápsula do evento
 * aparecia ANTES da mensagem.
 *
 * ## A regra
 *
 * Ferramenta de MARCO (etapa, etiqueta, nota, aviso à equipe) chamada ANTES da primeira mensagem do turno sair NÃO executa na hora:
 * fica numa fila e o modelo recebe "será aplicado depois do envio". Quando uma mensagem sai (`sent`, `already_sent` ou `queued`),
 * a fila roda, na ordem em que foi pedida. Depois do primeiro envio, as ferramentas de marco rodam na hora (já estão "depois").
 *
 * No fim do turno, o que sobrou na fila depende do que aconteceu:
 *   - o modelo NÃO tentou enviar nada (turno silencioso): roda tudo — não há mensagem para esperar, como era antes;
 *   - tentou enviar e NADA saiu (veto, bloqueio, falha): as que mudam ESTADO (etapa, etiqueta) são descartadas e registradas no log,
 *     porque o fato que elas afirmam não aconteceu; as de REGISTRO (nota, aviso) rodam mesmo assim, para a equipe não perder o
 *     que foi observado.
 *
 * Ficam de fora de propósito: passagem para a equipe (`request_human_handoff`, `open_human_case`), que carrega estado do turno
 * (`passouParaAEquipe`) e é escalada que não pode esperar; e a passagem entre agentes, que já manda encerrar o turno.
 *
 * Nunca lança: uma ferramenta de marco que falha depois do envio vira log, e a mensagem já saiu.
 */
import type { Logger } from '../obs/logger';

/** Ferramentas que MARCAM um fato do atendimento (nomes como o modelo as vê). */
export const FERRAMENTAS_DE_MARCO: ReadonlySet<string> = new Set([
  'update_lead_state',
  'crm_move_lead_stage',
  'crm_manage_tags',
  'save_lead_note',
  'crm_add_case_note',
  'crm_notificar_equipe',
]);

/** Das de marco, as que mudam ESTADO: sem mensagem enviada, o fato que afirmam não aconteceu. */
const MUDAM_ESTADO: ReadonlySet<string> = new Set(['update_lead_state', 'crm_move_lead_stage', 'crm_manage_tags']);

export interface ResultadoAdiado {
  ok: true;
  status: 'adiado_para_depois_do_envio';
  proximo_passo: string;
}

interface Pendente {
  nome: string;
  executar: () => Promise<unknown>;
}

export interface MarcosDoTurno {
  /** Embrulha o `execute` de uma ferramenta de marco. Antes do 1º envio do turno ela vai para a fila; depois, roda na hora. */
  embrulhar<A extends unknown[], R>(nome: string, executar: (...args: A) => Promise<R>): (...args: A) => Promise<R | ResultadoAdiado>;
  /** Uma mensagem SAIU (ou foi aceita pelo canal para sair): libera a fila. */
  aoEnviar(): Promise<void>;
  /** Fim do turno: resolve o que sobrou. Idempotente. */
  encerrar(info: { houveTentativaDeEnvio: boolean }): Promise<void>;
  /** Quantas ficaram na fila (para teste e log). */
  pendentes(): number;
}

export function criarMarcosDoTurno(log: Pick<Logger, 'info' | 'warn'>): MarcosDoTurno {
  let enviou = false;
  let encerrado = false;
  let fila: Pendente[] = [];

  async function rodar(lista: Pendente[], quando: string): Promise<void> {
    for (const p of lista) {
      try {
        await p.executar();
      } catch (err) {
        log.warn('marco do turno falhou ao ser aplicado', {
          ferramenta: p.nome,
          quando,
          error: (err instanceof Error ? err.message : String(err)).slice(0, 160),
        });
      }
    }
  }

  return {
    embrulhar(nome, executar) {
      return async (...args) => {
        if (enviou || encerrado) return executar(...args);
        fila.push({ nome, executar: () => executar(...args) });
        return {
          ok: true,
          status: 'adiado_para_depois_do_envio',
          proximo_passo:
            'Registrado: será aplicado assim que a sua mensagem a este cliente sair. Envie a mensagem agora com send_message e não repita esta ação.',
        } satisfies ResultadoAdiado;
      };
    },

    async aoEnviar() {
      if (enviou) return;
      enviou = true;
      const lista = fila;
      fila = [];
      if (lista.length > 0) log.info('marcos aplicados depois do envio', { ferramentas: lista.map((p) => p.nome) });
      await rodar(lista, 'depois_do_envio');
    },

    async encerrar({ houveTentativaDeEnvio }) {
      if (encerrado) return;
      encerrado = true;
      const lista = fila;
      fila = [];
      if (lista.length === 0) return;
      if (!houveTentativaDeEnvio) {
        log.info('marcos aplicados em turno sem envio', { ferramentas: lista.map((p) => p.nome) });
        await rodar(lista, 'turno_sem_envio');
        return;
      }
      // Tentou enviar e nada saiu.
      const descartados = lista.filter((p) => MUDAM_ESTADO.has(p.nome));
      const mantidos = lista.filter((p) => !MUDAM_ESTADO.has(p.nome));
      if (descartados.length > 0) {
        log.info('marcos de estado descartados: a mensagem do marco não saiu', { ferramentas: descartados.map((p) => p.nome) });
      }
      await rodar(mantidos, 'mensagem_nao_saiu');
    },

    pendentes() {
      return fila.length;
    },
  };
}
