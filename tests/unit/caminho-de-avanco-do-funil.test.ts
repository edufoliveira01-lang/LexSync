import { describe, expect, it } from "vitest";

import { caminhoDeAvanco } from "@/lib/agent-engine/agent/lead-state";

describe("caminhoDeAvanco: o agente pode pular para a frente sem ser recusado", () => {
  it("do primeiro contato direto para a triagem passa pelos estágios do meio", () => {
    expect(caminhoDeAvanco("new", "qualifying")).toEqual(["contacted", "qualifying"]);
  });
  it("de triagem a proposta enviada", () => {
    expect(caminhoDeAvanco("qualifying", "negotiating")).toEqual(["qualified", "negotiating"]);
  });
  it("um passo só continua sendo um passo", () => {
    expect(caminhoDeAvanco("contacted", "qualifying")).toEqual(["qualifying"]);
  });
  it("regressão e mesmo estágio são recusados", () => {
    expect(caminhoDeAvanco("negotiating", "qualifying")).toBeNull();
    expect(caminhoDeAvanco("qualifying", "qualifying")).toBeNull();
  });
  it("estágio final não avança e perdido segue a regra original", () => {
    expect(caminhoDeAvanco("won", "negotiating")).toBeNull();
    expect(caminhoDeAvanco("qualifying", "lost")).toEqual(["lost"]);
    expect(caminhoDeAvanco("won", "lost")).toBeNull();
  });
});
