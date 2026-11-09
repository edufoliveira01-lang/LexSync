import { describe, expect, it } from "vitest";

import { frasesDaFerramenta } from "@/lib/inbox/acao-do-agente";

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
