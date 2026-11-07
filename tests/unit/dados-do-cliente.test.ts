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
  it("obrigatórios: nome completo, CPF e endereço; o resto é recomendado", () => {
    const vazio = faltaParaOContrato({});
    expect(vazio.obrigatorios).toEqual(["nome completo (nome e sobrenome)", "CPF", "endereço (rua ou avenida)"]);
    expect(vazio.recomendados).toContain("RG");
    const completo = faltaParaOContrato({ nome: "Ana Maria Souza", cpf: "529.982.247-25", logradouro: "Rua das Flores" });
    expect(completo.obrigatorios).toEqual([]);
    expect(completo.recomendados).toContain("RG");
  });
  it("CPF incompleto não conta", () => {
    expect(faltaParaOContrato({ nome: "Ana Maria Souza", cpf: "529982", logradouro: "Rua A" }).obrigatorios).toEqual(["CPF"]);
  });
});
