import { describe, expect, it } from "vitest";

import { acoesDoTexto, arrobaAberta, blocoDaAcao, juntarPartes, MARCA_FAQ, MARCA_REGRAS, separarPartes, tirarAcao } from "@/app/app/ai/agents/[id]/_components/EditorDeInstrucoes";

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
  it("cada ação vira um bloco com o que foi escolhido, que manda executar e não mostrar ao cliente", () => {
    const b = blocoDaAcao("etapa", "FUNIL JUS › Já é Cliente do Escritório");
    expect(b).toContain("execute uma única vez");
    expect(b).toContain("nunca mostre isto ao cliente");
    expect(b).toContain("Etapa: FUNIL JUS › Já é Cliente do Escritório");
    expect(blocoDaAcao("etiqueta_add", "NOVA DEMANDA")).toContain("Etiqueta: NOVA DEMANDA");
    expect(blocoDaAcao("responsavel", "Ana Carolina")).toContain("Responsável: Ana Carolina");
  });
  it("as ações do texto aparecem como lista e podem ser tiradas", () => {
    const texto = "Passo 1.\n" + blocoDaAcao("etiqueta_add", "NOVA DEMANDA") + "\nPasso 2.\n" + blocoDaAcao("etapa", "FUNIL JUS › Triagem") + "\nFim.";
    const a = acoesDoTexto(texto);
    expect(a.map((x) => x.linha)).toEqual(["Etiqueta: NOVA DEMANDA", "Etapa: FUNIL JUS › Triagem"]);
    const sem = tirarAcao(texto, a[0]!);
    expect(acoesDoTexto(sem).map((x) => x.linha)).toEqual(["Etapa: FUNIL JUS › Triagem"]);
    expect(sem).toContain("Passo 1.");
    expect(sem).toContain("Passo 2.");
    expect(sem).not.toContain("NOVA DEMANDA");
  });
});
