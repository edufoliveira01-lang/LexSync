import { describe, expect, it } from "vitest";

import { ehEventoDaConversa, MARCA_DE_EVENTO, textoDoEvento } from "@/lib/inbox/evento-na-conversa-marca";

describe("evento na conversa (Fork Sales)", () => {
  it("reconhece a marca e devolve só o texto", () => {
    const corpo = `${MARCA_DE_EVENTO}Ana assumiu a conversa`;
    expect(ehEventoDaConversa(corpo)).toBe(true);
    expect(textoDoEvento(corpo)).toBe("Ana assumiu a conversa");
  });
  it("nota comum não vira evento", () => {
    expect(ehEventoDaConversa("Ligar amanhã")).toBe(false);
    expect(ehEventoDaConversa(null)).toBe(false);
  });
});
