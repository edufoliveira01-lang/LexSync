import { beforeEach, describe, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => ({ fichas: [] as unknown[] }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (nome: string) => ({ select: async () => ({ data: nome === "sales_base_juridica_fichas" ? banco.fichas : [], error: null }) }) }),
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { carregarBase, limparCacheDaBase } from "@/lib/sales/base-juridica/armazem";
import { FICHAS } from "@/lib/sales/base-juridica/fichas";

beforeEach(() => { banco.fichas = []; limparCacheDaBase(); });

describe("o que NÃO cabe e o que é dúvida, por tema (para o agente não vender o que não cabe)", () => {
  const temas = ["bpc", "pensao_por_morte", "auxilio_por_incapacidade_temporaria", "aposentadoria_por_incapacidade_permanente", "auxilio_acidente"];

  it("os benefícios com requisito eliminatório dizem quando em regra NÃO cabe e quando há dúvida", () => {
    for (const tema of temas) {
      const f = FICHAS.find((x) => x.tema === tema);
      expect(f, tema).toBeDefined();
      expect(f!.quando_nao_cabe?.length, `${tema} sem quando_nao_cabe`).toBeGreaterThan(0);
      expect(f!.quando_ha_duvida?.length, `${tema} sem quando_ha_duvida`).toBeGreaterThan(0);
    }
  });

  it("quem nunca contribuiu ao INSS aparece como caso que em regra não cabe no auxílio por incapacidade", () => {
    const f = FICHAS.find((x) => x.tema === "auxilio_por_incapacidade_temporaria")!;
    expect(f.quando_nao_cabe!.join(" ")).toMatch(/Nunca contribuiu/);
    expect(f.quando_nao_cabe!.join(" ")).toMatch(/qualidade de segurado/);
  });

  it("o BPC deixa de proibir dizer que não cabe: o cuidado agora manda explicar quando um requisito essencial não é cumprido", () => {
    const bpc = FICHAS.find((x) => x.tema === "bpc")!;
    expect(bpc.cuidados.join(" ")).not.toMatch(/Nunca diga que há "chance" ou "não há chance"/);
    expect(bpc.cuidados.join(" ")).toMatch(/quando_nao_cabe/);
  });

  it("a ficha gravada no banco (atualização automática) não apaga os campos novos do código", async () => {
    const doCodigo = FICHAS.find((x) => x.tema === "auxilio_por_incapacidade_temporaria")!;
    const { quando_nao_cabe: _a, quando_ha_duvida: _b, ...semOsNovos } = doCodigo;
    banco.fichas = [{ tema: doCodigo.tema, conteudo: { ...semOsNovos, resumo: "resumo atualizado pela rotina" } }];
    const base = await carregarBase(Date.now());
    const f = base.fichas.find((x) => x.tema === doCodigo.tema)!;
    expect(f.resumo).toBe("resumo atualizado pela rotina");
    expect(f.quando_nao_cabe).toEqual(doCodigo.quando_nao_cabe);
  });
});
