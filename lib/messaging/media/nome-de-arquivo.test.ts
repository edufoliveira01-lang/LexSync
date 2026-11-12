import { describe, expect, it } from "vitest";

import { nomeDeArquivoSeguro } from "./upload-validation";

describe("nomeDeArquivoSeguro", () => {
  it("tira acento, espaço e símbolo e refaz a extensão", () => {
    expect(nomeDeArquivoSeguro("Boleto – João da Silva (Parcela 1/3).pdf", "pdf")).toBe("Boleto-Joao-da-Silva-Parcela-1-3.pdf");
  });
  it("não deixa escapar de pasta nem montar nome vazio", () => {
    expect(nomeDeArquivoSeguro("../../x/y.pdf", "pdf")).toBe("x-y.pdf");
    expect(nomeDeArquivoSeguro("///", "pdf")).toBeNull();
    expect(nomeDeArquivoSeguro(undefined, "pdf")).toBeNull();
  });
});
