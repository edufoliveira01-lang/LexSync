import { describe, expect, it } from "vitest";

import { arrobaAberta, juntarPartes, MARCA_FAQ, MARCA_LEGENDA, MARCA_REGRAS, separarPartes } from "@/app/app/ai/agents/[id]/_components/EditorDeInstrucoes";

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

describe("legenda automática das ações", () => {
  it("só entra a legenda das ações usadas, entre as Regras e a FAQ", () => {
    const texto = juntarPartes({ roteiro: "Mova. [[Etapa: Em triagem]] Calcule. [[Calcular renda]]", regras: "Regras.", faq: "Pergunta: a?\nResposta: b." });
    expect(texto).toContain(MARCA_LEGENDA);
    expect(texto.indexOf(MARCA_REGRAS)).toBeLessThan(texto.indexOf(MARCA_LEGENDA));
    expect(texto.indexOf(MARCA_LEGENDA)).toBeLessThan(texto.indexOf(MARCA_FAQ));
    expect(texto).toContain("update_lead_state");
    expect(texto).toContain("crm_calcular_renda_per_capita");
    expect(texto).not.toContain("crm_manage_tags"); // etiqueta não foi usada
  });
  it("sem ações no texto, não há legenda; e a legenda não vira parte editável", () => {
    expect(juntarPartes({ roteiro: "texto", regras: "r", faq: "" })).not.toContain(MARCA_LEGENDA);
    const completo = juntarPartes({ roteiro: "x [[Chamar equipe]]", regras: "r", faq: "" });
    expect(separarPartes(completo)).toEqual({ roteiro: "x [[Chamar equipe]]", regras: "r", faq: "" });
  });
});

describe("menu de ações com @ (modo texto)", () => {
  it("abre no @ solto e filtra pelo que vem depois", () => {
    expect(arrobaAberta("Passo 1\n@", 9)).toEqual({ inicio: 8, consulta: "" });
    expect(arrobaAberta("faça isso @eti", 14)).toEqual({ inicio: 10, consulta: "eti" });
  });
  it("não abre em e-mail, nem depois de quebra de linha", () => {
    expect(arrobaAberta("fale com a@b.com", 16)).toBeNull();
    expect(arrobaAberta("@x\nmais", 7)).toBeNull();
  });
});
