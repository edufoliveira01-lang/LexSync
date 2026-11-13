import { beforeEach, describe, expect, it, vi } from "vitest";

const enviar = vi.fn();
const evento = vi.fn();
const atualizacoes: Array<{ id: string; campos: Record<string, unknown> }> = [];
let vencidas: Array<Record<string, unknown>> = [];
let conversa: Record<string, unknown> | null = null;
let reivindicacao = true;

vi.mock("@/app/api/v1/messages/_handler", () => ({ sendMessageHandler: (...a: unknown[]) => enviar(...a) }));
vi.mock("@/lib/automation/throttle", () => ({ espacarEnvio: vi.fn(async () => undefined) }));
vi.mock("@/lib/inbox/evento-na-conversa", () => ({ registrarEventoNaConversa: (...a: unknown[]) => evento(...a) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/organizacao/operante", () => ({ OrgNaoOperanteError: class OrgNaoOperanteError extends Error {} }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabela: string) => {
      const q: Record<string, unknown> = {};
      let campos: Record<string, unknown> | null = null;
      let id = "";
      const api = {
        select: () => api,
        eq: (c: string, v: unknown) => {
          if (c === "id") id = String(v);
          return api;
        },
        lte: () => api,
        order: () => api,
        limit: async () => ({ data: vencidas, error: null }),
        update: (c: Record<string, unknown>) => {
          campos = c;
          return api;
        },
        maybeSingle: async () => {
          if (tabela === "conversations") return { data: conversa, error: null };
          if (campos?.status === "sending") return { data: reivindicacao ? { id } : null, error: null };
          return { data: null, error: null };
        },
        then: (resolve: (v: unknown) => void) => {
          if (campos) atualizacoes.push({ id, campos });
          resolve({ error: null });
        },
      };
      void q;
      return api;
    },
  }),
}));

import { enviarMensagensProgramadasVencidas } from "./enviar-vencidas";

const base = {
  id: "m1",
  organization_id: "org1",
  conversation_id: "c1",
  body: "Olá, tudo bem?",
  cancel_on_reply: true,
  created_at: "2026-11-13T12:00:00Z",
  created_by_user_id: "u1",
};

beforeEach(() => {
  enviar.mockReset().mockResolvedValue({ id: "msg1" });
  evento.mockReset();
  atualizacoes.length = 0;
  vencidas = [base];
  conversa = { id: "c1", status: "open", last_inbound_at: null, channel_session_id: "s1" };
  reivindicacao = true;
});

describe("enviarMensagensProgramadasVencidas", () => {
  it("envia em nome de quem programou e marca como enviada", async () => {
    const r = await enviarMensagensProgramadasVencidas("t");
    expect(r).toMatchObject({ enviadas: 1, canceladas: 0, falhas: 0 });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0]![1]).toMatchObject({ organization_id: "org1", actor: { type: "user", id: "u1" } });
    expect(atualizacoes.some((a) => a.campos.status === "sent" && a.campos.message_id === "msg1")).toBe(true);
  });

  it("cancela, sem enviar, quando o cliente respondeu depois de programar e a opção está ligada", async () => {
    conversa = { id: "c1", status: "open", last_inbound_at: "2026-11-13T12:30:00Z", channel_session_id: "s1" };
    const r = await enviarMensagensProgramadasVencidas("t");
    expect(r).toMatchObject({ enviadas: 0, canceladas: 1 });
    expect(enviar).not.toHaveBeenCalled();
    expect(atualizacoes.some((a) => a.campos.status === "canceled" && a.campos.canceled_reason === "cliente_respondeu")).toBe(true);
  });

  it("envio permanente: envia mesmo com resposta do cliente", async () => {
    vencidas = [{ ...base, cancel_on_reply: false }];
    conversa = { id: "c1", status: "open", last_inbound_at: "2026-11-13T12:30:00Z", channel_session_id: "s1" };
    const r = await enviarMensagensProgramadasVencidas("t");
    expect(r.enviadas).toBe(1);
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("não envia quando outra rodada já reivindicou a mensagem", async () => {
    reivindicacao = false;
    const r = await enviarMensagensProgramadasVencidas("t");
    expect(r).toMatchObject({ enviadas: 0, canceladas: 0, falhas: 0 });
    expect(enviar).not.toHaveBeenCalled();
  });

  it("falha de envio vira 'failed' com o motivo, sem derrubar a rodada", async () => {
    enviar.mockRejectedValue(new Error("Janela de 24h fechada"));
    const r = await enviarMensagensProgramadasVencidas("t");
    expect(r.falhas).toBe(1);
    expect(atualizacoes.some((a) => a.campos.status === "failed" && String(a.campos.error).includes("24h"))).toBe(true);
  });

  it("conversa arquivada antes do horário não recebe", async () => {
    conversa = { id: "c1", status: "archived", last_inbound_at: null, channel_session_id: "s1" };
    const r = await enviarMensagensProgramadasVencidas("t");
    expect(r.falhas).toBe(1);
    expect(enviar).not.toHaveBeenCalled();
  });
});
