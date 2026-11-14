import { describe, expect, it } from "vitest";

import { frasesDeConsulta } from "./acao-do-agente";

describe("consultas do Sales viram evento no chat", () => {
  it("telefone fora do cadastro: diz que ninguém foi localizado", () => {
    expect(frasesDeConsulta("consultar_cliente", { texto: "Este telefone não está no cadastro", dados: { encontrado: false } })).toBe(
      "consultou o cadastro do cliente: nenhum cliente localizado pelo telefone da conversa",
    );
  });

  it("cliente localizado: conta os processos, sem nome nem número", () => {
    const frase = frasesDeConsulta("consultar_cliente", { texto: "Cliente: Maria", dados: { encontrado: true, cliente: { nome: "Maria" }, processos: [{ numero: "1" }, { numero: "2" }] } });
    expect(frase).toBe("consultou o cadastro do cliente: cliente localizado (2 processos)");
    expect(frase).not.toContain("Maria");
  });

  it("um processo só usa o singular", () => {
    expect(frasesDeConsulta("consultar_cliente", { dados: { encontrado: true, processos: [{}] } })).toBe("consultou o cadastro do cliente: cliente localizado (1 processo)");
  });

  it("mais de um cadastro com o telefone: avisa que a identidade precisa ser confirmada", () => {
    expect(frasesDeConsulta("andamento_do_processo", { dados: { encontrado: true, ambiguo: true } })).toContain("mais de um cadastro");
  });

  it.each([
    ["andamento_do_processo", "consultou o andamento do processo"],
    ["proximos_compromissos", "consultou os próximos compromissos do cliente"],
    ["financeiro_do_cliente", "consultou o financeiro do cliente"],
    ["documentos_do_cliente", "consultou os documentos do cliente"],
  ])("%s anota só o que foi consultado", (nome, esperado) => {
    expect(frasesDeConsulta(nome, { texto: "...", dados: { encontrado: true } })).toBe(esperado);
  });

  it("funciona com o nome com prefixo do servidor do agente", () => {
    expect(frasesDeConsulta("sales__consultar_cliente", { dados: { encontrado: false } })).toContain("nenhum cliente localizado");
  });

  it("resultado sem `dados` não derruba: anota a consulta", () => {
    expect(frasesDeConsulta("financeiro_do_cliente", { texto: "ok" })).toBe("consultou o financeiro do cliente");
  });

  it("ferramenta que não é consulta conhecida segue sem anotar", () => {
    expect(frasesDeConsulta("crm_list_pipelines", { dados: {} })).toBeNull();
  });
});
