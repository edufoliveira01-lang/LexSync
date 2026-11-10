// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { ACOES, deSegmentos, legendaDasAcoes, linhaDaAcao, paraSegmentos, rotuloDaAcao, tiposUsados } from "@/app/app/ai/agents/[id]/_components/chips-do-roteiro";
import { atualizarAvisos, desenharNoEditor, serializarEditor } from "@/app/app/ai/agents/[id]/_components/EditorComChips";

describe("ação curta [[…]]", () => {
  it("separa texto e ações, e junta de volta igual", () => {
    const texto = "Faça A. [[Etapa: FUNIL JUS › Triagem]] Depois B. [[Etiqueta: NOVA DEMANDA]] Fim.";
    const segs = paraSegmentos(texto);
    expect(segs.map((s) => (s.t === "texto" ? "t" : "a"))).toEqual(["t", "a", "t", "a", "t"]);
    expect(deSegmentos(segs)).toBe(texto);
  });
  it("ainda lê o bloco longo antigo e o devolve no formato curto", () => {
    const antigo = "A.\n⚙ AÇÃO — execute uma única vez; nunca mostre isto ao cliente:\nEtapa: Em triagem\nB.";
    expect(deSegmentos(paraSegmentos(antigo))).toBe("A.[[Etapa: Em triagem]]B.");
  });
  it("a linha de cada ação sai curta e com o que foi escolhido", () => {
    expect(linhaDaAcao("etapa", "FUNIL JUS › Já é Cliente")).toBe("Etapa: FUNIL JUS › Já é Cliente");
    expect(linhaDaAcao("chamar_equipe")).toBe("Chamar equipe");
    expect(linhaDaAcao("mensagem", "Olá!")).toBe("Mensagem: “Olá!”");
    expect(linhaDaAcao("renda")).toBe("Calcular renda");
  });
});

describe("cada tipo tem a sua cor", () => {
  it("rótulo, ícone e cor por tipo; etapa e etiqueta são cores diferentes", () => {
    const etapa = rotuloDaAcao("Etapa: Novo contato");
    const etiqueta = rotuloDaAcao("Etiqueta: NOVA DEMANDA");
    const remover = rotuloDaAcao("Remover etiqueta: X");
    expect(etapa.tipo).toBe("etapa");
    expect(etiqueta.tipo).toBe("etiqueta_add");
    expect(remover.tipo).toBe("etiqueta_rem");
    expect(new Set([etapa.cor, etiqueta.cor, remover.cor]).size).toBe(3);
    expect(rotuloDaAcao("Calcular renda").texto).toBe("Calcular renda");
    expect(rotuloDaAcao("Mensagem: “Olá!”").texto).toBe("Mensagem: Olá!");
  });
  it("o registro cobre as ferramentas do roteiro (renda, consultas, agenda) e não repete tipo", () => {
    const tipos = ACOES.map((a) => a.tipo);
    expect(new Set(tipos).size).toBe(tipos.length);
    for (const t of ["renda", "base", "cliente", "andamento", "compromissos", "documentos", "financeiro", "horarios", "marcar", "remarcar", "cancelar", "etiqueta_add", "responsavel"]) expect(tipos).toContain(t);
  });
});

describe("legenda", () => {
  it("só das ações usadas, e vazia sem ações", () => {
    expect(tiposUsados("[[Calcular renda]] e [[Chamar equipe]] e [[Calcular renda]]")).toEqual(["chamar_equipe", "renda"]);
    expect(legendaDasAcoes("sem ação")).toBe("");
    expect(legendaDasAcoes("[[Calcular renda]]")).toContain("crm_calcular_renda_per_capita");
  });
});

describe("o editor formatado (DOM)", () => {
  const ida = (texto: string) => { const r = document.createElement("div"); desenharNoEditor(r, texto, true); return r; };
  it("texto, negrito, itálico, itens e ações dão a volta completa", () => {
    const texto = "**1. Receber a pessoa**\nCumprimente de forma *natural*. [[Etapa: Novo contato]]\n\n- primeiro item\n- segundo item\nFim.";
    const r = ida(texto);
    expect(r.querySelectorAll("b")).toHaveLength(1);
    expect(r.querySelectorAll("i")).toHaveLength(1);
    expect(r.querySelectorAll("li")).toHaveLength(2);
    expect(r.querySelectorAll("[data-acao]")).toHaveLength(1);
    expect(serializarEditor(r)).toBe(texto);
  });
  it("asteriscos soltos, como o CPF mascarado, não viram formatação", () => {
    const texto = "Mostre o CPF assim: ***.***.***-00 e pronto.";
    const r = ida(texto);
    expect(r.querySelectorAll("i,b")).toHaveLength(0);
    expect(serializarEditor(r)).toBe(texto);
  });
  it("tirar uma etiqueta tira a ação do texto", () => {
    const r = ida("A [[Etiqueta: X]] B");
    r.querySelector("[data-acao]")!.remove();
    expect(serializarEditor(r)).toBe("A  B");
  });
  it("o aviso de ferramenta desligada aparece e some na etiqueta", () => {
    const r = ida("[[Etiqueta: X]]");
    atualizarAvisos(r, () => "Falta ligar crm_manage_tags");
    expect(r.querySelector("[data-acao]")!.getAttribute("title")).toContain("crm_manage_tags");
    atualizarAvisos(r, () => null);
    expect(r.querySelector("[data-acao]")!.hasAttribute("title")).toBe(false);
  });
  it("sem permissão de editar, a etiqueta não leva o ×", () => {
    const r = document.createElement("div");
    desenharNoEditor(r, "[[Etiqueta: X]]", false);
    expect(r.querySelector("[data-remover]")).toBeNull();
  });
});
