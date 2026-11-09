import { describe, expect, it } from "vitest";

import { cpfMascarado, faltaParaOContrato, nomeCompleto } from "@/lib/sales/dados-do-cliente";

describe("dados do cliente — o que falta para o contrato", () => {
  it("no começo da conversa o primeiro nome basta; o contrato exige nome e sobrenome", () => {
    expect(nomeCompleto("Eduardo")).toBe(false);
    expect(nomeCompleto("  Eduardo  ")).toBe(false);
    expect(nomeCompleto("Eduardo Freitas Oliveira")).toBe(true);
    expect(nomeCompleto("Ana M")).toBe(false);
    expect(nomeCompleto(undefined)).toBe(false);
  });
  it("obrigatórios: o que qualifica a pessoa e o endereço completo; e-mail e CEP são recomendados", () => {
    const vazio = faltaParaOContrato({});
    expect(vazio.obrigatorios).toEqual(["nome completo (nome e sobrenome)", "CPF", "RG", "nacionalidade", "estado civil", "profissão", "endereço (rua ou avenida)", "número da casa ou prédio", "bairro", "cidade", "UF"]);
    expect(vazio.recomendados).toEqual(["e-mail", "CEP", "data de nascimento", "nome da mãe"]);
    const completo = faltaParaOContrato({ nome: "Ana Maria Souza", cpf: "529.982.247-25", rg: "1", nacionalidade: "brasileira", estado_civil: "solteira", profissao: "advogada", logradouro: "Rua das Flores", numero: "10", bairro: "Centro", cidade: "Santos", uf: "SP" });
    expect(completo.obrigatorios).toEqual([]);
    expect(completo.recomendados).toEqual(["e-mail", "CEP", "data de nascimento", "nome da mãe"]);
  });
  it("CPF incompleto não conta", () => {
    expect(faltaParaOContrato({ nome: "Ana Maria Souza", cpf: "529982", rg: "1", nacionalidade: "b", estado_civil: "s", profissao: "p", logradouro: "Rua A", numero: "1", bairro: "b", cidade: "c", uf: "SP" }).obrigatorios).toEqual(["CPF"]);
  });
});

describe("CPF: válido e mascarado", () => {
  const base = { nome: "Helena Maria Souza", rg: "1", nacionalidade: "brasileira", estado_civil: "viúva", profissao: "diarista", logradouro: "Rua A", numero: "1", bairro: "B", cidade: "C", uf: "SP" };
  it("CPF com dígitos que não conferem barra o contrato e diz para conferir", () => {
    const f = faltaParaOContrato({ ...base, cpf: "123.456.789-00" });
    expect(f.obrigatorios.join(" ")).toMatch(/CPF válido/);
  });
  it("CPF válido passa", () => {
    expect(faltaParaOContrato({ ...base, cpf: "529.982.247-25" }).obrigatorios).toEqual([]);
  });
  it("máscara mostra só os dois últimos dígitos", () => {
    expect(cpfMascarado("529.982.247-25")).toBe("***.***.***-25");
    expect(cpfMascarado("")).toBe("");
  });
});
