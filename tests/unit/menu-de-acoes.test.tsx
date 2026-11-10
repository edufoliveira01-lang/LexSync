// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MenuDeAcoes } from "@/app/app/ai/agents/[id]/_components/MenuDeAcoes";

afterEach(cleanup);

function montar(extra: { onInserir?: ReturnType<typeof vi.fn>; onFechar?: ReturnType<typeof vi.fn> } = {}) {
  const onInserir = extra.onInserir ?? vi.fn();
  const onFechar = extra.onFechar ?? vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <div data-testid="fora">fora</div>
      <MenuDeAcoes funis={[]} onInserir={onInserir} onFechar={onFechar} t={(s) => s} />
    </QueryClientProvider>,
  );
  return { onInserir, onFechar };
}

describe("menu @ de ações", () => {
  it("mostra os grupos, inclusive as consultas (renda) e a agenda", () => {
    montar();
    for (const g of ["Conversa", "CRM", "Contrato", "Consultas", "Agenda"]) expect(screen.getByText(g)).toBeInTheDocument();
    expect(screen.getByText("Calcular a renda por pessoa")).toBeInTheDocument();
    expect(screen.getByText("Marcar um compromisso")).toBeInTheDocument();
  });
  it("ação sem escolha entra direto (renda, chamar a equipe)", () => {
    const { onInserir } = montar();
    fireEvent.click(screen.getByTestId("acao-renda"));
    expect(onInserir).toHaveBeenCalledWith("renda", "");
    fireEvent.click(screen.getByTestId("acao-chamar_equipe"));
    expect(onInserir).toHaveBeenCalledWith("chamar_equipe", "");
  });
  it("dá para cancelar: botão Cancelar, Esc e clique fora", () => {
    const a = montar();
    fireEvent.click(screen.getByTestId("menu-cancelar"));
    expect(a.onFechar).toHaveBeenCalledTimes(1);
    cleanup();
    const b = montar();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(b.onFechar).toHaveBeenCalledTimes(1);
    cleanup();
    const c = montar();
    fireEvent.mouseDown(screen.getByTestId("fora"));
    expect(c.onFechar).toHaveBeenCalledTimes(1);
  });
  it("clique dentro do menu não fecha", () => {
    const { onFechar } = montar();
    fireEvent.mouseDown(screen.getByTestId("acao-renda"));
    expect(onFechar).not.toHaveBeenCalled();
  });
  it("a busca filtra as ações", () => {
    montar();
    fireEvent.change(screen.getByPlaceholderText("Buscar ação…"), { target: { value: "renda" } });
    expect(screen.getByTestId("acao-renda")).toBeInTheDocument();
    expect(screen.queryByTestId("acao-contrato")).toBeNull();
  });
  it("ação com escolha abre as opções à direita (retorno: prazos prontos)", () => {
    const { onInserir } = montar();
    fireEvent.click(screen.getByTestId("acao-retorno"));
    fireEvent.click(screen.getByText("Em 3 dias"));
    expect(onInserir).toHaveBeenCalledWith("retorno", "em 3 dias");
  });
});
