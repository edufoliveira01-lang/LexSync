import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agent-engine/agent/destino-da-intencao", () => ({
  aplicaDestinoDaIntencao: vi.fn(async () => ({ status: "transferido" })),
}));

import { aplicaDestinoDaIntencao } from "@/lib/agent-engine/agent/destino-da-intencao";
import { INTENCAO_DA_PASSAGEM, passarParaAgente } from "@/lib/ai/passagem/passar-para-agente";

function adminFalso(opcoes: { agentes?: unknown[]; funis?: unknown[]; etapas?: unknown[]; contato?: unknown } = {}) {
  const updates: unknown[] = [];
  const tabela = (nome: string) => {
    const dados = nome === "ai_agents" ? opcoes.agentes ?? [{ id: "a-cli", name: "Agente de Clientes", published_version_id: "v1" }]
      : nome === "crm_pipelines" ? opcoes.funis ?? [{ id: "f-cli", name: "Clientes" }]
      : nome === "crm_stages" ? opcoes.etapas ?? [{ id: "s-1", name: "Atendimento" }]
      : nome === "contacts" ? opcoes.contato ?? { display_name: "Ana" } : [];
    const q: Record<string, unknown> = {};
    const cadeia = () => q;
    for (const m of ["select", "eq", "is", "not"]) q[m] = cadeia;
    q.maybeSingle = () => Promise.resolve({ data: dados, error: null });
    q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: dados, error: null }).then(res);
    q.update = (v: unknown) => { updates.push(v); const u: Record<string, unknown> = {}; u.eq = () => u; u.then = (res: (x: unknown) => unknown) => Promise.resolve({ error: null }).then(res); return u; };
    return q;
  };
  return { admin: { from: tabela } as never, updates };
}
const base = { organizationId: "o", contactId: "c", conversationId: "v", handlerCtx: { organization_id: "o", actor: { type: "user", id: "u" }, requestId: "r" } as never };

describe("passarParaAgente", () => {
  it("passa a conversa para o agente pelo nome, sem acento nem caixa", async () => {
    const { admin, updates } = adminFalso();
    const r = await passarParaAgente({ ...base, admin, agente: "agente de clientes" });
    expect(r).toMatchObject({ ok: true, agentId: "a-cli" });
    expect(updates[0]).toMatchObject({ active_ai_agent_id: "a-cli", active_intent: INTENCAO_DA_PASSAGEM });
    expect(aplicaDestinoDaIntencao).not.toHaveBeenCalled();
  });
  it("com funil e etapa leva o card antes de passar a conversa", async () => {
    const { admin, updates } = adminFalso();
    const r = await passarParaAgente({ ...base, admin, agente: "Agente de Clientes", funil: "clientes", etapa: "atendimento" });
    expect(r.ok).toBe(true);
    expect(aplicaDestinoDaIntencao).toHaveBeenCalledWith(expect.objectContaining({ destinoPipelineId: "f-cli", destinoStageId: "s-1", funisDeProduto: [] }));
    expect(updates).toHaveLength(1);
  });
  it("devolve a abertura do agente de destino com o primeiro nome do cliente", async () => {
    const { admin } = adminFalso({ agentes: [{ id: "a-cli", name: "Agente de Clientes", published_version_id: "v1", config: { mensagem_de_abertura: "Olá, {{nome}}! Como posso ajudar?" } }], contato: { display_name: "Maria da Silva" } });
    const r = await passarParaAgente({ ...base, admin, agente: "Agente de Clientes" });
    expect(r).toMatchObject({ ok: true, abertura: "Olá, Maria! Como posso ajudar?" });
  });
  it("sem abertura configurada não devolve abertura", async () => {
    const { admin } = adminFalso();
    const r = await passarParaAgente({ ...base, admin, agente: "Agente de Clientes" });
    expect(r).not.toHaveProperty("abertura");
  });
  it("agente inexistente ou funil inexistente: recusa e não passa a conversa", async () => {
    const a = adminFalso({ agentes: [] });
    expect((await passarParaAgente({ ...base, admin: a.admin, agente: "Fulano" })).ok).toBe(false);
    const b = adminFalso({ funis: [] });
    expect((await passarParaAgente({ ...base, admin: b.admin, agente: "Agente de Clientes", funil: "X" })).ok).toBe(false);
    expect(a.updates).toHaveLength(0);
    expect(b.updates).toHaveLength(0);
  });
  it("transferência recusada do card: a conversa NÃO passa", async () => {
    vi.mocked(aplicaDestinoDaIntencao).mockResolvedValueOnce({ status: "recusado", error: "required_fields_missing" });
    const { admin, updates } = adminFalso();
    const r = await passarParaAgente({ ...base, admin, agente: "Agente de Clientes", funil: "Clientes" });
    expect(r.ok).toBe(false);
    expect(updates).toHaveLength(0);
  });
});
