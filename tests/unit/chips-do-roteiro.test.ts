// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { CABECALHO_DA_ACAO, deSegmentos, paraSegmentos, rotuloDaAcao } from "@/app/app/ai/agents/[id]/_components/chips-do-roteiro";
import { desenharNoEditor, serializarEditor } from "@/app/app/ai/agents/[id]/_components/EditorComChips";

const bloco = (l: string) => `\n${CABECALHO_DA_ACAO}\n${l}\n`;

describe("texto gravado ⇄ pedaços", () => {
  it("separa texto e ações, e junta de volta igual", () => {
    const texto = "Faça A." + bloco("Etapa: FUNIL JUS › Triagem") + "Depois B." + bloco("Etiqueta: NOVA DEMANDA") + "Fim.";
    const segs = paraSegmentos(texto);
    expect(segs.map((s) => (s.t === "texto" ? "t" : "a"))).toEqual(["t", "a", "t", "a", "t"]);
    expect(deSegmentos(segs)).toBe(texto);
  });
  it("texto sem ações é um pedaço só", () => {
    expect(paraSegmentos("só texto")).toEqual([{ t: "texto", v: "só texto" }]);
  });
  it("cada tipo de linha vira um rótulo curto", () => {
    expect(rotuloDaAcao("Etapa: FUNIL JUS › Já é Cliente").texto).toBe("Etapa: FUNIL JUS › Já é Cliente");
    expect(rotuloDaAcao("Etiqueta: ⚠ SEM RETORNO").tipo).toBe("etiqueta_add");
    expect(rotuloDaAcao("Remover etiqueta: NOVA DEMANDA").tipo).toBe("etiqueta_rem");
    expect(rotuloDaAcao("Envie ao cliente, exatamente assim: “Olá!”").texto).toBe("Mensagem: Olá!");
    expect(rotuloDaAcao("Passe a conversa para a equipe, com um resumo curto.").texto).toBe("Chamar a equipe");
    expect(rotuloDaAcao("Consulte a base jurídica sobre BPC/LOAS e responda com base na ficha.").texto).toBe("Base jurídica: BPC/LOAS");
  });
});

describe("o editor com etiquetas (DOM)", () => {
  it("desenha as ações como etiquetas e lê de volta o mesmo texto", () => {
    const raiz = document.createElement("div");
    const texto = "Passo 1." + bloco("Etapa: FUNIL JUS › Triagem") + "Passo 2.";
    desenharNoEditor(raiz, texto, true);
    const chips = raiz.querySelectorAll("[data-acao]");
    expect(chips).toHaveLength(1);
    expect(chips[0]!.textContent).toContain("Etapa: FUNIL JUS › Triagem");
    expect(chips[0]!.getAttribute("contenteditable")).toBe("false");
    expect(serializarEditor(raiz)).toBe(texto);
  });
  it("tirar uma etiqueta tira o bloco do texto", () => {
    const raiz = document.createElement("div");
    desenharNoEditor(raiz, "A." + bloco("Etiqueta: X") + "B.", true);
    raiz.querySelector("[data-acao]")!.remove();
    expect(serializarEditor(raiz)).toBe("A.B.");
  });
  it("sem permissão de editar, a etiqueta não leva o ×", () => {
    const raiz = document.createElement("div");
    desenharNoEditor(raiz, bloco("Etiqueta: X"), false);
    expect(raiz.querySelector("[data-remover]")).toBeNull();
  });
});
