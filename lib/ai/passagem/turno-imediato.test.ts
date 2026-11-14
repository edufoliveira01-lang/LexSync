import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { enfileirarTurnoDeDestino } from "./turno-imediato";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ORG = U(1), CONTATO = U(2), CONVERSA = U(3), CANAL = U(4), MENSAGEM = U(5), EVENTO = U(6), JOB = U(7);

const payloadDeOrigem = { conversation_id: CONVERSA, contact_id: CONTATO, channel_session_id: CANAL, inbound_message_id: MENSAGEM, crm_event_id: EVENTO };

/** Um banco de mentira com as três perguntas que o módulo faz: ler o job de origem, procurar turno já criado e inserir. */
function banco(opts: { origem?: { id: string; kind: string; payload: unknown } | null; existentes?: unknown[]; erroNoInsert?: boolean }) {
  const inseridos: Record<string, unknown>[] = [];
  const admin = {
    from: (tabela: string) => {
      expect(tabela).toBe("job_queue");
      return {
        select: (colunas: string) => {
          const cadeia: Record<string, unknown> = {};
          const filtros: Record<string, unknown> = {};
          cadeia.eq = (c: string, v: unknown) => { filtros[c] = v; return cadeia; };
          cadeia.filter = () => cadeia;
          cadeia.limit = async () => ({ data: opts.existentes ?? [] });
          cadeia.maybeSingle = async () => ({ data: opts.origem === undefined ? null : opts.origem });
          void colunas;
          return cadeia;
        },
        insert: async (linha: Record<string, unknown>) => {
          if (opts.erroNoInsert) return { error: { message: "falhou" } };
          inseridos.push(linha);
          return { error: null };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { admin, inseridos };
}

const base = { organizationId: ORG, contactId: CONTATO, jobDeOrigemId: JOB, agora: () => new Date("2026-11-14T12:00:00Z") };

describe("passagem entre agentes: turno imediato do destino", () => {
  it("cria um turno para a MESMA mensagem, marcado, com folga de segundos", async () => {
    const { admin, inseridos } = banco({ origem: { id: JOB, kind: "inbound_turn", payload: payloadDeOrigem } });
    const r = await enfileirarTurnoDeDestino({ ...base, admin });
    expect(r).toEqual({ enfileirado: true, jaExistia: false });
    expect(inseridos).toHaveLength(1);
    expect(inseridos[0]).toMatchObject({
      organization_id: ORG,
      contact_id: CONTATO,
      kind: "inbound_turn",
      run_after: "2026-11-14T12:00:02.000Z",
      max_attempts: 3,
      payload: { ...payloadDeOrigem, passagem_imediata: true, passagem_de_job: JOB },
    });
  });

  it("sem o job de origem (turno de prévia, por exemplo) não cria nada", async () => {
    const { admin, inseridos } = banco({});
    expect(await enfileirarTurnoDeDestino({ ...base, admin, jobDeOrigemId: undefined })).toEqual({ enfileirado: false, motivo: "sem_job" });
    expect(inseridos).toHaveLength(0);
  });

  it("follow-up de retomada não tem mensagem do cliente para responder", async () => {
    const { admin, inseridos } = banco({ origem: { id: JOB, kind: "followup_turn", payload: payloadDeOrigem } });
    expect(await enfileirarTurnoDeDestino({ ...base, admin })).toEqual({ enfileirado: false, motivo: "origem_nao_e_turno_de_resposta" });
    expect(inseridos).toHaveLength(0);
  });

  it("origem sem os ponteiros do payload: não inventa", async () => {
    const { admin } = banco({ origem: { id: JOB, kind: "inbound_turn", payload: { conversation_id: CONVERSA } } });
    expect(await enfileirarTurnoDeDestino({ ...base, admin })).toEqual({ enfileirado: false, motivo: "origem_sem_ponteiros" });
  });

  it("SEM LAÇO: um turno que já é imediato não cria outro", async () => {
    const { admin, inseridos } = banco({ origem: { id: JOB, kind: "inbound_turn", payload: { ...payloadDeOrigem, passagem_imediata: true } } });
    expect(await enfileirarTurnoDeDestino({ ...base, admin })).toEqual({ enfileirado: false, motivo: "sem_laco" });
    expect(inseridos).toHaveLength(0);
  });

  it("o retry do job de origem não cria um segundo turno", async () => {
    const { admin, inseridos } = banco({ origem: { id: JOB, kind: "inbound_turn", payload: payloadDeOrigem }, existentes: [{ id: U(9) }] });
    expect(await enfileirarTurnoDeDestino({ ...base, admin })).toEqual({ enfileirado: true, jaExistia: true });
    expect(inseridos).toHaveLength(0);
  });

  it("contato do job diferente do contato da passagem: recusa", async () => {
    const { admin } = banco({ origem: { id: JOB, kind: "inbound_turn", payload: { ...payloadDeOrigem, contact_id: U(99) } } });
    expect(await enfileirarTurnoDeDestino({ ...base, admin })).toEqual({ enfileirado: false, motivo: "contato_diferente" });
  });

  it("falha ao gravar: devolve não-enfileirado (quem chama volta à abertura fixa) e nunca lança", async () => {
    const { admin } = banco({ origem: { id: JOB, kind: "inbound_turn", payload: payloadDeOrigem }, erroNoInsert: true });
    expect(await enfileirarTurnoDeDestino({ ...base, admin })).toEqual({ enfileirado: false, motivo: "erro" });
  });

  it("erro inesperado na leitura também não lança", async () => {
    const admin = { from: vi.fn(() => { throw new Error("rede"); }) } as unknown as SupabaseClient;
    expect(await enfileirarTurnoDeDestino({ ...base, admin })).toEqual({ enfileirado: false, motivo: "erro" });
  });
});
