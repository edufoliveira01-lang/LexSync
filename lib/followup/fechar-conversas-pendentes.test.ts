import { describe, expect, it } from "vitest";

import { MARCA_DE_EVENTO } from "@/lib/inbox/evento-na-conversa-marca";

import { grafoFechaAConversa, jaTratadaDepoisDaConclusao } from "./fechar-conversas-pendentes";

describe("grafoFechaAConversa", () => {
  it("true quando o nó Fim manda fechar", () => {
    expect(grafoFechaAConversa({ nodes: [{ type: "trigger" }, { type: "end", config: { ao_finalizar: { tipo: "fechar_conversa" } } }] })).toBe(true);
  });
  it("false para outros finais, grafo vazio ou inválido", () => {
    expect(grafoFechaAConversa({ nodes: [{ type: "end", config: { ao_finalizar: { tipo: "nada" } } }] })).toBe(false);
    expect(grafoFechaAConversa({ nodes: [{ type: "end", config: {} }] })).toBe(false);
    expect(grafoFechaAConversa({})).toBe(false);
    expect(grafoFechaAConversa(null)).toBe(false);
  });
});

describe("jaTratadaDepoisDaConclusao", () => {
  const concluida = "2026-11-14T10:00:00.000Z";
  it("evento de fechar depois da conclusão: já tratada", () => {
    expect(jaTratadaDepoisDaConclusao([{ body: `${MARCA_DE_EVENTO}O sistema fechou a conversa — roteiro concluído`, created_at: "2026-11-14T10:00:30.000Z" }], concluida)).toBe(true);
  });
  it("reabertura pela equipe também impede de fechar de novo", () => {
    expect(jaTratadaDepoisDaConclusao([{ body: `${MARCA_DE_EVENTO}Ana reabriu a conversa`, created_at: "2026-11-14T10:05:00.000Z" }], concluida)).toBe(true);
  });
  it("nota comum ou evento anterior à conclusão não conta", () => {
    expect(jaTratadaDepoisDaConclusao([{ body: "o cliente fechou a conversa?", created_at: "2026-11-14T10:01:00.000Z" }], concluida)).toBe(false);
    expect(jaTratadaDepoisDaConclusao([{ body: `${MARCA_DE_EVENTO}Ana fechou a conversa`, created_at: "2026-11-14T09:00:00.000Z" }], concluida)).toBe(false);
    expect(jaTratadaDepoisDaConclusao([], concluida)).toBe(false);
  });
});
