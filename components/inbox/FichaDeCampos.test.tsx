import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/hooks/auth/AuthProvider", () => ({ useActiveOrg: () => ({ currency: "BRL" }) }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));

import { FichaDeCampos, textoDoCampo } from "./FichaDeCampos";
import type { CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";

const campos = [
  { key: "beneficio", label: "Benefício", type: "select", options: [{ value: "bpc", label: "BPC/LOAS" }] },
  { key: "nasc", label: "Nascimento", type: "date" },
  { key: "obs", label: "Observações", type: "textarea" },
  { key: "renda", label: "Renda", type: "currency" },
  { key: "vazio", label: "Sem valor", type: "text" },
] as CustomFieldDef[];

describe("FichaDeCampos (leitura)", () => {
  it("mostra rótulo e valor legível; o vazio aparece como «—», não some", () => {
    render(<FichaDeCampos campos={campos} valores={{ beneficio: "bpc", nasc: "2026-11-10", obs: "linha 1\nlinha 2", renda: 1250.5 }} />);
    expect(screen.getByTestId("ficha-campo-beneficio")).toHaveTextContent("BPC/LOAS");
    expect(screen.getByTestId("ficha-campo-nasc")).toHaveTextContent("10/11/2026");
    expect(screen.getByTestId("ficha-campo-renda")).toHaveTextContent("1.250,50");
    expect(screen.getByTestId("ficha-campo-vazio")).toHaveTextContent("—");
  });

  it("campo de texto longo ocupa a linha inteira; os curtos ficam em duas colunas", () => {
    render(<FichaDeCampos campos={campos} valores={{ beneficio: "bpc", obs: "x".repeat(60) }} />);
    expect(screen.getByTestId("ficha-campo-obs").className).toContain("col-span-2");
    expect(screen.getByTestId("ficha-campo-beneficio").className).not.toContain("col-span-2");
    expect(screen.getByTestId("ficha-de-campos").className).toContain("grid-cols-2");
  });

  it("textoDoCampo: moeda inválida ou vazia vira nulo; sim/não e listas são legíveis", () => {
    const moeda = { key: "m", label: "M", type: "currency" } as CustomFieldDef;
    expect(textoDoCampo(moeda, "", "BRL")).toBeNull();
    expect(textoDoCampo(moeda, "abc", "BRL")).toBeNull();
    expect(textoDoCampo({ key: "b", label: "B", type: "boolean" } as CustomFieldDef, true, "BRL")).toBe("Sim");
  });
});
