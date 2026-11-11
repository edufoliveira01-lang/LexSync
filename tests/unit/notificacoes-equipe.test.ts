import { describe, expect, it, vi } from "vitest";

import {
  configSchema, DADOS_DE_EXEMPLO, lerConfig, mascararTelefone, normalizarTelefone, renderizarMensagem, MENSAGEM_PADRAO, GATILHOS,
} from "@/lib/notificacoes-equipe/config";

vi.mock("@/lib/notificacoes-equipe/enviar", () => ({ enviarAviso: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { dispararNotificacoes } from "@/lib/notificacoes-equipe/disparar";
import { enviarAviso } from "@/lib/notificacoes-equipe/enviar";

const nota = (o: Record<string, unknown> = {}) => ({ id: "n_abcdef123", nome: "Cliente para atender", ativa: true, gatilho: "passou_para_equipe", mensagem: "Oi {{nome}}", destinatarios: ["13974045973"], ...o });

function adminCom(settings: unknown) {
  const upd = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  const from = vi.fn(() => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { settings } }) }) }),
    update: upd,
  }));
  return { from } as never;
}

describe("normalizarTelefone", () => {
  it("coloca o 55 e tira a pontuação", () => {
    expect(normalizarTelefone("(13) 97404-5973")).toBe("5513974045973");
    expect(normalizarTelefone("+55 13 97404-5973")).toBe("5513974045973");
  });
  it("recusa número curto", () => { expect(normalizarTelefone("1234")).toBeNull(); });
  it("mascara", () => { expect(mascararTelefone("5513974045973")).toBe("…5973"); });
});

describe("configSchema", () => {
  it("aceita e normaliza os destinatários", () => {
    const r = configSchema.parse({ canal_id: null, notificacoes: [nota({ destinatarios: ["(13) 97404-5973", "13974045973"] })] });
    expect(r.notificacoes[0]!.destinatarios).toEqual(["5513974045973"]);
  });
  it("recusa mais de 10 números, mensagem longa e número inválido", () => {
    const muitos = Array.from({ length: 11 }, (_, i) => `1397404${String(1000 + i)}`);
    expect(configSchema.safeParse({ canal_id: null, notificacoes: [nota({ destinatarios: muitos })] }).success).toBe(false);
    expect(configSchema.safeParse({ canal_id: null, notificacoes: [nota({ mensagem: "x".repeat(501) })] }).success).toBe(false);
    expect(configSchema.safeParse({ canal_id: null, notificacoes: [nota({ destinatarios: ["abc"] })] }).success).toBe(false);
  });
  it("lerConfig não lança com lixo", () => {
    expect(lerConfig(null)).toEqual({ canal_id: null, notificacoes: [] });
    expect(lerConfig({ notificacoes_equipe: { canal_id: "x", notificacoes: [{ lixo: 1 }, nota()] } }).notificacoes).toHaveLength(1);
  });
});

describe("renderizarMensagem", () => {
  it("troca os marcadores e deixa vazio o que não tem valor", () => {
    expect(renderizarMensagem("{{nome}} / {{telefone}} / {{resumo}}", { nome: "Ana" })).toBe("Ana /  /");
  });
  it("todo gatilho tem modelo padrão que cabe em 500", () => {
    for (const g of GATILHOS) expect(MENSAGEM_PADRAO[g].length).toBeLessThanOrEqual(500);
    expect(renderizarMensagem(MENSAGEM_PADRAO.passou_para_equipe, DADOS_DE_EXEMPLO)).toContain("João Silva");
  });
});

describe("dispararNotificacoes", () => {
  const CANAL = "11111111-1111-4111-8111-111111111111";
  it("sem conexão não envia", async () => {
    const r = await dispararNotificacoes({ orgId: "o", gatilho: "passou_para_equipe", admin: adminCom({ notificacoes_equipe: { canal_id: null, notificacoes: [nota()] } }) });
    expect(r.motivo).toBe("sem_conexao");
  });
  it("envia só as ativas do gatilho", async () => {
    vi.mocked(enviarAviso).mockClear();
    const settings = { notificacoes_equipe: { canal_id: CANAL, notificacoes: [nota(), nota({ id: "n_outra0001", ativa: false }), nota({ id: "n_outra0002", gatilho: "contrato_assinado" })] } };
    const r = await dispararNotificacoes({ orgId: "o", gatilho: "passou_para_equipe", admin: adminCom(settings) });
    expect(r).toEqual({ enviadas: 1, falhas: 0 });
    expect(enviarAviso).toHaveBeenCalledTimes(1);
  });
  it("roteiro casa pelo nome, sem diferenciar caixa", async () => {
    vi.mocked(enviarAviso).mockClear();
    const settings = { notificacoes_equipe: { canal_id: CANAL, notificacoes: [nota({ gatilho: "roteiro", nome: "Lead desqualificado" }), nota({ id: "n_outra0003" })] } };
    const r = await dispararNotificacoes({ orgId: "o", gatilho: "roteiro", nomeDaNotificacao: "lead DESQUALIFICADO", admin: adminCom(settings) });
    expect(r.enviadas).toBe(1);
    const sem = await dispararNotificacoes({ orgId: "o", gatilho: "roteiro", nomeDaNotificacao: "não existe", admin: adminCom(settings) });
    expect(sem.motivo).toBe("nenhuma_notificacao");
  });
  it("nunca lança", async () => {
    const r = await dispararNotificacoes({ orgId: "o", gatilho: "passou_para_equipe", admin: { from: () => { throw new Error("boom"); } } as never });
    expect(r.motivo).toBe("erro");
  });
});
