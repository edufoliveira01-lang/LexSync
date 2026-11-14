import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiClient: api }));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { AgendarAtendimento } from "./AgendarAtendimento";

const TIPO = { id: "t1", name: "Consulta", duration_minutes: 60, is_active: true };
// Amanhã às 17:00Z = 14h em Brasília.
const amanha = new Date(Date.now() + 24 * 3_600_000);
amanha.setUTCHours(17, 0, 0, 0);
const SLOT = { inicio: amanha.toISOString(), fim: new Date(amanha.getTime() + 3_600_000).toISOString() };

function servidor(opcoes: { tipos?: unknown[]; marcados?: unknown[]; livres?: unknown } = {}) {
  api.get.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/v1/agenda/tipos")) return { data: opcoes.tipos ?? [TIPO] };
    if (url.startsWith("/api/v1/agenda/agendamentos")) return { data: opcoes.marcados ?? [] };
    if (url.startsWith("/api/v1/agenda/horarios-livres")) return { data: opcoes.livres ?? { slots: [SLOT], fuso_da_regra: "America/Sao_Paulo", publicou_horarios: true } };
    throw new Error(`rota inesperada: ${url}`);
  });
}

const abrir = async () => {
  render(<AgendarAtendimento conversationId="cv-1" contactId="c-1" contactName="Maria da Silva" />);
  await userEvent.click(screen.getByTestId("agendar-atendimento"));
};

describe("Agendar atendimento na conversa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue({ data: { id: "ag-1" } });
    api.patch.mockResolvedValue({ data: {} });
    api.delete.mockResolvedValue({ data: {} });
  });

  it("os horários livres já aparecem ao abrir, sem botão de consultar", async () => {
    servidor();
    await abrir();
    expect(await screen.findByRole("button", { name: "14h" })).toBeInTheDocument();
    expect(screen.queryByText(/consultar horários/i)).toBeNull();
  });

  it("escolher o horário e Agendar cria o atendimento da conversa e avisa o cliente", async () => {
    servidor();
    await abrir();
    await userEvent.click(await screen.findByRole("button", { name: "14h" }));
    await userEvent.click(screen.getByTestId("confirmar-agendamento"));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/v1/agenda/agendamentos", { event_type_id: "t1", starts_at: SLOT.inicio, contact_id: "c-1", conversation_id: "cv-1" }, expect.anything()));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/v1/messages", expect.objectContaining({ conversation_id: "cv-1", body: expect.stringContaining("Olá, Maria!") })));
  });

  it("desligando o aviso, só agenda: nenhuma mensagem sai", async () => {
    servidor();
    await abrir();
    await userEvent.click(await screen.findByRole("button", { name: "14h" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /avisar o cliente/i }));
    await userEvent.click(screen.getByTestId("confirmar-agendamento"));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0]![0]).toBe("/api/v1/agenda/agendamentos");
  });

  it("cliente que já tem atendimento marcado vê o atendimento, com Remarcar e Desmarcar", async () => {
    servidor({ marcados: [{ id: "ag-9", titulo: "Consulta", iniciaEm: SLOT.inicio, fuso: "America/Sao_Paulo", situacao: "confirmed", revision: 3, tipo: { nome: "Consulta" } }] });
    await abrir();
    expect(await screen.findByText("Atendimento marcado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remarcar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desmarcar" })).toBeInTheDocument();
    expect(screen.queryByTestId("confirmar-agendamento")).toBeNull();
  });

  it("atendimento cancelado ou no passado não conta como marcado", async () => {
    servidor({ marcados: [{ id: "x", titulo: "Consulta", iniciaEm: SLOT.inicio, fuso: "America/Sao_Paulo", situacao: "cancelled" }] });
    await abrir();
    expect(await screen.findByRole("button", { name: "14h" })).toBeInTheDocument();
  });

  it("desmarcar usa o motivo escrito e a revisão do atendimento", async () => {
    servidor({ marcados: [{ id: "ag-9", titulo: "Consulta", iniciaEm: SLOT.inicio, fuso: "America/Sao_Paulo", situacao: "pending", revision: 3 }] });
    await abrir();
    await userEvent.click(await screen.findByRole("button", { name: "Desmarcar" }));
    await userEvent.type(screen.getByLabelText("Motivo de desmarcar"), "Cliente viajou");
    await userEvent.click(screen.getByTestId("confirmar-desmarcar"));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/api/v1/agenda/agendamentos", { id: "ag-9", revision: 3, reason: "Cliente viajou" }));
  });

  it("remarcar escolhe outro horário e manda só o novo início", async () => {
    servidor({ marcados: [{ id: "ag-9", titulo: "Consulta", iniciaEm: "2026-12-01T12:00:00Z", fuso: "America/Sao_Paulo", situacao: "confirmed", revision: 2 }].map((m) => ({ ...m, iniciaEm: SLOT.inicio })) });
    await abrir();
    await userEvent.click(await screen.findByRole("button", { name: "Remarcar" }));
    await userEvent.click(await screen.findByRole("button", { name: "14h" }));
    await userEvent.click(screen.getByTestId("confirmar-agendamento"));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/api/v1/agenda/agendamentos", { id: "ag-9", revision: 2, starts_at: SLOT.inicio }));
    expect(api.post).not.toHaveBeenCalled();
  });

  it("jornada não publicada: orienta em vez de dizer que está lotado", async () => {
    servidor({ livres: { slots: [], fuso_da_regra: "America/Sao_Paulo", publicou_horarios: false } });
    await abrir();
    expect(await screen.findByText(/ainda não foram publicados/i)).toBeInTheDocument();
  });

  it("sem tipo de atendimento ativo: manda cadastrar na Agenda", async () => {
    servidor({ tipos: [{ ...TIPO, is_active: false }] });
    await abrir();
    expect(await screen.findByText(/nenhum tipo de atendimento ativo/i)).toBeInTheDocument();
  });

  it("sem contato ou em acompanhamento somente leitura, o botão nem aparece", () => {
    const { container, rerender } = render(<AgendarAtendimento conversationId="cv-1" contactId={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AgendarAtendimento conversationId="cv-1" contactId="c-1" somenteLeitura />);
    expect(container).toBeEmptyDOMElement();
  });
});
