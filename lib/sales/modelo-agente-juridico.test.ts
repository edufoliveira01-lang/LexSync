import { describe, expect, it } from "vitest";

import { FERRAMENTAS_DO_AGENTE_JURIDICO, pedacoDoAgenteJuridico } from "./modelo-agente-juridico";
import { chaveDoServidorMcp, enderecoDoServidorMcp, FERRAMENTAS_DO_SALES } from "./mcp";
import { TETO_TOOLS_POR_AGENTE } from "@/lib/mcp/tools/selecao-por-pacote";

describe("agente jurídico: o que o botão configura", () => {
  it("cabe no teto de ferramentas por agente e não repete ferramenta", () => {
    expect(FERRAMENTAS_DO_AGENTE_JURIDICO.length).toBeLessThanOrEqual(TETO_TOOLS_POR_AGENTE);
    expect(new Set(FERRAMENTAS_DO_AGENTE_JURIDICO).size).toBe(FERRAMENTAS_DO_AGENTE_JURIDICO.length);
  });
  it("o agente não marca atendimento novo (só a equipe), mas remarca, desmarca e anota no Sales", () => {
    expect(FERRAMENTAS_DO_AGENTE_JURIDICO).not.toContain("crm_book_appointment");
    for (const t of ["crm_reschedule_appointment", "crm_cancel_appointment", "crm_anotar_no_sales", "crm_passar_para_agente", "crm_notificar_equipe"]) expect(FERRAMENTAS_DO_AGENTE_JURIDICO).toContain(t);
  });
  it("liga a passagem para humano, desliga a de 'questão jurídica' e usa mensagens curtas", () => {
    const p = pedacoDoAgenteJuridico({ nomeDoAgente: "Sofia", nomeAtual: "", funis: [], pipelinesAtuais: [] });
    expect(p).toMatchObject({ name: "Sofia", handoff_tool_enabled: true, handoff_legal_enabled: false, split_messages: true, image_vision_enabled: true });
    expect(p.tool_ids).toContain("crm_move_lead_stage");
    expect(p.tool_ids).toContain("crm_request_human_handoff");
  });
  it("não troca um nome já digitado e usa um nome padrão quando o Sales não tem nome do agente", () => {
    expect(pedacoDoAgenteJuridico({ nomeDoAgente: "Sofia", nomeAtual: "Meu agente", funis: [], pipelinesAtuais: [] }).name).toBeUndefined();
    expect(pedacoDoAgenteJuridico({ nomeDoAgente: "", nomeAtual: "", funis: [], pipelinesAtuais: [] }).name).toBe("Atendimento jurídico");
  });
  it("com as consultas do Sales ligadas, entram como ferramentas remotas de LEITURA, e cabe no teto", () => {
    const p = pedacoDoAgenteJuridico({ nomeDoAgente: "", nomeAtual: "x", funis: [], pipelinesAtuais: [], ferramentasRemotas: FERRAMENTAS_DO_SALES });
    expect(p.tool_ids).toContain("mcp_externo:leitura:consultar_cliente");
    expect(p.tool_ids).toContain("mcp_externo:leitura:proximos_compromissos");
    expect(p.tool_ids.length).toBeLessThanOrEqual(TETO_TOOLS_POR_AGENTE);
    expect(pedacoDoAgenteJuridico({ nomeDoAgente: "", nomeAtual: "x", funis: [], pipelinesAtuais: [] }).tool_ids.some((t) => t.startsWith("mcp_externo:"))).toBe(false);
  });
  it("a chave e o endereço do servidor de ferramentas são calculados dos segredos que já existem (sem copiar nada à mão)", () => {
    expect(enderecoDoServidorMcp("https://painel.exemplo/", "alfa")).toBe("https://painel.exemplo/mcp/alfa");
    expect(chaveDoServidorMcp("s".repeat(40), "alfa")).toMatch(/^[0-9a-f]{64}$/);
    expect(chaveDoServidorMcp("s".repeat(40), "alfa")).not.toBe(chaveDoServidorMcp("s".repeat(40), "beta"));
  });
  it("inclui o funil «Atendimento jurídico» sem perder os que já estavam marcados", () => {
    const funis = [{ id: "p1", slug: "pedidos" }, { id: "p2", slug: "atendimento-juridico" }];
    expect(pedacoDoAgenteJuridico({ nomeDoAgente: "", nomeAtual: "x", funis, pipelinesAtuais: ["p1"] }).pipeline_ids).toEqual(["p1", "p2"]);
    expect(pedacoDoAgenteJuridico({ nomeDoAgente: "", nomeAtual: "x", funis: [funis[0]!], pipelinesAtuais: [] }).pipeline_ids).toBeUndefined();
  });
});
