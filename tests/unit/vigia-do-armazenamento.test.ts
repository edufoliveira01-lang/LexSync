import { describe, expect, it } from "vitest";

import { GATILHOS, MENSAGEM_PADRAO, renderizarMensagem } from "@/lib/notificacoes-equipe/config";
import { decidirAviso } from "@/lib/sales/vigia-do-armazenamento";

describe("vigia do armazenamento — quando avisar", () => {
  it("problema novo: avisa com o texto e a chave", () => {
    expect(decidirAviso(undefined, { problema: "2 envios falharam", chave: "erro:2:9" })).toEqual({ acao: "avisar", chave: "erro:2:9", texto: "2 envios falharam" });
  });
  it("o mesmo problema já avisado não repete", () => {
    expect(decidirAviso("erro:2:9", { problema: "2 envios falharam", chave: "erro:2:9" })).toEqual({ acao: "nada" });
  });
  it("problema diferente do avisado avisa de novo", () => {
    expect(decidirAviso("erro:2:9", { problema: "3 envios falharam", chave: "erro:3:12" }).acao).toBe("avisar");
  });
  it("problema que sumiu limpa a marca (para avisar de novo se voltar); sem marca não faz nada", () => {
    expect(decidirAviso("erro:2:9", { problema: null, chave: "ok" })).toEqual({ acao: "limpar" });
    expect(decidirAviso(undefined, { problema: null, chave: "ok" })).toEqual({ acao: "nada" });
  });
});

describe("gatilho «armazenamento» da Central de notificações", () => {
  it("existe, tem modelo padrão e o modelo usa o resumo", () => {
    expect(GATILHOS).toContain("armazenamento");
    expect(renderizarMensagem(MENSAGEM_PADRAO.armazenamento, { resumo: "Dropbox desconectado" })).toContain("Dropbox desconectado");
  });
});
