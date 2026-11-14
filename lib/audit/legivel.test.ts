import { describe, expect, it } from "vitest";

import { areaDaAcao, descreverAcao, descreverAtor, detalhesDaMetadata } from "./legivel";

describe("descreverAcao", () => {
  it("traduz com o gênero certo", () => {
    expect(descreverAcao("conversation.claimed")).toBe("Conversa assumida");
    expect(descreverAcao("contact.updated")).toBe("Contato alterado");
    expect(descreverAcao("message.sent")).toBe("Mensagem enviada");
    expect(descreverAcao("ai_provider_credentials.updated")).toBe("Chave do provedor de IA alterada");
    expect(descreverAcao("channel.deleted")).toBe("Canal excluído");
  });
  it("usa a área mais específica (followup_flow antes de followup)", () => {
    expect(descreverAcao("followup_flow.created")).toBe("Roteiro de follow-up criado");
    expect(descreverAcao("followup.cancelled")).toBe("Follow-up cancelado");
  });
  it("ação desconhecida nunca fica vazia nem crua", () => {
    expect(descreverAcao("cobranca.plano_trocado")).toBe("Plano e cobrança — plano trocado");
    expect(descreverAcao("algo_novo.feito")).toBe("Algo novo feito");
    expect(descreverAcao("")).toBe("—");
  });
  it("ações soltas (close, transfer) ganham texto legível", () => {
    expect(descreverAcao("close")).toBe("Close");
  });
});

describe("descreverAtor", () => {
  const nomes = new Map([["u1", "Ana Souza"]]);
  const base = { acting_as_platform_admin: false, actor_user_id: null, actor_api_token_id: null };
  it("pessoa pelo nome, sistema, integração e suporte", () => {
    expect(descreverAtor({ ...base, actor_user_id: "u1" }, nomes).nome).toBe("Ana Souza");
    expect(descreverAtor({ ...base, actor_user_id: "u9" }, nomes).tipo).toBe("pessoa");
    expect(descreverAtor(base, nomes)).toEqual({ nome: "Sistema", tipo: "sistema" });
    expect(descreverAtor({ ...base, actor_api_token_id: "t" }, nomes).tipo).toBe("integracao");
    expect(descreverAtor({ ...base, acting_as_platform_admin: true, actor_user_id: "u1" }, nomes).tipo).toBe("plataforma");
  });
});

describe("detalhesDaMetadata", () => {
  it("vira pares legíveis, ignora vazios e corta valor longo", () => {
    const r = detalhesDaMetadata({ agent_id: "abc", vazio: "", nulo: null, texto: "x".repeat(300), obj: { a: 1 } });
    expect(r.map((x) => x.chave)).toEqual(["Agent id", "Texto", "Obj"]);
    expect(r[1]!.valor.endsWith("…")).toBe(true);
    expect(r[2]!.valor).toBe('{"a":1}');
  });
  it("sem metadata: lista vazia", () => {
    expect(detalhesDaMetadata(null)).toEqual([]);
  });
  it("areaDaAcao não confunde prefixos parecidos", () => {
    expect(areaDaAcao("authz.denied")?.prefixo).toBe("authz");
    expect(areaDaAcao("auth.logout")?.prefixo).toBe("auth");
  });
});
