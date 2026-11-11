import { describe, expect, it } from "vitest";

import { mesDeBrasilia, montarRetrato, situacaoDoLead, ultimosMesesDoRetrato, type EtapaLida } from "@/lib/sales/indicadores-do-atendimento";

const etapas: EtapaLida[] = [
  { id: "e1", name: "Novo contato", is_lost: false, is_won: false, position: 1 },
  { id: "e2", name: "Em triagem", is_lost: false, is_won: false, position: 2 },
  { id: "e3", name: "Proposta enviada", is_lost: false, is_won: false, position: 3 },
  { id: "e4", name: "Contrato assinado", is_lost: false, is_won: false, position: 5 },
  { id: "e5", name: "Sem interesse", is_lost: true, is_won: false, position: 8 },
  { id: "e6", name: "Desqualificado", is_lost: true, is_won: false, position: 9 },
  { id: "e7", name: "Ganho", is_lost: false, is_won: true, position: 10 },
];
const por = new Map(etapas.map((e) => [e.id, e]));

describe("situação do lead", () => {
  it("lê pelo nome da etapa e pelo desfecho", () => {
    expect(situacaoDoLead({ status: "open" }, por.get("e1"))).toBe("em_andamento");
    expect(situacaoDoLead({ status: "open" }, por.get("e2"))).toBe("em_andamento");
    expect(situacaoDoLead({ status: "open" }, por.get("e3"))).toBe("qualificado");
    expect(situacaoDoLead({ status: "open" }, por.get("e4"))).toBe("qualificado");
    expect(situacaoDoLead({ status: "lost" }, por.get("e5"))).toBe("sem_interesse");
    expect(situacaoDoLead({ status: "lost" }, por.get("e6"))).toBe("desqualificado");
    expect(situacaoDoLead({ status: "won" }, por.get("e7"))).toBe("qualificado");
  });
  it("etapa desconhecida e aberta é «em andamento»", () => {
    expect(situacaoDoLead({ status: "open" }, undefined)).toBe("em_andamento");
  });
});

describe("meses e retrato", () => {
  it("o mês é o de Brasília (UTC-3): 01h UTC do dia 1º ainda é o mês anterior", () => {
    expect(mesDeBrasilia("2026-11-01T01:00:00Z")).toBe("2026-10");
    expect(mesDeBrasilia("2026-11-01T03:00:00Z")).toBe("2026-11");
    expect(ultimosMesesDoRetrato("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
  it("conta por coorte e mostra onde estão os que seguem em atendimento", () => {
    const agora = new Date("2026-11-11T15:00:00Z");
    const leads = [
      { created_at: "2026-11-02T12:00:00Z", status: "open", stage_id: "e1" },
      { created_at: "2026-11-03T12:00:00Z", status: "open", stage_id: "e3" },
      { created_at: "2026-11-04T12:00:00Z", status: "lost", stage_id: "e6" },
      { created_at: "2026-11-05T12:00:00Z", status: "lost", stage_id: "e5" },
      { created_at: "2026-10-05T12:00:00Z", status: "won", stage_id: "e7" },
    ];
    const r = montarRetrato(leads, [{ stage_id: "e1" }, { stage_id: "e1" }, { stage_id: "e2" }, { stage_id: "e3" }], etapas, agora);
    const nov = r.meses.find((m) => m.mes === "2026-11")!;
    expect(nov).toMatchObject({ novos: 4, qualificados: 1, desqualificados: 1, sem_interesse: 1, em_andamento: 1 });
    expect(r.meses.find((m) => m.mes === "2026-10")).toMatchObject({ novos: 1, qualificados: 1 });
    expect(r.por_etapa.map((e) => `${e.nome}:${e.total}`)).toEqual(["Novo contato:2", "Em triagem:1", "Proposta enviada:1"]);
    expect(r.abertos).toBe(4);
    expect(r.meses).toHaveLength(6);
  });
});
