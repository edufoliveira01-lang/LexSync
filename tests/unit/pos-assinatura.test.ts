import { beforeEach, describe, expect, it, vi } from "vitest";

const agenda = vi.fn();
vi.mock("@/lib/followup/retorno-crm", () => ({ agendaRetornoNoCrm: (...a: unknown[]) => agenda(...a) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { contact_id: "c1" } }) }) }) }) }) }),
}));

import { acordarAgenteAposAssinatura, ATRASO_DO_AGENTE_APOS_ASSINATURA_MS, MOTIVO_DO_RETORNO_APOS_ASSINATURA } from "@/lib/sales/pos-assinatura";

describe("depois da assinatura a conversa não para", () => {
  beforeEach(() => agenda.mockReset());

  it("agenda o retorno do agente para daqui a pouco, com a janela própria do sistema (mínimo curto, sem espalhar)", async () => {
    agenda.mockResolvedValue({ ok: true });
    const antes = Date.now();
    expect(await acordarAgenteAposAssinatura("org-1", "conv-1")).toBe(true);
    const [deps, ref, input] = agenda.mock.calls[0]!;
    expect(deps.janela.minAheadMs).toBeLessThanOrEqual(ATRASO_DO_AGENTE_APOS_ASSINATURA_MS);
    expect(deps.janela.staggerWindowMs).toBe(0);
    expect(ref).toEqual({ contactId: "c1" });
    expect(input.motivo).toBe(MOTIVO_DO_RETORNO_APOS_ASSINATURA);
    expect(input.source).toBe("contrato_assinado");
    const quando = Date.parse(input.prometidoPara);
    expect(quando).toBeGreaterThan(antes);
    expect(quando - antes).toBeLessThan(ATRASO_DO_AGENTE_APOS_ASSINATURA_MS + 5_000);
  });
  it("o motivo manda pedir os documentos e NÃO gerar outro contrato", () => {
    expect(MOTIVO_DO_RETORNO_APOS_ASSINATURA).toMatch(/documentos/);
    expect(MOTIVO_DO_RETORNO_APOS_ASSINATURA).toMatch(/Não gere outro contrato/);
  });
  it("já existir um retorno vivo não derruba nada: devolve false", async () => {
    agenda.mockResolvedValue({ ok: false, codigo: "ja_existe_retorno" });
    expect(await acordarAgenteAposAssinatura("org-1", "conv-1")).toBe(false);
  });
  it("resposta inesperada do agendador (erro interno) também não derruba: devolve false", async () => {
    agenda.mockResolvedValue(undefined);
    expect(await acordarAgenteAposAssinatura("org-1", "conv-1")).toBe(false);
  });
});
