import { describe, expect, it } from "vitest";

import { escolherEtapaDoContrato, type EtapaDoFunil } from "@/lib/sales/etapa-do-contrato";

const e = (name: string, extra: Partial<EtapaDoFunil> = {}): EtapaDoFunil => ({ id: name, name, is_won: false, is_lost: false, ...extra });
const funil = [e("Novo contato"), e("Em triagem"), e("Proposta enviada"), e("Contrato enviado"), e("Contrato assinado", { is_won: true, agent_stage_hint: "won" }), e("Sem interesse", { is_lost: true })];

describe("etapa do contrato — o funil anda sozinho", () => {
  it("ao enviar vai para 'Contrato enviado' (sem diferença de maiúscula, acento ou espaço)", () => {
    expect(escolherEtapaDoContrato(funil, "enviado")?.name).toBe("Contrato enviado");
    expect(escolherEtapaDoContrato([e("  CONTRATO   ENVIADO ")], "enviado")?.name).toBe("  CONTRATO   ENVIADO ");
  });
  it("ao assinar vai para a etapa de ganho, qualquer que seja o nome", () => {
    expect(escolherEtapaDoContrato(funil, "assinado")?.name).toBe("Contrato assinado");
    expect(escolherEtapaDoContrato([e("Cliente fechado", { is_won: true })], "assinado")?.name).toBe("Cliente fechado");
  });
  it("prefere a etapa de ganho marcada como 'won' do agente quando há mais de uma", () => {
    const duas = [e("Ganho A", { is_won: true }), e("Ganho B", { is_won: true, agent_stage_hint: "won" })];
    expect(escolherEtapaDoContrato(duas, "assinado")?.name).toBe("Ganho B");
  });
  it("sem etapa que sirva, não escolhe nada (o card fica onde está)", () => {
    expect(escolherEtapaDoContrato([e("Novo contato"), e("Sem interesse", { is_lost: true })], "enviado")).toBeUndefined();
    expect(escolherEtapaDoContrato([e("Novo contato")], "assinado")).toBeUndefined();
  });
  it("etapa de perda nunca é escolhida", () => {
    expect(escolherEtapaDoContrato([e("Contrato enviado", { is_lost: true })], "enviado")).toBeUndefined();
  });
});
