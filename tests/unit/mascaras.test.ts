import { describe, expect, it } from "vitest";

import { aplicarMascara, formatoPadraoDoContrato, mascaraPersonalizada, padraoDaMascara, validarComMascara } from "@/lib/campos/mascaras";

describe("aplicarMascara", () => {
  it("CPF, CEP, CNPJ, data e processo, digitados com ou sem formato", () => {
    expect(aplicarMascara("22518854800", "cpf")).toBe("225.188.548-00");
    expect(aplicarMascara("225.188.548-00", "cpf")).toBe("225.188.548-00");
    expect(aplicarMascara("11705000", "cep")).toBe("11705-000");
    expect(aplicarMascara("11705-000", "cep")).toBe("11705-000");
    expect(aplicarMascara("12345678000199", "cnpj")).toBe("12.345.678/0001-99");
    expect(aplicarMascara("14011994", "data")).toBe("14/01/1994");
    expect(aplicarMascara("00012345620268260100", "cnj")).toBe("0001234-56.2026.8.26.0100");
  });
  it("enquanto digita, não sobra literal pendurado", () => {
    expect(aplicarMascara("225", "cpf")).toBe("225");
    expect(aplicarMascara("2251", "cpf")).toBe("225.1");
    expect(aplicarMascara("1170", "cep")).toBe("1170");
    expect(aplicarMascara("11705", "cep")).toBe("11705");
    expect(aplicarMascara("117050", "cep")).toBe("11705-0");
  });
  it("letras são descartadas em máscara numérica e o excesso é cortado", () => {
    expect(aplicarMascara("abc225x188", "cpf")).toBe("225.188");
    expect(aplicarMascara("225188548009999", "cpf")).toBe("225.188.548-00");
  });
  it("telefone aceita 10 ou 11 dígitos", () => {
    expect(aplicarMascara("13988193611", "telefone")).toBe("(13) 98819-3611");
    expect(aplicarMascara("1338782730", "telefone")).toBe("(13) 3878-2730");
    expect(aplicarMascara("13", "telefone")).toBe("(13");
  });
  it("máscara personalizada: 0 dígito, A letra, * qualquer", () => {
    const m = mascaraPersonalizada("AA-0000");
    expect(padraoDaMascara(m)).toBe("AA-0000");
    expect(aplicarMascara("sp1234", m)).toBe("SP-1234");
    expect(aplicarMascara("sp12", m)).toBe("SP-12");
  });
  it("sem máscara devolve o valor como veio", () => {
    expect(aplicarMascara("qualquer coisa", undefined)).toBe("qualquer coisa");
    expect(aplicarMascara(null, "cpf")).toBe("");
  });
});

describe("validarComMascara", () => {
  it("CPF confere os dígitos; CEP exige 8 números; vazio e sem máscara passam", () => {
    expect(validarComMascara("529.982.247-25", "cpf")).toBeNull();
    expect(validarComMascara("123.456.789-00", "cpf")).toMatch(/inválido/);
    expect(validarComMascara("11705-000", "cep")).toBeNull();
    expect(validarComMascara("1170", "cep")).toMatch(/incompleto/);
    expect(validarComMascara("", "cpf")).toBeNull();
    expect(validarComMascara("x", undefined)).toBeNull();
  });
  it("data existente e inexistente", () => {
    expect(validarComMascara("14/01/1994", "data")).toBeNull();
    expect(validarComMascara("31/02/1994", "data")).toMatch(/inexistente/);
  });
});

describe("formato padrão do contrato (com ou sem máscara no campo)", () => {
  it("CPF, CEP e telefone saem no formato de sempre", () => {
    expect(formatoPadraoDoContrato("cpf", "22518854800")).toBe("225.188.548-00");
    expect(formatoPadraoDoContrato("cep", "11705000")).toBe("11705-000");
    expect(formatoPadraoDoContrato("telefone", "13988193611")).toBe("(13) 98819-3611");
  });
  it("valor que não tem o tamanho certo não é inventado", () => {
    expect(formatoPadraoDoContrato("cpf", "123")).toBe("123");
    expect(formatoPadraoDoContrato("cep", "")).toBe("");
  });
});
