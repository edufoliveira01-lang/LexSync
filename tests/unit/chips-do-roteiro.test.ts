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

import { fragmentoDoTexto, textoDaSelecao } from "@/app/app/ai/agents/[id]/_components/EditorComChips";

describe("copiar e colar o roteiro com as ações", () => {
  const tela = (texto: string) => { const r = document.createElement("div"); document.body.appendChild(r); desenharNoEditor(r, texto, true); return r; };

  it("copiar devolve o texto gravado, com as ações como [[…]] (não o texto visível da etiqueta)", () => {
    const texto = "Passo 1. [[Etapa: FUNIL JUS › Triagem]] Depois **importante** e:\n- item [[Etiqueta: NOVA DEMANDA]]\n- outro";
    const r = tela(texto);
    const range = document.createRange();
    range.selectNodeContents(r);
    expect(textoDaSelecao(range)).toBe(texto);
  });

  it("colar transforma o texto gravado de volta em etiquetas, negrito e itens", () => {
    const texto = "Faça A. [[Etapa: FUNIL JUS › Triagem]] Fim **forte**\n- um\n- dois [[Chamar equipe]]";
    const caixa = document.createElement("div");
    caixa.appendChild(fragmentoDoTexto(document, texto, true));
    expect(caixa.querySelectorAll("[data-acao]")).toHaveLength(2);
    expect(caixa.querySelectorAll("b")).toHaveLength(1);
    expect(caixa.querySelectorAll("li")).toHaveLength(2);
    expect(serializarEditor(caixa)).toBe(texto);
  });

  it("uma linha só entra no meio da frase, sem criar linha nova", () => {
    const frag = fragmentoDoTexto(document, "[[Chamar equipe]]", true);
    expect(Array.from(frag.childNodes).some((n) => (n as HTMLElement).tagName === "DIV")).toBe(false);
    expect((frag as DocumentFragment).querySelector("[data-acao]")?.getAttribute("data-linha")).toBe("Chamar equipe");
  });

  it("copiar de um trecho no meio também leva as ações daquele trecho", () => {
    const r = tela("Antes [[Etapa: A › B]] depois");
    const range = document.createRange();
    range.setStart(r.firstChild!.firstChild!, 0);
    range.setEnd(r.lastChild!.lastChild!, (r.lastChild!.lastChild!.textContent ?? "").length);
    expect(textoDaSelecao(range)).toContain("[[Etapa: A › B]]");
  });
});
