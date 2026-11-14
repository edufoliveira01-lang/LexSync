import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiClient: api }));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { EVENTO_PENDENCIAS_ATUALIZAR, PendenciasDoSales } from "./PendenciasDoSales";

const P1 = { id: 7, origem: "cadastro", autor: "Camila", texto: "Preciso do comprovante de residência", criado_em: "2026-11-10 12:00:00", onde: "Cadastro" };
const P2 = { id: 9, origem: "processo", autor: "Bianca", texto: "Juntar o laudo novo", criado_em: "2026-11-12 09:00:00", onde: "P-1 · 0001234" };

describe("Pendências do cliente no chat", () => {
  beforeEach(() => { vi.clearAllMocks(); api.post.mockResolvedValue({ data: { ok: true } }); });

  it("sem pendência a faixa não aparece", async () => {
    api.get.mockResolvedValue({ data: { pendencias: [] } });
    render(<PendenciasDoSales conversationId="cv-1" />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByTestId("pendencias-do-sales")).toBeNull();
  });

  it("mostra cada pendência com quem anotou e onde, e conta quantas são", async () => {
    api.get.mockResolvedValue({ data: { pendencias: [P1, P2] } });
    render(<PendenciasDoSales conversationId="cv-1" />);
    expect(await screen.findByText("Preciso do comprovante de residência")).toBeInTheDocument();
    expect(screen.getByText("Juntar o laudo novo")).toBeInTheDocument();
    expect(screen.getByText(/Há 2 pendências neste cliente/)).toBeInTheDocument();
    expect(screen.getByText(/Camila/)).toBeInTheDocument();
  });

  it("Cumprido avisa o Sales e a pendência some da faixa", async () => {
    api.get.mockResolvedValue({ data: { pendencias: [P1, P2] } });
    render(<PendenciasDoSales conversationId="cv-1" />);
    await screen.findByText("Preciso do comprovante de residência");
    await userEvent.click(screen.getAllByRole("button", { name: /Cumprido/ })[0]!);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/v1/conversations/cv-1/pendencias-sales", { origem: "cadastro", id: 7 }));
    await waitFor(() => expect(screen.queryByText("Preciso do comprovante de residência")).toBeNull());
    expect(screen.getByText("Juntar o laudo novo")).toBeInTheDocument();
  });

  it("cumprir a última pendência faz a faixa inteira sumir", async () => {
    api.get.mockResolvedValue({ data: { pendencias: [P1] } });
    render(<PendenciasDoSales conversationId="cv-1" />);
    await userEvent.click(await screen.findByRole("button", { name: /Cumprido/ }));
    await waitFor(() => expect(screen.queryByTestId("pendencias-do-sales")).toBeNull());
  });

  it("uma anotação importante nova aparece na hora (evento da anotação rápida)", async () => {
    api.get.mockResolvedValueOnce({ data: { pendencias: [] } }).mockResolvedValue({ data: { pendencias: [P1] } });
    render(<PendenciasDoSales conversationId="cv-1" />);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new Event(EVENTO_PENDENCIAS_ATUALIZAR));
    expect(await screen.findByText("Preciso do comprovante de residência")).toBeInTheDocument();
  });

  it("se o Sales falhar, o chat segue sem o aviso (nada de erro na cara do atendente)", async () => {
    api.get.mockRejectedValue(new Error("fora do ar"));
    render(<PendenciasDoSales conversationId="cv-1" />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByTestId("pendencias-do-sales")).toBeNull();
  });
});
