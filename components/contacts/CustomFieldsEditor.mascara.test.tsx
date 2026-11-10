// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomFieldsEditor } from "./CustomFieldsEditor";

vi.mock("@/hooks/auth/AuthProvider", () => ({ useActiveOrg: () => ({ country: "BR" }) }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (texto: string) => texto }));

afterEach(cleanup);

function Tela({ inicial = {} as Record<string, unknown> }) {
  const [v, setV] = useState<Record<string, unknown>>(inicial);
  return (
    <>
      <CustomFieldsEditor
        mode="contact"
        fields={[{ key: "cpf", label: "CPF", type: "text", mascara: "cpf" }, { key: "cep", label: "CEP", type: "text", mascara: "cep" }, { key: "obs", label: "Obs", type: "text" }]}
        value={v}
        onChange={setV}
      />
      <pre data-testid="gravado">{JSON.stringify(v)}</pre>
    </>
  );
}

describe("campo de texto com máscara", () => {
  it("formata enquanto digita e grava já formatado", () => {
    render(<Tela />);
    fireEvent.change(screen.getByLabelText("CPF"), { target: { value: "22518854800" } });
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "11705000" } });
    expect(screen.getByTestId("gravado").textContent).toContain("225.188.548-00");
    expect(screen.getByTestId("gravado").textContent).toContain("11705-000");
    expect((screen.getByLabelText("CPF") as HTMLInputElement).value).toBe("225.188.548-00");
  });
  it("valor antigo, sem formato, abre formatado sem reescrever o registro", () => {
    render(<Tela inicial={{ cpf: "22518854800" }} />);
    expect((screen.getByLabelText("CPF") as HTMLInputElement).value).toBe("225.188.548-00");
    expect(screen.getByTestId("gravado").textContent).toContain('"22518854800"');
  });
  it("campo sem máscara continua livre", () => {
    render(<Tela />);
    fireEvent.change(screen.getByLabelText("Obs"), { target: { value: "abc 123" } });
    expect((screen.getByLabelText("Obs") as HTMLInputElement).value).toBe("abc 123");
  });
  it("CPF completo e inválido mostra o aviso", () => {
    render(<Tela />);
    fireEvent.change(screen.getByLabelText("CPF"), { target: { value: "12345678900" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/CPF inválido/);
  });
});
