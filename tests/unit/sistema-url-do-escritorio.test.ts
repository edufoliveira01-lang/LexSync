import { describe, expect, it } from "vitest";
import { enderecoDoSistemaDoEscritorio } from "@/lib/sales/sistema-url";

describe("enderecoDoSistemaDoEscritorio", () => {
  it("monta https://<slug>.<domínio do painel sem o primeiro rótulo>", () => {
    expect(enderecoDoSistemaDoEscritorio("https://painel.saleseassociados.com.br/", "marcelo")).toBe("https://marcelo.saleseassociados.com.br");
  });
  it("recusa painel sem subdomínio, URL inválida e slug fora do padrão", () => {
    expect(enderecoDoSistemaDoEscritorio("https://exemplo.com", "a1")).toBeNull();
    expect(enderecoDoSistemaDoEscritorio("nada", "a1")).toBeNull();
    expect(enderecoDoSistemaDoEscritorio("https://painel.x.com.br", "../x")).toBeNull();
  });
});
