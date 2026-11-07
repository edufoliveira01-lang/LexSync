import { describe, expect, it } from "vitest";

import { funilJuridicoMaisRecente, pedacoDoAgenteJuridico } from "@/lib/sales/modelo-agente-juridico";

const f = (slug: string) => ({ id: `id-${slug}`, slug });

describe("funil jurídico que o agente cuida", () => {
  it("sem recriação, é o de slug exato", () => {
    expect(funilJuridicoMaisRecente([f("vendas"), f("atendimento-juridico")])?.slug).toBe("atendimento-juridico");
  });
  it("funil recriado (slug com número) vale mais que o antigo, de MAIOR número", () => {
    expect(funilJuridicoMaisRecente([f("atendimento-juridico"), f("atendimento-juridico-3"), f("atendimento-juridico-2")])?.slug).toBe("atendimento-juridico-3");
  });
  it("ignora funis de outros assuntos, até os de nome parecido", () => {
    expect(funilJuridicoMaisRecente([f("atendimento-juridico-extra"), f("outro")])).toBeUndefined();
  });
  it("o pedaço do agente liga o funil recriado ao escopo, sem tirar os que já estavam", () => {
    const p = pedacoDoAgenteJuridico({ nomeDoAgente: "Lígia", nomeAtual: "Lígia", funis: [f("atendimento-juridico"), f("atendimento-juridico-2")], pipelinesAtuais: ["id-vendas"] });
    expect(p.pipeline_ids).toEqual(["id-vendas", "id-atendimento-juridico-2"]);
  });
});
