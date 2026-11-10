import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { CamposNoCard } from "./CamposNoCard";
import type { CustomFieldDef } from "@/lib/schemas/settings";

const defs = [
  { key: "beneficio", label: "Benefício", type: "select", no_card: true, options: [{ value: "bpc", label: "BPC/LOAS" }] },
  { key: "obs", label: "Obs", type: "text" },
] as CustomFieldDef[];

describe("CamposNoCard", () => {
  it("mostra «Rótulo: valor» só dos campos marcados, com o rótulo da opção", () => {
    render(<CamposNoCard lead={{ custom_fields: { beneficio: "bpc", obs: "x" } }} defs={defs} />);
    const bloco = screen.getByTestId("campos-no-card");
    expect(bloco).toHaveTextContent("Benefício:");
    expect(bloco).toHaveTextContent("BPC/LOAS");
    expect(bloco).not.toHaveTextContent("Obs");
  });

  it("não desenha nada sem campo marcado, sem valor ou sem definições (o card de quem não usa não muda)", () => {
    const { container, rerender } = render(<CamposNoCard lead={{ custom_fields: {} }} defs={defs} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<CamposNoCard lead={{ custom_fields: { beneficio: "bpc" } }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
