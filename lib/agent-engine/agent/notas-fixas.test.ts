import { describe, expect, it } from 'vitest';

import { blocoDasNotasFixas, registrarPerguntasERespostas, textoDaFicha, ultimaPergunta, type FichaParaNota } from './notas-fixas';

type Nota = { id: string; headline: string; body: string; created_at: number };
type Msg = { direction: string; body: string; sent_at: string };

/** Banco falso: só entende as consultas deste módulo. */
function bancoFalso(msgs: Msg[]) {
  const notas: Nota[] = [];
  let seq = 0;
  return {
    notas,
    async query(sql: string, p: unknown[] = []) {
      const s = sql.replace(/\s+/g, ' ').trim();
      if (s.startsWith('select id, body from lead_notes') && s.includes('headline = $3')) {
        return { rows: notas.filter((n) => n.headline === p[2]).slice(0, 1) };
      }
      if (s.startsWith('select direction, body, sent_at')) {
        return { rows: msgs.filter((m) => m.sent_at > String(p[2])) };
      }
      if (s.startsWith('select count(*)')) {
        return { rows: [{ n: String(notas.filter((n) => n.headline.startsWith('REGISTRO DA TRIAGEM — parte')).length) }] };
      }
      if (s.startsWith('insert into lead_notes')) {
        notas.push({ id: `n${++seq}`, headline: String(p[2]), body: String(p[3]), created_at: seq });
        return { rows: [] };
      }
      if (s.startsWith('update lead_notes set headline')) {
        const n = notas.find((x) => x.id === p[0])!;
        n.headline = String(p[1]);
        n.body = String(p[2]);
        return { rows: [] };
      }
      if (s.startsWith('update lead_notes set body')) {
        notas.find((x) => x.id === p[0])!.body = String(p[1]);
        return { rows: [] };
      }
      if (s.startsWith('select headline, body from lead_notes')) {
        return { rows: [...notas].sort((a, b) => a.created_at - b.created_at) };
      }
      throw new Error(`consulta inesperada: ${s.slice(0, 80)}`);
    },
  };
}

const ids = { tenantId: 't', contactId: 'c' };

describe('ultimaPergunta', () => {
  it('pega a última frase com interrogação', () => {
    expect(ultimaPergunta('Entendi. Qual a sua profissão? Foi no trabalho?')).toBe('Foi no trabalho?');
  });
  it('sem interrogação, não há pergunta', () => {
    expect(ultimaPergunta('Entendi, obrigada.')).toBeNull();
  });
});

describe('registrarPerguntasERespostas', () => {
  it('anota pergunta e resposta, sem duplicar na segunda chamada', async () => {
    const db = bancoFalso([
      { direction: 'outbound', body: 'Qual a sua profissão?', sent_at: '2026-11-16T19:00:00Z' },
      { direction: 'inbound', body: 'Ajudante de caminhão', sent_at: '2026-11-16T19:01:00Z' },
      { direction: 'inbound', body: 'faz 3 anos', sent_at: '2026-11-16T19:01:10Z' },
      { direction: 'outbound', body: 'Foi acidente de trabalho?', sent_at: '2026-11-16T19:02:00Z' },
      { direction: 'inbound', body: 'Sim', sent_at: '2026-11-16T19:03:00Z' },
    ]);
    const r1 = await registrarPerguntasERespostas(db, ids);
    expect(r1.anotadas).toBe(1);
    const corpo = db.notas[0]!.body;
    expect(corpo).toContain('P: Qual a sua profissão?');
    expect(corpo).toContain('R: Ajudante de caminhão / faz 3 anos');
    expect(corpo).not.toContain('Sim'); // ainda sem resposta da IA: espera o próximo turno
    const r2 = await registrarPerguntasERespostas(db, ids);
    expect(r2.anotadas).toBe(0);
    expect(db.notas).toHaveLength(1);
  });

  it('o "Sim" é ligado à pergunta anterior no turno seguinte', async () => {
    const msgs: Msg[] = [
      { direction: 'outbound', body: 'Foi acidente de trabalho?', sent_at: '2026-11-16T19:02:00Z' },
      { direction: 'inbound', body: 'Sim', sent_at: '2026-11-16T19:03:00Z' },
    ];
    const db = bancoFalso(msgs);
    await registrarPerguntasERespostas(db, ids);
    msgs.push({ direction: 'outbound', body: 'Houve CAT?', sent_at: '2026-11-16T19:04:00Z' });
    const r = await registrarPerguntasERespostas(db, ids);
    expect(r.anotadas).toBe(1);
    expect(db.notas[0]!.body).toContain('P: Foi acidente de trabalho?\nR: Sim');
  });

  it('com muita conversa, o registro fica guardado e entra no bloco', async () => {
    const msgs: Msg[] = [];
    for (let i = 0; i < 30; i++) {
      msgs.push({ direction: 'outbound', body: `Pergunta ${i} com um texto bem comprido para ocupar espaço na nota?`, sent_at: `2026-11-16T19:${String(i).padStart(2, '0')}:00Z` });
      msgs.push({ direction: 'inbound', body: `Resposta ${i} também comprida para ocupar espaço na nota do registro`, sent_at: `2026-11-16T19:${String(i).padStart(2, '0')}:30Z` });
    }
    msgs.push({ direction: 'outbound', body: 'Fim?', sent_at: '2026-11-16T20:00:00Z' });
    const db = bancoFalso(msgs);
    await registrarPerguntasERespostas(db, ids);
    expect(db.notas.length).toBeGreaterThanOrEqual(1);
    const bloco = await blocoDasNotasFixas(db, 't', 'c');
    expect(bloco).toContain('NOTAS FIXAS');
  });
});

describe('textoDaFicha e blocoDasNotasFixas', () => {
  const ficha: FichaParaNota = {
    titulo: 'Auxílio-acidente',
    resumo: 'Benefício mensal para sequela permanente.',
    requisitos: ['Qualidade de segurado', 'Sequela que reduz a capacidade'],
    quando_nao_cabe: ['Sem sequela'],
    perguntas_que_faltam: ['Quando foi o acidente?'],
    prazos: ['5 anos'],
    cuidados: ['Não prometer resultado'],
    fontes: [{ titulo: 'planalto.gov.br', url: 'https://planalto.gov.br' }],
    revisado_em: '2026-11-11',
    status: 'pendente_revisao',
  };
  it('traz requisitos e quando não cabe, e avisa da revisão pendente', () => {
    const t = textoDaFicha(ficha);
    expect(t).toContain('REQUISITOS');
    expect(t).toContain('QUANDO NÃO CABE');
    expect(t).toContain('sem conferência de advogado');
  });
  it('sem notas fixas, o bloco é vazio', async () => {
    expect(await blocoDasNotasFixas(bancoFalso([]), 't', 'c')).toBe('');
  });
  it('o bloco leva o registro e a ficha', async () => {
    const db = bancoFalso([]);
    db.notas.push({ id: 'a', headline: 'FICHA DO BENEFÍCIO — Auxílio-acidente', body: textoDaFicha(ficha), created_at: 1 });
    db.notas.push({ id: 'b', headline: 'REGISTRO DA TRIAGEM', body: '#ate=2026-11-16T19:00:00Z|p=\n[16/11 19:01] P: Profissão?\nR: Ajudante', created_at: 2 });
    const bloco = await blocoDasNotasFixas(db, 't', 'c');
    expect(bloco).toContain('P: Profissão?');
    expect(bloco).toContain('Qualidade de segurado');
    expect(bloco).not.toContain('#ate=');
  });
});
