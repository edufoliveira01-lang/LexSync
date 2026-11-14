import { describe, expect, it } from "vitest";

import { ACOES, defDaAcao, ferramentaLigada, rotuloDaFerramenta } from "./chips-do-roteiro";

const COMPARTILHADO = "mcp_externo:leitura:consultar_cliente";
const DO_AGENTE = "mcp_externo:11111111-1111-4111-8111-111111111111:leitura:consultar_cliente";

describe("ações de consulta do roteiro avisam quando a ferramenta está desligada", () => {
  it.each([
    ["cliente", "consultar_cliente"],
    ["andamento", "andamento_do_processo"],
    ["compromissos", "proximos_compromissos"],
    ["documentos", "documentos_do_cliente"],
    ["financeiro", "financeiro_do_cliente"],
  ] as const)("a ação %s declara a ferramenta %s", (tipo, nome) => {
    expect(defDaAcao(tipo).ferramentas).toEqual([`mcp_externo:leitura:${nome}`]);
  });

  it("nenhuma ação de consulta ficou sem ferramenta declarada (era o buraco: nunca avisava)", () => {
    for (const a of ACOES.filter((x) => x.grupo === "Consultas" && x.tipo !== "base" && x.tipo !== "renda")) {
      expect(a.ferramentas.length, a.tipo).toBeGreaterThan(0);
    }
  });

  it("desligada: a ferramenta não está entre as ligadas", () => {
    expect(ferramentaLigada(COMPARTILHADO, ["crm_get_contact"])).toBe(false);
  });

  it("ligada pelo servidor compartilhado ou pelo servidor do agente: a ação vale nos dois", () => {
    expect(ferramentaLigada(COMPARTILHADO, [COMPARTILHADO])).toBe(true);
    expect(ferramentaLigada(COMPARTILHADO, [DO_AGENTE])).toBe(true);
  });

  it("outra consulta do mesmo servidor não cobre esta", () => {
    expect(ferramentaLigada(COMPARTILHADO, ["mcp_externo:leitura:andamento_do_processo"])).toBe(false);
  });

  it("ferramenta nativa continua valendo pelo id exato", () => {
    expect(ferramentaLigada("crm_move_lead_stage", ["crm_move_lead_stage"])).toBe(true);
    expect(ferramentaLigada("crm_move_lead_stage", ["crm_manage_tags"])).toBe(false);
  });

  it("o aviso usa o nome de gente, não o id técnico", () => {
    expect(rotuloDaFerramenta(COMPARTILHADO)).toBe("Consultar o cadastro do cliente (consultas do Sales)");
    expect(rotuloDaFerramenta("crm_move_lead_stage")).toBe("crm_move_lead_stage");
  });
});
