import { describe, expect, it } from "vitest";

import { frasesDaFerramenta, frasesDeConsulta } from "@/lib/inbox/acao-do-agente";

describe("anotações internas do chat — o que o agente fez", () => {
  it("dados gravados: lista só os NOMES dos campos, nunca os valores (CPF, RG e endereço não vão para a linha)", () => {
    const frase = frasesDaFerramenta("crm_registrar_dados_do_cliente", { cpf: "52998224725", rg: "123", estado_civil: "solteiro", email: "" });
    expect(frase).toBe("gravou no cadastro: CPF, RG, estado civil");
    expect(frase).not.toMatch(/529|123|solteiro@/);
  });
  it("sem nenhum campo preenchido (só consulta), não anota", () => {
    expect(frasesDaFerramenta("crm_registrar_dados_do_cliente", {})).toBeNull();
    expect(frasesDaFerramenta("crm_registrar_dados_do_cliente", { cpf: undefined, rg: "  " })).toBeNull();
  });
  it("negócio e agenda têm frase própria; o resto não anota", () => {
    expect(frasesDaFerramenta("crm_create_lead", {})).toBe("criou o negócio");
    expect(frasesDaFerramenta("crm_update_lead", {})).toBe("atualizou dados do negócio");
    expect(frasesDaFerramenta("crm_book_appointment", {})).toBe("marcou um compromisso na agenda");
    expect(frasesDaFerramenta("crm_cancel_appointment", {})).toBe("cancelou um compromisso");
    expect(frasesDaFerramenta("crm_get_lead", {})).toBeNull();
    expect(frasesDaFerramenta("crm_add_case_note", {})).toBeNull();
  });
});

import { frasesDaFerramentaNativa } from "@/lib/inbox/acao-do-agente";

describe("anotações internas — ferramentas nativas do motor", () => {
  it("avanço do funil, passagem para a equipe, chamado e observação ganham frase", () => {
    expect(frasesDaFerramentaNativa("update_lead_state", { stage: "negotiating" }, "ok")).toBe("marcou o atendimento como «negociação»");
    expect(frasesDaFerramentaNativa("save_lead_note", { note: "segredo" }, "ok")).toBe("salvou uma observação sobre o cliente");
    expect(frasesDaFerramentaNativa("request_human_handoff", { reason: "cliente pediu um advogado" }, "ok")).toBe("passou a conversa para a equipe — cliente pediu um advogado");
    expect(frasesDaFerramentaNativa("open_human_case", { title: "Liberar acesso" }, "ok")).toBe("abriu um chamado para a equipe: Liberar acesso");
  });
  it("a observação não vaza o texto da nota, e o que não é ação do agente não anota", () => {
    expect(frasesDaFerramentaNativa("save_lead_note", { note: "CPF 52998224725" }, "ok")).not.toMatch(/529/);
    expect(frasesDaFerramentaNativa("send_message", { body: "oi" }, "ok")).toBeNull();
    expect(frasesDaFerramentaNativa("get_lead_context", {}, "ok")).toBeNull();
  });
  it("chamada que falhou ou foi bloqueada vira 'tentou …, mas não foi concluído'", () => {
    expect(frasesDaFerramentaNativa("update_lead_state", { stage: "won" }, "falhou")).toBe("tentou marcar o atendimento como «ganho», mas não foi concluído");
    expect(frasesDaFerramentaNativa("request_human_handoff", { reason: "x" }, "bloqueada")).toMatch(/^tentou passar a conversa para a equipe/);
  });
});

describe("frasesDeConsulta: a equipe vê que a resposta veio da base", () => {
  it("ficha consultada: título, data e fontes, com ressalva quando pendente", () => {
    const f = frasesDeConsulta("crm_consultar_base_juridica", { ok: true, cobertura: true, ficha: { titulo: "BPC/LOAS", revisado_em: "2026-11-09", fontes: [{ url: "https://www.planalto.gov.br/x" }] }, aviso: ["sem conferência"] });
    expect(f).toContain("BPC/LOAS");
    expect(f).toContain("planalto.gov.br");
    expect(f).toContain("com ressalva");
  });
  it("tema fora da base", () => {
    expect(frasesDeConsulta("crm_consultar_base_juridica", { ok: true, cobertura: false })).toContain("não está na base");
  });
  it("renda per capita", () => {
    const f = frasesDeConsulta("crm_calcular_renda_per_capita", { renda_per_capita: 550, limite_um_quarto: 405.25, limite_meio: 810.5, salario_minimo: 1621, salario_minimo_confirmado: true });
    expect(f).toContain("550,00");
    expect(f).toContain("405,25");
  });
  it("outras ferramentas não anotam", () => {
    expect(frasesDeConsulta("crm_get_contact", {})).toBeNull();
  });
});
