import { describe, expect, it, vi } from 'vitest';

import { criarMarcosDoTurno, FERRAMENTAS_DE_MARCO } from './marcos-apos-envio';

const log = () => ({ info: vi.fn(), warn: vi.fn() });

describe('marcos do turno: fez, anotou, classificou, seguiu', () => {
  it('antes do envio a ferramenta de marco NÃO roda: fica na fila e o modelo é avisado', async () => {
    const m = criarMarcosDoTurno(log());
    const mover = vi.fn(async () => ({ ok: true, moveu: true }));
    const r = await m.embrulhar('crm_move_lead_stage', mover)();
    expect(mover).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true, status: 'adiado_para_depois_do_envio' });
    expect(m.pendentes()).toBe(1);
  });

  it('quando a mensagem sai, a fila roda NA ORDEM em que foi pedida', async () => {
    const m = criarMarcosDoTurno(log());
    const ordem: string[] = [];
    await m.embrulhar('update_lead_state', async () => ordem.push('estado'))();
    await m.embrulhar('crm_manage_tags', async () => ordem.push('etiqueta'))();
    await m.embrulhar('save_lead_note', async () => ordem.push('nota'))();
    expect(ordem).toEqual([]);
    await m.aoEnviar();
    expect(ordem).toEqual(['estado', 'etiqueta', 'nota']);
    expect(m.pendentes()).toBe(0);
  });

  it('depois do primeiro envio, a ferramenta de marco roda na hora, com o resultado real', async () => {
    const m = criarMarcosDoTurno(log());
    await m.aoEnviar();
    const mover = vi.fn(async () => ({ ok: true, moveu: true }));
    const r = await m.embrulhar('crm_move_lead_stage', mover)();
    expect(mover).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ ok: true, moveu: true });
  });

  it('turno SEM tentativa de envio: roda tudo no fim, como era antes', async () => {
    const m = criarMarcosDoTurno(log());
    const mover = vi.fn(async () => 1);
    await m.embrulhar('crm_move_lead_stage', mover)();
    await m.encerrar({ houveTentativaDeEnvio: false });
    expect(mover).toHaveBeenCalledTimes(1);
  });

  it('tentou enviar e NADA saiu: descarta etapa e etiqueta, mas mantém nota e aviso', async () => {
    const l = log();
    const m = criarMarcosDoTurno(l);
    const etapa = vi.fn(async () => 1);
    const etiqueta = vi.fn(async () => 1);
    const nota = vi.fn(async () => 1);
    const aviso = vi.fn(async () => 1);
    await m.embrulhar('update_lead_state', etapa)();
    await m.embrulhar('crm_manage_tags', etiqueta)();
    await m.embrulhar('crm_add_case_note', nota)();
    await m.embrulhar('crm_notificar_equipe', aviso)();
    await m.encerrar({ houveTentativaDeEnvio: true });
    expect(etapa).not.toHaveBeenCalled();
    expect(etiqueta).not.toHaveBeenCalled();
    expect(nota).toHaveBeenCalledTimes(1);
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(l.info).toHaveBeenCalledWith('marcos de estado descartados: a mensagem do marco não saiu', { ferramentas: ['update_lead_state', 'crm_manage_tags'] });
  });

  it('um marco que falha depois do envio vira log e não derruba os outros', async () => {
    const l = log();
    const m = criarMarcosDoTurno(l);
    const segundo = vi.fn(async () => 1);
    await m.embrulhar('update_lead_state', async () => { throw new Error('banco fora'); })();
    await m.embrulhar('crm_manage_tags', segundo)();
    await expect(m.aoEnviar()).resolves.toBeUndefined();
    expect(segundo).toHaveBeenCalledTimes(1);
    expect(l.warn).toHaveBeenCalled();
  });

  it('aoEnviar e encerrar são idempotentes (nada roda duas vezes)', async () => {
    const m = criarMarcosDoTurno(log());
    const mover = vi.fn(async () => 1);
    await m.embrulhar('crm_move_lead_stage', mover)();
    await m.aoEnviar();
    await m.aoEnviar();
    await m.encerrar({ houveTentativaDeEnvio: true });
    await m.encerrar({ houveTentativaDeEnvio: false });
    expect(mover).toHaveBeenCalledTimes(1);
  });

  it('a passagem para a equipe NÃO é marco: segue imediata', () => {
    expect(FERRAMENTAS_DE_MARCO.has('request_human_handoff')).toBe(false);
    expect(FERRAMENTAS_DE_MARCO.has('open_human_case')).toBe(false);
    expect(FERRAMENTAS_DE_MARCO.has('crm_passar_para_agente')).toBe(false);
    expect(FERRAMENTAS_DE_MARCO.has('update_lead_state')).toBe(true);
  });
});
