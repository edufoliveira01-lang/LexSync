import { describe, expect, it, vi } from "vitest";

import { consultarCep, cepSoDigitos } from "@/lib/sales/consulta-cep";

const resp = (ok: boolean, body: unknown) => ({ ok, json: async () => body });

describe("consultarCep", () => {
  it("usa a BrasilAPI e normaliza", async () => {
    const busca = vi.fn(async () => resp(true, { street: "Rua das Acácias", neighborhood: "Vila Mirim", city: "Praia Grande", state: "sp" }));
    expect(await consultarCep("11705-000", busca)).toEqual({ cep: "11705000", logradouro: "Rua das Acácias", bairro: "Vila Mirim", cidade: "Praia Grande", uf: "SP" });
    expect(busca.mock.calls[0]![0]).toContain("brasilapi.com.br/api/cep/v2/11705000");
  });
  it("cai para o ViaCEP quando a BrasilAPI falha", async () => {
    const busca = vi.fn(async (url: string) => (url.includes("brasilapi") ? resp(false, {}) : resp(true, { logradouro: "Rua A", bairro: "B", localidade: "C", uf: "SP" })));
    expect((await consultarCep("11705000", busca))?.cidade).toBe("C");
  });
  it("nunca lança: sem resposta, devolve null", async () => {
    const busca = vi.fn(async () => { throw new Error("rede"); });
    expect(await consultarCep("11705000", busca)).toBeNull();
  });
  it("CEP inválido nem consulta", async () => {
    const busca = vi.fn();
    expect(await consultarCep("123", busca)).toBeNull();
    expect(busca).not.toHaveBeenCalled();
    expect(cepSoDigitos("11705-000")).toBe("11705000");
  });
});
