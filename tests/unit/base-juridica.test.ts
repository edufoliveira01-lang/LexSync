import { describe, expect, it } from "vitest";

import { acharFicha, FICHAS } from "@/lib/sales/base-juridica/fichas";
import { calcularRendaPerCapita, valorVigente } from "@/lib/sales/base-juridica/valores";

describe("valores vigentes", () => {
  it("devolve o salário mínimo da data, com a fonte", () => {
    expect(valorVigente("salario_minimo", new Date("2025-06-01"))?.valor).toBe(1518);
    expect(valorVigente("salario_minimo", new Date("2026-06-01"))?.valor).toBe(1621);
  });
  it("sem valor para a data, devolve null", () => {
    expect(valorVigente("salario_minimo", new Date("2020-01-01"))).toBeNull();
  });
});

describe("renda per capita (BPC)", () => {
  it("o caso da Patrícia: 2.200 para 4 pessoas = 550, acima de 1/4 e dentro de 1/2", () => {
    const r = calcularRendaPerCapita(2200, 4, 0, new Date("2026-11-09"))!;
    expect(r.renda_per_capita).toBe(550);
    expect(r.limite_um_quarto).toBe(405.25);
    expect(r.limite_meio).toBe(810.5);
    expect(r.faixa).toBe("entre_um_quarto_e_meio");
  });
  it("gastos de saúde NÃO abatem a renda: só viram uma leitura (ampliação do limite)", () => {
    const r = calcularRendaPerCapita(2200, 4, 900, new Date("2026-11-09"))!;
    expect(r.renda_per_capita).toBe(550);
    expect(r.faixa).toBe("entre_um_quarto_e_meio");
    expect(r.gastos_de_saude_por_pessoa).toBe(225);
    expect(r.leitura_gastos_de_saude).toMatch(/NÃO são descontados/);
  });
  it("acima de meio salário", () => {
    expect(calcularRendaPerCapita(5000, 2, 0, new Date("2026-11-09"))!.faixa).toBe("acima_de_meio");
  });
  it("entradas inválidas não calculam", () => {
    expect(calcularRendaPerCapita(1000, 0)).toBeNull();
  });
});

describe("fichas", () => {
  it("acha o BPC por palavras do cliente", () => {
    expect(acharFicha("meu filho tem autismo e o INSS negou o BPC")?.ficha.tema).toBe("bpc");
    expect(acharFicha("loas idoso")?.ficha.tema).toBe("bpc");
  });
  it("tema fora da base: null", () => {
    expect(acharFicha("divórcio litigioso")).toBeNull();
  });
  it("ficha passada da validade vem marcada como vencida", () => {
    expect(acharFicha("bpc", new Date("2027-06-01"))?.vencida).toBe(true);
    expect(acharFicha("bpc", new Date("2026-11-20"))?.vencida).toBe(false);
  });
  it("toda ficha traz fonte, data, validade e prazos", () => {
    for (const f of FICHAS) {
      expect(f.fontes.length).toBeGreaterThan(0);
      expect(f.revisado_em).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(f.validade_dias).toBeGreaterThan(0);
      expect(f.prazos.length).toBeGreaterThan(0);
    }
  });
  it("a ficha de BPC cita o prazo de 30 dias e a flexibilização até 1/2", () => {
    const t = JSON.stringify(acharFicha("bpc")!.ficha);
    expect(t).toContain("30 dias");
    expect(t).toContain("1/2 salário mínimo");
  });
});

describe("fichas de todas as áreas", () => {
  it("acha o tema certo pela fala do cliente", () => {
    const t = (q: string) => acharFicha(q)?.ficha.tema;
    expect(t("meu companheiro faleceu e o INSS negou a pensão por morte")).toBe("pensao_por_morte");
    expect(t("me machuquei no trabalho e perdi dois dedos, a empresa abriu CAT")).toMatch(/auxilio_acidente|trabalhista_acidente_e_estabilidade/);
    expect(t("fui demitido sem justa causa e não recebi as verbas rescisórias")).toBe("trabalhista_rescisao_e_verbas");
    expect(t("trabalho sem carteira assinada e faço horas extras")).toBe("trabalhista_vinculo_e_horas_extras");
    expect(t("quero pedir salário-maternidade")).toBe("salario_maternidade");
  });
  it("palavra curta só casa como palavra inteira", () => {
    expect(acharFicha("quero uma categoria de produto")).toBeNull();
  });
  it("todo tema tem id único", () => {
    const ids = FICHAS.map((f) => f.tema);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(12);
  });
});
