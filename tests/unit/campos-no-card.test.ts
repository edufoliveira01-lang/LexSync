import { describe, expect, it } from "vitest";
import { camposDoCard, etiquetasDoCard, valorParaOCard } from "@/lib/leads/campos-no-card";
import type { CustomFieldDef } from "@/lib/schemas/settings";

const def = (o: Partial<CustomFieldDef> & { key: string }): CustomFieldDef =>
  ({ label: o.key, type: "text", ...o }) as CustomFieldDef;

describe("campos no card", () => {
  it("só entram campos do NEGÓCIO marcados, sem arquivo, e no máximo 3, na ordem do funil", () => {
    const defs = [
      def({ key: "a", no_card: true }),
      def({ key: "b" }),
      def({ key: "c", no_card: true, escopo: "contato" }),
      def({ key: "d", no_card: true, type: "file" }),
      def({ key: "e", no_card: true }),
      def({ key: "f", no_card: true }),
      def({ key: "g", no_card: true }),
    ];
    expect(camposDoCard(defs).map((d) => d.key)).toEqual(["a", "e", "f"]);
  });

  it("lista mostra o RÓTULO da opção, não o valor gravado; várias escolhas viram lista", () => {
    const sel = def({ key: "tipo", type: "select", options: [{ value: "bpc", label: "BPC/LOAS" }, { value: "apo", label: "Aposentadoria" }] });
    expect(valorParaOCard(sel, "bpc")).toBe("BPC/LOAS");
    expect(valorParaOCard(sel, ["bpc", "apo"])).toBe("BPC/LOAS, Aposentadoria");
  });

  it("data vira dd/mm/aaaa, booleano vira Sim/Não, vazio vira nada", () => {
    expect(valorParaOCard(def({ key: "d", type: "date" }), "2026-11-10")).toBe("10/11/2026");
    expect(valorParaOCard(def({ key: "b", type: "boolean" }), true)).toBe("Sim");
    expect(valorParaOCard(def({ key: "b", type: "boolean" }), false)).toBe("Não");
    expect(valorParaOCard(def({ key: "t" }), "   ")).toBeNull();
    expect(valorParaOCard(def({ key: "t" }), undefined)).toBeNull();
    expect(valorParaOCard(def({ key: "t" }), null)).toBeNull();
  });

  it("etiquetas: só campos marcados COM valor; negócio sem valor nenhum não desenha nada", () => {
    const defs = [def({ key: "tipo", label: "Benefício", no_card: true }), def({ key: "obs", label: "Obs", no_card: true })];
    expect(etiquetasDoCard(defs, { tipo: "BPC" })).toEqual([{ chave: "tipo", rotulo: "Benefício", valor: "BPC" }]);
    expect(etiquetasDoCard(defs, {})).toEqual([]);
    expect(etiquetasDoCard([], { tipo: "BPC" })).toEqual([]);
  });
});
