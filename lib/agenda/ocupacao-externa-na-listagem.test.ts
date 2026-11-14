import { describe, expect, it } from "vitest";

import { listagemTrazOcupacaoDoGoogle } from "./ocupacao-externa";

describe("listagemTrazOcupacaoDoGoogle", () => {
  const de = "2026-11-14T00:00:00.000Z";
  const ate = "2026-11-21T00:00:00.000Z";
  it("a grade da agenda (período, sem contato) traz o bloco do Google", () => {
    expect(listagemTrazOcupacaoDoGoogle({ de, ate })).toBe(true);
    expect(listagemTrazOcupacaoDoGoogle({ de, ate, contactId: null })).toBe(true);
  });
  it("filtrando por CONTATO não traz: bloco do Google não é atendimento do cliente", () => {
    expect(listagemTrazOcupacaoDoGoogle({ de, ate, contactId: "c-1" })).toBe(false);
  });
  it("sem período não há grade para desenhar", () => {
    expect(listagemTrazOcupacaoDoGoogle({})).toBe(false);
    expect(listagemTrazOcupacaoDoGoogle({ de })).toBe(false);
  });
});
