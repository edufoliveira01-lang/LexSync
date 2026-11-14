import { describe, expect, it } from "vitest";

import { agruparPorDia, horaCurta, quandoLegivel, textoDaConfirmacao } from "./quando-legivel";

const SP = "America/Sao_Paulo";

describe("horário legível no fuso da agenda", () => {
  it("14h30 em Brasília é 17:30Z", () => {
    expect(horaCurta("2026-11-20T17:30:00Z", SP)).toBe("14h30");
  });
  it("hora cheia some o minuto", () => {
    expect(horaCurta("2026-11-20T17:00:00Z", SP)).toBe("14h");
  });
  it("meia-noite não vira 24h", () => {
    expect(horaCurta("2026-11-20T03:00:00Z", SP)).toBe("00h");
  });
  it("junta dia da semana, data e hora", () => {
    expect(quandoLegivel("2026-11-20T17:30:00Z", SP)).toMatch(/^sex\.?, 20\/11, às 14h30$/);
  });
  it("o fuso muda o dia: 02:00Z ainda é o dia anterior em Brasília", () => {
    expect(quandoLegivel("2026-11-21T02:00:00Z", SP)).toMatch(/20\/11, às 23h$/);
  });
});

describe("horários livres agrupados por dia", () => {
  const agora = new Date("2026-11-20T12:00:00Z"); // 09h em Brasília, sexta
  const slots = [
    { inicio: "2026-11-20T17:00:00Z", fim: "2026-11-20T18:00:00Z" },
    { inicio: "2026-11-20T14:00:00Z", fim: "2026-11-20T15:00:00Z" },
    { inicio: "2026-11-21T13:00:00Z", fim: "2026-11-21T14:00:00Z" },
    { inicio: "2026-11-23T13:00:00Z", fim: "2026-11-23T14:00:00Z" },
    { inicio: "2026-11-24T13:00:00Z", fim: "2026-11-24T14:00:00Z" },
  ];

  it("rotula Hoje e Amanhã, ordena e usa o fuso da regra", () => {
    const r = agruparPorDia(slots, SP, agora);
    expect(r.map((d) => d.rotulo.split(",")[0])).toEqual(["Hoje", "Amanhã", expect.stringMatching(/^seg/)]);
    expect(r[0]!.horarios.map((h) => h.rotulo)).toEqual(["11h", "14h"]);
  });
  it("limita os dias (3 por padrão)", () => {
    expect(agruparPorDia(slots, SP, agora)).toHaveLength(3);
    expect(agruparPorDia(slots, SP, agora, { maxDias: 4 })).toHaveLength(4);
  });
  it("limita os horários de cada dia", () => {
    const muitos = Array.from({ length: 12 }, (_, i) => ({ inicio: `2026-11-20T${String(12 + i).padStart(2, "0")}:00:00Z`, fim: "" }));
    expect(agruparPorDia(muitos, SP, agora, { maxPorDia: 5 })[0]!.horarios).toHaveLength(5);
  });
  it("sem horários, lista vazia", () => {
    expect(agruparPorDia([], SP, agora)).toEqual([]);
  });
});

describe("texto da confirmação ao cliente", () => {
  it("usa o primeiro nome, o tipo e o horário", () => {
    const t = textoDaConfirmacao({ nome: "Maria da Silva", tipo: "Consulta", inicio: "2026-11-20T17:30:00Z", fuso: SP });
    expect(t).toContain("Olá, Maria!");
    expect(t).toContain("consulta");
    expect(t).toContain("14h30");
    expect(t).not.toContain("Silva");
  });
  it("sem nome, só 'Olá!'; com local, inclui o local", () => {
    const t = textoDaConfirmacao({ nome: null, tipo: "Reunião", inicio: "2026-11-20T17:30:00Z", fuso: SP, local: "Escritório" });
    expect(t.startsWith("Olá! ")).toBe(true);
    expect(t).toContain("Local: Escritório.");
  });
});
