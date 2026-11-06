import { describe, expect, it } from "vitest";

import { ETAPAS_ADVOCACIA } from "./modelo-advocacia";

describe("funil de escritório de advocacia", () => {
  it("tem uma etapa de fechamento e uma de perda, e as coerentes com o passo do agente", () => {
    expect(ETAPAS_ADVOCACIA.filter((e) => e.is_won)).toHaveLength(1);
    expect(ETAPAS_ADVOCACIA.filter((e) => e.is_lost)).toHaveLength(1);
    expect(ETAPAS_ADVOCACIA.find((e) => e.is_won)?.agent_stage_hint).toBe("won");
    expect(ETAPAS_ADVOCACIA.find((e) => e.is_lost)?.agent_stage_hint).toBe("lost");
  });
  it("cada passo do agente aponta para no máximo UMA etapa (índice único do banco) e os nomes/slugs não repetem", () => {
    const hints = ETAPAS_ADVOCACIA.map((e) => e.agent_stage_hint).filter(Boolean);
    expect(new Set(hints).size).toBe(hints.length);
    expect(new Set(ETAPAS_ADVOCACIA.map((e) => e.slug)).size).toBe(ETAPAS_ADVOCACIA.length);
    expect(new Set(ETAPAS_ADVOCACIA.map((e) => e.name)).size).toBe(ETAPAS_ADVOCACIA.length);
  });
  it("a ordem é a do atendimento", () => {
    expect(ETAPAS_ADVOCACIA.map((e) => e.name)).toEqual(["Novo contato", "Em triagem", "Aguardando documentos", "Proposta enviada", "Contrato enviado", "Contrato assinado", "Sem interesse"]);
  });
});
