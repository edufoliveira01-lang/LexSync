import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiClient: api }));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

import { EVENTO_PENDENCIAS_ATUALIZAR } from "./PendenciasDoSales";
import { AnotacaoDoSales } from "./AnotacaoDoSales";

const ACHADO = { disponivel: true, encontrado: true, pessoa: { id: 5, nome: "Maria Souza" }, processos: [], recentes: [] };

async function abrirEEscrever(texto: string) {
  api.get.mockResolvedValue({ data: ACHADO });
  render(<AnotacaoDoSales conversationId="cv-1" />);
  await userEvent.click(screen.getByTestId("anotacao-do-sales"));
  await userEvent.type(await screen.findByPlaceholderText(/Escreva a anotação/), texto);
}

describe("Anotação rápida do atendimento (Alt+N)", () => {
  beforeEach(() => { vi.clearAllMocks(); api.post.mockResolvedValue({ data: { ok: true } }); });

  it("por padrão a anotação NÃO é importante", async () => {
    await abrirEEscrever("Cliente ligou");
    await userEvent.click(screen.getByRole("button", { name: "Salvar anotação" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/v1/conversations/cv-1/anotacao-sales", expect.objectContaining({ pessoa_id: 5, texto: "Cliente ligou", importante: false })));
  });

  it("marcando Importante, a anotação vai como importante e a faixa de pendências é avisada", async () => {
    const aviso = vi.fn();
    window.addEventListener(EVENTO_PENDENCIAS_ATUALIZAR, aviso);
    await abrirEEscrever("Preciso do documento deste cliente");
    await userEvent.click(screen.getByTestId("anotacao-importante"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar anotação" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/v1/conversations/cv-1/anotacao-sales", expect.objectContaining({ importante: true })));
    await waitFor(() => expect(aviso).toHaveBeenCalled());
    window.removeEventListener(EVENTO_PENDENCIAS_ATUALIZAR, aviso);
  });
});
