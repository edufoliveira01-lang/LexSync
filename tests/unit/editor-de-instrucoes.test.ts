import { describe, expect, it } from "vitest";

import { ACOES, arrobaAberta, blocoDaAcao, juntarPartes, MARCA_FAQ, MARCA_REGRAS, separarPartes } from "@/app/app/ai/agents/[id]/_components/EditorDeInstrucoes";

describe("instruções em três partes", () => {
  it("texto antigo, sem marcas, abre inteiro no Roteiro", () => {
    const p = separarPartes("### 1. Quem você é\nVocê é a Lígia.");
    expect(p.roteiro).toContain("Lígia");
    expect(p.regras).toBe("");
    expect(p.faq).toBe("");
  });
  it("separar e juntar são inversas", () => {
    const original = { roteiro: "Faça A.\nDepois B.", regras: "Nunca prometa resultado.", faq: "Pergunta: quanto custa?\nResposta: só no êxito." };
    const texto = juntarPartes(original);
    expect(texto).toContain(MARCA_REGRAS);
    expect(texto).toContain(MARCA_FAQ);
    expect(separarPartes(texto)).toEqual(original);
  });
  it("parte vazia não deixa marca no texto", () => {
    expect(juntarPartes({ roteiro: "só roteiro", regras: "", faq: "" })).toBe("só roteiro");
  });
});

describe("menu de ações com @", () => {
  it("abre no @ solto e filtra pelo que vem depois", () => {
    expect(arrobaAberta("Passo 1\n@", 9)).toEqual({ inicio: 8, consulta: "" });
    expect(arrobaAberta("faça isso @eti", 14)).toEqual({ inicio: 10, consulta: "eti" });
  });
  it("não abre em e-mail, nem depois de quebra de linha", () => {
    expect(arrobaAberta("fale com a@b.com", 16)).toBeNull();
    expect(arrobaAberta("@x\nmais", 7)).toBeNull();
  });
  it("cada ação vira um bloco que manda executar e não mostrar ao cliente", () => {
    const etapa = ACOES.find((a) => a.id === "etapa")!;
    expect(blocoDaAcao(etapa)).toContain("execute uma única vez");
    expect(blocoDaAcao(etapa)).toContain("nunca mostre isto ao cliente");
    expect(blocoDaAcao(etapa)).toContain("Etapa:");
    expect(new Set(ACOES.map((a) => a.id)).size).toBe(ACOES.length);
  });
});
