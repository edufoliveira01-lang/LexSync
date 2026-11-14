import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Duas irmãs com a MESMA `key` no mesmo bloco fazem o React duplicar/deixar de remover elementos ao trocar de conversa: o cabeçalho
 * da conversa anterior ficava empilhado em cima do novo. A faixa de pendências do Sales usava o id puro, igual ao cabeçalho.
 */
describe("InboxLayout — keys do painel da conversa", () => {
  const fonte = readFileSync("components/inbox/InboxLayout.tsx", "utf8");
  it("a faixa de pendências não repete a key do cabeçalho", () => {
    expect(fonte).toMatch(/<PendenciasDoSales key=\{`pendencias:\$\{selectedConversation\.id\}`\}/);
    expect(fonte).not.toMatch(/<PendenciasDoSales key=\{selectedConversation\.id\}/);
  });
  it("nenhuma key de irmã é o id puro além do cabeçalho", () => {
    const puras = fonte.match(/key=\{selectedConversation\.id\}/g) ?? [];
    expect(puras.length).toBe(1);
  });
});
