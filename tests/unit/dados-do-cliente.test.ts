import { describe, expect, it } from "vitest";

import { faltaParaOContrato, nomeCompleto } from "@/lib/sales/dados-do-cliente";

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
