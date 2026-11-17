import { describe, expect, it } from "vitest";

import { montarRetrato, type EtapaLida, type LeadLido } from "./indicadores-do-atendimento";

const etapas: EtapaLida[] = [
  { id: "novo", name: "Novo contato", is_lost: false, is_won: false, position: 1 },
  { id: "triagem", name: "Em triagem", is_lost: false, is_won: false, position: 2 },
  { id: "sem", name: "Sem interesse", is_lost: true, is_won: false, position: 8 },
  { id: "cli-novo", name: "Novo", is_lost: false, is_won: false, position: 1 },
];
const agora = new Date("2026-11-17T15:00:00Z");
const lead = (p: Partial<LeadLido> & Pick<LeadLido, "stage_id">): LeadLido => ({ created_at: "2026-11-16T12:00:00Z", status: "open", pipeline_id: "p-lead", contact_id: "c1", ...p });
const mesAtual = (r: ReturnType<typeof montarRetrato>) => r.meses.find((m) => m.mes === "2026-11")!;

describe("montarRetrato — lead x cliente", () => {
  it("quem está no funil de clientes não entra na conta de captação e aparece à parte", () => {
    const r = montarRetrato(
      [lead({ stage_id: "novo", contact_id: "a" }), lead({ stage_id: "cli-novo", pipeline_id: "p-cli", contact_id: "b" })],
      [{ stage_id: "novo", pipeline_id: "p-lead" }, { stage_id: "cli-novo", pipeline_id: "p-cli" }],
      etapas, agora, new Set(["p-cli"]),
    );
    expect(mesAtual(r).novos).toBe(1);
    expect(mesAtual(r).em_andamento).toBe(1);
    expect(r.abertos).toBe(1);
    expect(r.clientes.abertos).toBe(1);
    expect(r.clientes.por_etapa).toEqual([{ nome: "Novo", total: 1, posicao: 1 }]);
    expect(r.por_etapa.map((e) => e.nome)).toEqual(["Novo contato"]);
  });

  it("a mesma pessoa conta uma vez no mês, pela situação do cartão mais recente", () => {
    const r = montarRetrato(
      [
        lead({ stage_id: "sem", status: "lost", created_at: "2026-11-16T10:00:00Z", contact_id: "peba" }),
        lead({ stage_id: "novo", created_at: "2026-11-16T18:00:00Z", contact_id: "peba" }),
      ],
      [{ stage_id: "novo", pipeline_id: "p-lead" }],
      etapas, agora, new Set(),
    );
    expect(mesAtual(r).novos).toBe(1);
    expect(mesAtual(r).sem_interesse).toBe(0);
    expect(mesAtual(r).em_andamento).toBe(1);
  });

  it("sem funil de clientes marcado, tudo segue como antes", () => {
    const r = montarRetrato([lead({ stage_id: "novo" }), lead({ stage_id: "triagem", contact_id: "z" })], [], etapas, agora);
    expect(mesAtual(r).novos).toBe(2);
    expect(r.clientes.abertos).toBe(0);
  });
});
