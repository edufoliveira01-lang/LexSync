import { describe, expect, it, vi } from "vitest";

import { atualizarFicha, decidirAtualizacao, evidenciaConfere, extrairJson, impressaoDasFontes, rodadaDevida, textoDaPagina, urlOficial } from "@/lib/sales/base-juridica/atualizar";
import { FICHAS } from "@/lib/sales/base-juridica/fichas";

const ficha = FICHAS[0]!;
const L1 = "https://www.planalto.gov.br/ccivil_03/leis/l8742.htm";
const L2 = "https://www.gov.br/inss/pt-br/direitos-e-deveres/beneficios-assistenciais";
const T1 = "Art. 20-B. O recurso administrativo deve ser interposto no prazo de 30 (trinta) dias contados da ciência da decisão do INSS.";
const T2 = "O prazo para recorrer da decisão do INSS é de trinta dias a partir da data em que o segurado tomou ciência do resultado.";

describe("fontes oficiais", () => {
  it("só https em gov.br, jus.br e leg.br", () => {
    expect(urlOficial(L1)).toBe(true);
    expect(urlOficial("https://portal.stf.jus.br/x")).toBe(true);
    expect(urlOficial("http://www.planalto.gov.br/x")).toBe(false);
    expect(urlOficial("https://blogdodireito.com.br/bpc")).toBe(false);
    expect(urlOficial("https://gov.br.evil.com/x")).toBe(false);
    expect(urlOficial("lixo")).toBe(false);
  });
  it("tira marcação e normaliza espaço", () => {
    expect(textoDaPagina("<script>x()</script><p>Art.  20 &amp; <b>seguintes</b></p>")).toBe("Art. 20 & seguintes");
  });
});

describe("evidência literal", () => {
  it("confere ignorando acento, caixa e espaços", () => {
    expect(evidenciaConfere("PRAZO de 30 (trinta) dias contados da ciencia da decisao", T1)).toBe(true);
  });
  it("trecho inventado ou curto não confere", () => {
    expect(evidenciaConfere("o prazo é de 60 dias para qualquer recurso do segurado", T1)).toBe(false);
    expect(evidenciaConfere("30 dias", T1)).toBe(false);
  });
});

describe("decidirAtualizacao", () => {
  const prazosNovos = ["Recurso administrativo: 30 dias da ciência da decisão.", "Depois do prazo: novo requerimento ou ação judicial."];
  it("campo crítico (prazos) sem duas fontes conferidas não muda", () => {
    const d = decidirAtualizacao(ficha, { prazos: prazosNovos }, [{ campo: "prazos", url: L1, trecho: T1 }], { [L1]: T1 });
    expect(d.aplicada).toBe(false);
    expect(d.mudancas[0]!.motivo).toMatch(/exige 2/);
  });
  it("campo crítico com duas fontes conferidas muda e vai para quarentena", () => {
    const d = decidirAtualizacao(ficha, { prazos: prazosNovos }, [{ campo: "prazos", url: L1, trecho: T1 }, { campo: "prazos", url: L2, trecho: T2 }], { [L1]: T1, [L2]: T2 }, new Date("2026-12-01"));
    expect(d.aplicada).toBe(true);
    expect(d.nova.prazos).toEqual(prazosNovos);
    expect(d.nova.status).toBe("pendente_revisao");
    expect(d.nova.revisado_em).toBe("2026-12-01");
  });
  it("campo comum aceita uma fonte; trecho que não existe na fonte é descartado", () => {
    const ok = decidirAtualizacao(ficha, { cuidados: ["Cite o prazo de 30 dias."] }, [{ campo: "cuidados", url: L1, trecho: T1 }], { [L1]: T1 });
    expect(ok.aplicada).toBe(true);
    const ruim = decidirAtualizacao(ficha, { cuidados: ["x ".repeat(20)] }, [{ campo: "cuidados", url: L1, trecho: "texto que a fonte nunca disse, inventado pelo modelo" }], { [L1]: T1 });
    expect(ruim.aplicada).toBe(false);
  });
  it("fonte não oficial não vale", () => {
    const d = decidirAtualizacao(ficha, { cuidados: ["Algo novo e importante a lembrar."] }, [{ campo: "cuidados", url: "https://blog.com/x", trecho: T1 }], { "https://blog.com/x": T1 });
    expect(d.aplicada).toBe(false);
  });
});

