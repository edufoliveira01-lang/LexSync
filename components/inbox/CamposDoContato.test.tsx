import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const salvar = vi.fn();
let funil: unknown = null;
let contato: unknown = null;

vi.mock("@/hooks/pipelines/useDefaultPipeline", () => ({ useDefaultPipeline: () => ({ data: funil }) }));
vi.mock("@/hooks/contacts/useContact", () => ({ useContact: () => ({ data: contato }) }));
vi.mock("@/hooks/contacts/useUpdateContact", () => ({ useUpdateContact: () => ({ mutate: salvar, isPending: false }) }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/hooks/auth/AuthProvider", () => ({ useActiveOrg: () => ({ country: "BR" }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CamposDoContato } from "./CamposDoContato";

const CAMPOS = [
  { key: "cpf", label: "CPF", type: "text", escopo: "contato" },
  { key: "processo", label: "Processo", type: "text" },
];

beforeEach(() => {
  salvar.mockReset();
  funil = { pipeline: { settings: { fields: CAMPOS } } };
  contato = { data: { custom_fields: { cpf: "111" } } };
});

describe("CamposDoContato (painel da conversa)", () => {
  it("mostra só os campos do CONTATO, com o valor gravado no cadastro", () => {
    render(<CamposDoContato contactId="c1" />);
    expect(screen.getByTestId("inbox-campos-do-contato")).toBeInTheDocument();
    expect(screen.getByDisplayValue("111")).toBeInTheDocument();
    expect(screen.queryByText("Processo")).not.toBeInTheDocument();
  });

  it("sem campo do contato no funil, o bloco não aparece", () => {
    funil = { pipeline: { settings: { fields: [CAMPOS[1]] } } };
    render(<CamposDoContato contactId="c1" />);
    expect(screen.queryByTestId("inbox-campos-do-contato")).not.toBeInTheDocument();
  });

  it("Salvar fica desligado até mudar algo, e grava o mapa inteiro pelo cadastro do contato", () => {
    render(<CamposDoContato contactId="c1" />);
    const botao = screen.getByRole("button", { name: "Salvar" });
    expect(botao).toBeDisabled();
    fireEvent.change(screen.getByDisplayValue("111"), { target: { value: "222" } });
    expect(botao).not.toBeDisabled();
    fireEvent.click(botao);
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(salvar.mock.calls[0]![0]).toEqual({ custom_fields: { cpf: expect.stringContaining("2") } });
  });
});
