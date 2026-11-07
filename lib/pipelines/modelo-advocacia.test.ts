import { describe, expect, it } from "vitest";

import { customFieldSchema } from "@/lib/schemas/settings";
import { REGRAS, sem } from "@/lib/sales/sugerir-dados";
import { CAMPOS_DE_CONTRATO_ADVOCACIA, ETAPAS_ADVOCACIA } from "./modelo-advocacia";

describe("funil de escritório de advocacia", () => {
  it("tem uma etapa de fechamento e uma de perda, e as coerentes com o passo do agente", () => {
    expect(ETAPAS_ADVOCACIA.filter((e) => e.is_won)).toHaveLength(1);
    expect(ETAPAS_ADVOCACIA.filter((e) => e.is_lost)).toHaveLength(1);
    // o ganho NÃO tem passo do agente: o agente não pode fechar o negócio antes da assinatura (quem leva o card até lá é o sistema)
    expect(ETAPAS_ADVOCACIA.find((e) => e.is_won)?.agent_stage_hint).toBeNull();
    expect(ETAPAS_ADVOCACIA.find((e) => e.is_lost)?.agent_stage_hint).toBe("lost");
  });
  it("cada passo do agente aponta para no máximo UMA etapa (índice único do banco) e os nomes/slugs não repetem", () => {
    const hints = ETAPAS_ADVOCACIA.map((e) => e.agent_stage_hint).filter(Boolean);
    expect(new Set(hints).size).toBe(hints.length);
    expect(new Set(ETAPAS_ADVOCACIA.map((e) => e.slug)).size).toBe(ETAPAS_ADVOCACIA.length);
    expect(new Set(ETAPAS_ADVOCACIA.map((e) => e.name)).size).toBe(ETAPAS_ADVOCACIA.length);
  });
  it("a ordem é a do atendimento", () => {
    expect(ETAPAS_ADVOCACIA.map((e) => e.name)).toEqual(["Novo contato", "Em triagem", "Proposta enviada", "Proposta aceita", "Contrato enviado", "Contrato assinado", "Aguardando documentos", "Sem interesse"]);
  });
  it("os passos do agente seguem a ordem fixa do motor (novo, triagem, qualificado, negociando, ganho) e contrato enviado/assinado ficam sem passo", () => {
    const porNome = (n: string) => ETAPAS_ADVOCACIA.find((e) => e.name === n)!;
    expect(porNome("Novo contato").agent_stage_hint).toBe("new");
    expect(porNome("Em triagem").agent_stage_hint).toBe("qualifying");
    expect(porNome("Proposta enviada").agent_stage_hint).toBe("qualified");
    expect(porNome("Proposta aceita").agent_stage_hint).toBe("negotiating");
    expect(porNome("Contrato enviado").agent_stage_hint).toBeNull();
    expect(porNome("Contrato assinado").agent_stage_hint).toBeNull();
    expect(porNome("Aguardando documentos")).toMatchObject({ is_won: true, agent_stage_hint: null });
  });
  it("os campos do contrato são válidos para o funil e cada um é reconhecido pelo formulário de contrato (pelo rótulo)", () => {
    for (const c of CAMPOS_DE_CONTRATO_ADVOCACIA) {
      expect(customFieldSchema.safeParse(c).success).toBe(true);
      expect(REGRAS.some(([, rx]) => rx.test(sem(c.label)))).toBe(true);
    }
    expect(new Set(CAMPOS_DE_CONTRATO_ADVOCACIA.map((c) => c.key)).size).toBe(CAMPOS_DE_CONTRATO_ADVOCACIA.length);
  });
});
