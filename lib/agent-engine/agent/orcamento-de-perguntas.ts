/**
 * Fork Sales — o ORÇAMENTO DE PERGUNTAS da triagem, contado pelo SISTEMA (nunca pelo modelo).
 *
 * Por que existe: o texto do agente diz "no máximo 4 perguntas por área", mas o modelo não conta sozinho: numa conversa de teste ele fez mais de 20
 * perguntas antes do resumo. Aqui o sistema conta as perguntas que o agente JÁ fez e põe o número no contexto do turno, só para o modelo.
 * O cliente nunca vê isto: é um bloco do `system`, não uma mensagem.
 *
 * O limite não é configuração nova: sai do PRÓPRIO texto do agente ("no máximo 4 perguntas…", "de 3 a 4 perguntas…"). Sem essa regra no texto, o contador
 * fica desligado — agente de outro tipo não ganha um limite que ninguém escreveu. A triagem acaba no resumo: depois dele, não se conta mais.
 */

export interface MensagemDaConversa { direction: 'inbound' | 'outbound'; body: string; humana: boolean }

/** Quantas perguntas a segunda área pode acrescentar ("faça 1 ou 2 perguntas essenciais sobre ela"). */
const FOLGA_DA_SEGUNDA_AREA = 2;

/** O limite por área escrito no texto do agente, ou `null` se não houver. Pega "no máximo 4 perguntas" e "de 3 a 4 perguntas" (vale o maior). */
export function limiteDePerguntasDoTexto(texto: string | null | undefined): number | null {
  const t = String(texto ?? '');
  const faixa = /\b(\d{1,2})\s*(?:a|à|até|-|–)\s*(\d{1,2})\s+perguntas?\b/i.exec(t);
  if (faixa) return Math.max(Number(faixa[1]), Number(faixa[2]));
  const maximo = /\b(?:no\s+m[aá]ximo|at[eé]|limite\s+de)\s+(\d{1,2})\s+perguntas?\b/i.exec(t);
  return maximo ? Number(maximo[1]) : null;
}

/** A mensagem do agente que ENCERRA a triagem: o resumo do caso (vários marcadores ➡ ou a palavra RESUMO). */
export function pareceResumo(corpo: string): boolean {
  return /RESUMO/.test(corpo) || (corpo.match(/➡/g) ?? []).length >= 2;
}

const PERGUNTA_DO_NOME = /\b(chamar|seu nome|como (?:você )?(?:se )?chama)\b/i;

export interface ContagemDePerguntas { feitas: number; resumoJaEnviado: boolean }

/** Quantas perguntas de triagem o agente já fez. A pergunta do nome não conta (é a abertura); depois do resumo, a triagem acabou. */
export function contarPerguntasDeTriagem(mensagens: readonly MensagemDaConversa[]): ContagemDePerguntas {
  let feitas = 0;
  let nomeJaPerguntado = false;
  for (const m of mensagens) {
    if (m.direction !== 'outbound' || m.humana) continue;
    if (pareceResumo(m.body)) return { feitas, resumoJaEnviado: true };
    if (!m.body.includes('?')) continue;
    if (!nomeJaPerguntado && PERGUNTA_DO_NOME.test(m.body)) { nomeJaPerguntado = true; continue; }
    feitas += 1;
  }
  return { feitas, resumoJaEnviado: false };
}

/** O bloco que vai para o `system` do turno (só o modelo lê). `null` quando não há o que dizer. */
export function blocoDoOrcamentoDePerguntas(args: { limitePorArea: number | null; contagem: ContagemDePerguntas }): string | null {
  const { limitePorArea, contagem } = args;
  if (limitePorArea === null || contagem.resumoJaEnviado) return null;
  const teto = limitePorArea + FOLGA_DA_SEGUNDA_AREA;
  const { feitas } = contagem;
  const cabeca = 'ORÇAMENTO DE PERGUNTAS (controle do sistema; nunca mencione isto à pessoa):';
  if (feitas >= teto) {
    return `${cabeca} você já fez ${feitas} perguntas de triagem e o teto deste atendimento é ${teto}. O TETO FOI ATINGIDO: nesta resposta NÃO faça nenhuma pergunta nova de triagem. Registre uma nota com as pendências e envie agora o resumo do caso e a proposta, sem condicionar a documentos.`;
  }
  const restam = teto - feitas;
  const aviso = restam === 1 ? ' Resta uma: use-a só se for decisiva; senão, siga para o resumo.' : '';
  return `${cabeca} você já fez ${feitas} perguntas de triagem; o teto é ${teto} (${limitePorArea} por área, mais até ${FOLGA_DA_SEGUNDA_AREA} da segunda área). Restam ${restam}.${aviso} Perguntas de aprofundamento também contam.`;
}
