/**
 * Nó `internal_note` do follow-up: deixa uma NOTA INTERNA na conversa do cliente (só a equipe lê) e nunca envia mensagem.
 *
 * Mede, sem Postgres (mesmo dublê dos nós de ação do #2065): o nó parseia, avança pela aresta única, chama a escrita da nota UMA vez
 * com o texto e a conversa da inscrição, não enfileira turno de envio, e o replay do tick (evento já gravado) não repete a nota.
 */
import { describe, expect, it } from "vitest";

import { runFollowupTick, type AdminClient, type FollowupJobRequest, type TickDeps } from "@/lib/followup/engine";
import { flowGraphSchema } from "@/lib/followup/graph-schema";
import type { EnrollmentRow } from "@/lib/followup/node-handlers";

const ORG = "11111111-1111-4111-8111-111111111111";
const CONTATO = "22222222-2222-4222-8222-222222222222";
const CONVERSA = "44444444-4444-4444-8444-444444444444";

function inscricao(noAtual: string): EnrollmentRow {
  return {
    id: "e1", organization_id: ORG, pointer_id: "p1", version_id: "v1", contact_id: CONTATO, conversation_id: CONVERSA,
    current_node_id: noAtual, status: "active", next_eval_at: new Date().toISOString(), claimed_until: null, attempts: 0, max_attempts: 3,
    last_error: null, steps_taken: 0, outcome: null, cancel_reason: null, started_at: new Date().toISOString(), completed_at: null,
    updated_at: new Date().toISOString(),
  };
}

function grafo(texto: string) {
  const no = (id: string, type: string, config: unknown, i: number) => ({ id, type, config, label: `nó ${id}`, position: { x: 100 * i, y: 0 } });
  const nos = [no("n1", "trigger", {}, 0), no("n2", "internal_note", { texto }, 1), no("fim", "end", { outcome: "converted" }, 2)];
  return {
    nodes: nos,
    edges: [
      { id: "a", source: "n1", target: "n2", condition: { type: "always" } },
      { id: "b", source: "n2", target: "fim", condition: { type: "always" } },
    ],
  };
}

function cenario(texto: string, { replay = false }: { replay?: boolean } = {}) {
  const notas: unknown[] = [];
  const jobs: FollowupJobRequest[] = [];
  const eventos: string[] = [];
  const fila = [inscricao("n2")];
  const db: AdminClient = {
    async claimDueEnrollments() { return fila.splice(0, fila.length); },
    async loadFlowGraph() { return flowGraphSchema.parse(grafo(texto)); },
    async loadLeadFacts() { return { lead_stage: "etapa-a", tags: [], contact_name: "Cliente", custom_fields: {} }; },
    async loadEnrollmentEvents() { return []; },
    async insertEnrollmentEvent(e) { eventos.push(e.event_type); return { inserted: !replay }; },
    async updateEnrollment() {},
    async anotarNaConversa(item) { notas.push(item); },
    async loadLastInboundBody() { return null; },
    async loadFlowPointerName() { return null; },
    async insertDeadInboxItem() {},
    async persistirRespostaFollowup() {},
  };
  const deps: TickDeps = { db, clock: () => new Date("2026-11-14T12:00:00.000Z"), enqueueJob: async (j) => { jobs.push(j); } };
  return { deps, notas, jobs, eventos };
}

describe("nó de nota interna", () => {
  it("avança e grava a nota na conversa da inscrição, sem enfileirar mensagem", async () => {
    const c = cenario("Cliente sumiu depois da proposta.");
    const resumo = await runFollowupTick(c.deps);
    expect(resumo.failed).toBe(0);
    expect(resumo.advanced).toBe(1);
    expect(c.notas).toHaveLength(1);
    expect(c.notas[0]).toMatchObject({ organization_id: ORG, contact_id: CONTATO, enrollment_id: "e1", conversation_id: CONVERSA, config: { texto: "Cliente sumiu depois da proposta." } });
    expect(c.jobs).toHaveLength(0);
    expect(c.eventos).toEqual(["node_advanced"]);
  });

  it("replay do tick (evento do passo já gravado) NÃO repete a nota", async () => {
    const c = cenario("Pedir o comprovante.", { replay: true });
    await runFollowupTick(c.deps);
    expect(c.notas).toHaveLength(0);
  });

  it("o rascunho aceita a nota vazia (trabalho pela metade salva); quem recusa é a publicação", () => {
    expect(flowGraphSchema.safeParse(grafo("")).success).toBe(true);
  });
});
