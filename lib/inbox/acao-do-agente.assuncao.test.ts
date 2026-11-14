import { describe, expect, it } from "vitest";

import { fraseDeAssuncaoDoAgente, frasesDaFerramenta } from "./acao-do-agente";

describe("cápsula 'assumiu' da passagem entre agentes", () => {
  it("passagem que deu certo: diz quem passou a atender, com o nome REAL do agente", () => {
    expect(fraseDeAssuncaoDoAgente({ ok: true, agente: "Helena" }, { agente: "helena" })).toBe("Helena (IA) assumiu a conversa");
  });
  it("sem o nome no resultado, usa o que o roteiro escreveu", () => {
    expect(fraseDeAssuncaoDoAgente({ ok: true }, { agente: "Helena" })).toBe("Helena (IA) assumiu a conversa");
  });
  it("passagem que falhou (ok:false) ou sem nome: não anota", () => {
    expect(fraseDeAssuncaoDoAgente({ ok: false, erro: "x" }, { agente: "Helena" })).toBeNull();
    expect(fraseDeAssuncaoDoAgente({ ok: true }, {})).toBeNull();
    expect(fraseDeAssuncaoDoAgente(null, { agente: "Helena" })).toBeNull();
  });
  it("a cápsula 'passou a conversa' continua existindo (as duas aparecem)", () => {
    expect(frasesDaFerramenta("crm_passar_para_agente", { agente: "Helena", funil: "Andamento Jurídico" })).toContain("passou a conversa para o agente «Helena»");
  });
  it("a cápsula nova é lida como ação da IA (rosa), não como pessoa da equipe", () => {
    expect(/autom[aá]tico|\bia\b/.test("Helena (IA) assumiu a conversa".toLowerCase())).toBe(true);
  });
});
