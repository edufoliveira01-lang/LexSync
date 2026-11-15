import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { nomeOriginalDaMensagem } from "@/lib/messaging/media/nome-de-arquivo";

/**
 * O boleto saía para o cliente com o nome da CHAVE do storage ("1731700000000-Boleto-Parcela-1-3-venc-…pdf"). Agora o nome que o cliente vê vem de
 * `metadata.media_filename`, e a chave do storage continua só uma chave segura.
 */
describe("documento enviado com nome bonito", () => {
  it("o nome em metadata.media_filename é o que o canal recebe; sem ele, vale o último trecho do caminho", () => {
    const envio = readFileSync("app/api/v1/messages/_handler.ts", "utf8");
    expect(envio).toMatch(/nomeOriginalDaMensagem\(input\.metadata\) \?\? input\.media_storage_path\.split\("\/"\)\.pop\(\)/);
    expect(nomeOriginalDaMensagem({ media_filename: "Boleto - Honorários 1-3 - R$ 10,00 - venc 15-11-2026.pdf" })).toBe("Boleto - Honorários 1-3 - R$ 10,00 - venc 15-11-2026.pdf");
    expect(nomeOriginalDaMensagem({})).toBeNull();
  });
  it("o envio do boleto grava o nome bonito na metadata (e a chave do storage segue ASCII)", () => {
    const fonte = readFileSync("lib/sales/acompanhar-contratos.ts", "utf8");
    expect(fonte).toMatch(/metadata: \{ media_filename: nomeDoArquivo\.endsWith\("\.pdf"\)/);
    expect(fonte).toMatch(/replace\(\/\[\^A-Za-z0-9\._-\]\+\/g, "-"\)/);
  });
});
