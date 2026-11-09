import { describe, expect, it } from "vitest";

import { SECOES, ehSecaoValida, secaoDoCampo, secaoInicial } from "@/app/app/ai/agents/[id]/_components/SecoesDoAgente";

describe("seções da tela do agente", () => {
  it("as nove seções existem, com id único e rótulo", () => {
    expect(SECOES.map((s) => s.id)).toEqual(["identidade", "instrucoes", "capacidades", "conhecimento", "canais", "equipe", "retornos", "modelo", "avancado"]);
    expect(new Set(SECOES.map((s) => s.id)).size).toBe(SECOES.length);
    for (const s of SECOES) expect(s.rotulo.length).toBeGreaterThan(2);
  });
  it("o endereço (#capacidades) abre a seção; lixo cai na primeira ou na que tem erro", () => {
    expect(secaoInicial("#capacidades", null)).toBe("capacidades");
    expect(secaoInicial("#nada", null)).toBe("identidade");
    expect(secaoInicial("", "modelo")).toBe("modelo");
    expect(ehSecaoValida("equipe")).toBe(true);
    expect(ehSecaoValida("x")).toBe(false);
  });
  it("cada campo com validação aponta para a seção certa", () => {
    expect(secaoDoCampo("name")).toBe("identidade");
    expect(secaoDoCampo("system_prompt")).toBe("instrucoes");
    expect(secaoDoCampo("tool_ids")).toBe("capacidades");
    expect(secaoDoCampo("credential_id")).toBe("modelo");
    expect(secaoDoCampo("model")).toBe("modelo");
  });
});
