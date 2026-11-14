import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const registrar = vi.fn(async () => undefined);
vi.mock("@/lib/inbox/evento-na-conversa", () => ({ registrarEventoNaConversa: (...a: unknown[]) => registrar(...(a as [])) }));

import { registrarAgendamentoNoChat } from "./evento-no-chat";

function banco(conversa: { id: string } | null, agendamento: { starts_at: string; time_zone: string | null } | null) {
  return {
    from: (tabela: string) => {
      const cadeia: Record<string, unknown> = {};
      cadeia.select = () => cadeia;
      cadeia.eq = () => cadeia;
      cadeia.order = () => cadeia;
      cadeia.limit = () => cadeia;
      cadeia.maybeSingle = async () => ({ data: tabela === "conversations" ? conversa : agendamento });
      return cadeia;
    },
  } as unknown as SupabaseClient;
}

const base = { organizationId: "o", appointmentId: "a", contactId: "c", userId: "u", nomeDoTipo: "Consulta" };

describe("agendamento da equipe vira cápsula na conversa", () => {
  beforeEach(() => registrar.mockClear());

  it("agendar: 'agendou', com o horário no fuso da agenda e o tipo", async () => {
    await registrarAgendamentoNoChat(banco({ id: "conv" }, { starts_at: "2026-11-20T17:30:00Z", time_zone: "America/Sao_Paulo" }), { ...base, atividade: "appointment_scheduled" });
    expect(registrar).toHaveBeenCalledTimes(1);
    const arg = (registrar.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(arg).toMatchObject({ organizationId: "o", conversationId: "conv", userId: "u", acao: "agendou" });
    expect(String(arg.detalhe)).toMatch(/20\/11, às 14h30 \(Consulta\)$/);
  });

  it.each([
    ["appointment_rescheduled", "remarcou"],
    ["appointment_cancelled", "desmarcou"],
  ])("%s vira '%s'", async (atividade, acao) => {
    await registrarAgendamentoNoChat(banco({ id: "conv" }, { starts_at: "2026-11-20T17:30:00Z", time_zone: null }), { ...base, atividade });
    expect((registrar.mock.calls[0] as unknown as [Record<string, unknown>])[0]).toMatchObject({ acao });
  });

  it("confirmar, concluir e falta não geram cápsula", async () => {
    for (const atividade of [null, "appointment_completed", "appointment_no_show"]) {
      await registrarAgendamentoNoChat(banco({ id: "conv" }, null), { ...base, atividade });
    }
    expect(registrar).not.toHaveBeenCalled();
  });

  it("sem pessoa (agente de IA), sem contato ou sem conversa: não registra", async () => {
    await registrarAgendamentoNoChat(banco({ id: "conv" }, null), { ...base, atividade: "appointment_scheduled", userId: null });
    await registrarAgendamentoNoChat(banco({ id: "conv" }, null), { ...base, atividade: "appointment_scheduled", contactId: null });
    await registrarAgendamentoNoChat(banco(null, null), { ...base, atividade: "appointment_scheduled" });
    expect(registrar).not.toHaveBeenCalled();
  });

  it("erro do banco não lança", async () => {
    const quebrado = { from: () => { throw new Error("rede"); } } as unknown as SupabaseClient;
    await expect(registrarAgendamentoNoChat(quebrado, { ...base, atividade: "appointment_scheduled" })).resolves.toBeUndefined();
  });
});