describe("extrairJson", () => {
  it("tira o JSON de dentro de texto e cerca de código", () => {
    expect(extrairJson('Aqui está:\n```json\n{"a": {"b": "}"}}\n```')).toEqual({ a: { b: "}" } });
    expect(extrairJson("sem json")).toBeNull();
  });
});

describe("atualizarFicha (ponta a ponta com dependências falsas)", () => {
  it("aplica o que tem trecho conferido e ignora o resto", async () => {
    const baixar = vi.fn(async (u: string) => (u === L1 ? T1 : u === L2 ? T2 : null));
    const modelo = vi.fn(async () => JSON.stringify({
      ficha_proposta: { prazos: ["Recurso administrativo: 30 dias da ciência da decisão."], cuidados: ["Invenção sem fonte para o campo cuidados."] },
      evidencias: [{ campo: "prazos", url: L1, trecho: T1 }, { campo: "prazos", url: L2, trecho: T2 }],
    }));
    const { nova, resultado } = await atualizarFicha({ ...ficha, fontes: [{ titulo: "a", url: L1 }, { titulo: "b", url: L2 }] }, { baixar, modelo });
    expect(resultado.aplicada).toBe(true);
    expect(nova.prazos).toEqual(["Recurso administrativo: 30 dias da ciência da decisão."]);
    expect(nova.cuidados).toEqual(ficha.cuidados);
    expect(resultado.mudancas.find((m) => m.campo === "cuidados")?.aceita).toBe(false);
  });
  it("sem fonte baixada ou sem resposta do modelo, a ficha não muda e nada quebra", async () => {
    const a = await atualizarFicha(ficha, { baixar: async () => null, modelo: async () => null });
    expect(a.resultado.aplicada).toBe(false);
    const b = await atualizarFicha(ficha, { baixar: async () => T1, modelo: async () => null });
    expect(b.resultado.erro).toMatch(/ilegível|ausente/);
    expect(b.nova).toBe(ficha);
  });
});

describe("trechosRelevantes", () => {
  it("texto curto passa inteiro; texto longo fica com os pedaços do tema", async () => {
    const { trechosRelevantes } = await import("@/lib/sales/base-juridica/atualizar");
    expect(trechosRelevantes("curto", ["pensao"])).toBe("curto");
    const longo = "lixo sem relacao ".repeat(8000) + " A pensao por morte sera devida ao conjuge e companheiro dependente " + "outro lixo ".repeat(8000);
    const r = trechosRelevantes(longo, ["pensão por morte", "cônjuge", "companheiro"], 6000, 1000);
    expect(r.length).toBeLessThan(longo.length);
    expect(r).toContain("pensao por morte sera devida");
  });
});

describe("custo da rotina: não chama o modelo à toa", () => {
  const fontes = { ...ficha, fontes: [{ titulo: "a", url: L1 }] };
  it("fonte igual à da última vez: pula a ficha sem chamar o modelo", async () => {
    const hash = impressaoDasFontes(fontes, { [L1]: T1 });
    const modelo = vi.fn(async () => null);
    const r = await atualizarFicha(fontes, { baixar: async () => T1, modelo }, new Date(), { hashAnterior: hash });
    expect(r.resultado.pulada).toBe(true);
    expect(modelo).not.toHaveBeenCalled();
  });
  it("fonte que mudou: chama o modelo e devolve a nova impressão digital", async () => {
    const modelo = vi.fn(async () => null);
    const r = await atualizarFicha(fontes, { baixar: async () => T2, modelo }, new Date(), { hashAnterior: impressaoDasFontes(fontes, { [L1]: T1 }) });
    expect(modelo).toHaveBeenCalledTimes(1);
    expect(r.resultado.hash).toBe(impressaoDasFontes(fontes, { [L1]: T2 }));
  });
  it("a busca na web só liga com BASE_JURIDICA_BUSCA=1", async () => {
    const modelo = vi.fn(async (_p: string, _o: { busca: boolean }) => null);
    await atualizarFicha(fontes, { baixar: async () => T1, modelo });
    expect(modelo.mock.calls[0]![1].busca).toBe(false);
  });
  it("rodadaDevida: sem registro é devida; dentro do intervalo não é", () => {
    const agora = Date.parse("2026-11-11T12:00:00Z");
    expect(rodadaDevida(undefined, agora)).toBe(true);
    expect(rodadaDevida("2026-11-11T10:00:00Z", agora)).toBe(false);
    expect(rodadaDevida("2026-11-01T10:00:00Z", agora)).toBe(true);
  });
});
