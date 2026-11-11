import { describe, expect, it } from 'vitest';

import {
  blocoDoOrcamentoDePerguntas,
  contarPerguntasDeTriagem,
  limiteDePerguntasDoTexto,
  pareceResumo,
  type MensagemDaConversa,
} from './orcamento-de-perguntas';

const ia = (body: string): MensagemDaConversa => ({ direction: 'outbound', body, humana: false });
const eu = (body: string): MensagemDaConversa => ({ direction: 'inbound', body, humana: false });

describe('o limite vem do texto do próprio agente', () => {
  it('lê "no máximo N perguntas" e "de A a B perguntas"; sem a regra, fica desligado', () => {
    expect(limiteDePerguntasDoTexto('A triagem tem fim: no máximo 4 perguntas por área.')).toBe(4);
    expect(limiteDePerguntasDoTexto('Faça de 3 a 5 perguntas chave por área')).toBe(5);
    expect(limiteDePerguntasDoTexto('Faça de 3 a 4 perguntas-chave')).toBe(4);
    expect(limiteDePerguntasDoTexto('Atenda com cordialidade.')).toBeNull();
    expect(limiteDePerguntasDoTexto(undefined)).toBeNull();
  });
});

describe('contagem das perguntas de triagem', () => {
  it('não conta a pergunta do nome, nem o que a pessoa escreve, nem mensagem sem "?"', () => {
    const c = contarPerguntasDeTriagem([
      ia('Oi! Como posso chamar você?'),
      eu('Eduardo?'),
      ia('Ótimo, Eduardo! Me conta o que te trouxe aqui.'),
      ia('Você já pediu o BPC ao INSS?'),
      ia('Qual é a sua idade?'),
    ]);
    expect(c).toEqual({ feitas: 2, resumoJaEnviado: false });
  });

  it('mensagem de atendente humano não conta', () => {
    const c = contarPerguntasDeTriagem([{ direction: 'outbound', body: 'Qual é o seu CPF?', humana: true }, ia('Qual a sua idade?')]);
    expect(c.feitas).toBe(1);
  });

  it('o resumo encerra a triagem: o que vem depois não é contado e o bloco some', () => {
    const resumo = '➡ *RESUMO DA SUA SITUAÇÃO*\nTexto.\n➡ *O QUE A GENTE FAZ*';
    expect(pareceResumo(resumo)).toBe(true);
    const c = contarPerguntasDeTriagem([ia('Qual a idade?'), ia(resumo), ia('Qual o seu CPF?'), ia('E o RG?')]);
    expect(c).toEqual({ feitas: 1, resumoJaEnviado: true });
    expect(blocoDoOrcamentoDePerguntas({ limitePorArea: 4, contagem: c })).toBeNull();
  });
});

describe('o bloco que só o modelo lê', () => {
  it('mostra quantas já foram e quantas restam; avisa na última; manda parar no teto', () => {
    const pergunta = (n: number) => Array.from({ length: n }, (_, i) => ia(`Pergunta ${i}?`));
    const meio = blocoDoOrcamentoDePerguntas({ limitePorArea: 4, contagem: contarPerguntasDeTriagem(pergunta(3)) });
    expect(meio).toContain('já fez 3');
    expect(meio).toContain('teto é 6');
    expect(meio).toContain('Restam 3');
    const ultima = blocoDoOrcamentoDePerguntas({ limitePorArea: 4, contagem: contarPerguntasDeTriagem(pergunta(5)) });
    expect(ultima).toContain('Resta uma');
    const teto = blocoDoOrcamentoDePerguntas({ limitePorArea: 4, contagem: contarPerguntasDeTriagem(pergunta(6)) });
    expect(teto).toContain('TETO FOI ATINGIDO');
    expect(teto).toContain('NÃO faça nenhuma pergunta nova');
    const muito = blocoDoOrcamentoDePerguntas({ limitePorArea: 4, contagem: contarPerguntasDeTriagem(pergunta(20)) });
    expect(muito).toContain('TETO FOI ATINGIDO');
  });

  it('sem limite no texto do agente, não há bloco', () => {
    expect(blocoDoOrcamentoDePerguntas({ limitePorArea: null, contagem: { feitas: 9, resumoJaEnviado: false } })).toBeNull();
  });
});
