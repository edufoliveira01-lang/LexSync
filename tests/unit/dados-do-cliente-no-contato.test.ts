import { beforeEach, describe, expect, it, vi } from "vitest";

// Um banco de mentira em memória: só o que a gravação dos dados do cliente usa.
const banco = vi.hoisted(() => ({
  contacts: { id: "c1", organization_id: "o1", name: "Eduardo Freitas Oliveira", custom_fields: {} as Record<string, unknown> } as Record<string, unknown>,
  settings: {} as Record<string, unknown>,
}));

vi.mock("@/lib/supabase/admin", () => {
  const consulta = (tabela: string) => {
    const q: Record<string, unknown> = {};
    const resultado = () => {
      if (tabela === "contacts") return { data: banco.contacts, error: null };
      if (tabela === "crm_pipelines") return { data: { settings: banco.settings }, error: null };
      return { data: tabela === "crm_leads" ? [] : null, error: null };
    };
    for (const m of ["select", "eq", "order", "limit"]) q[m] = () => q;
    q.maybeSingle = () => Promise.resolve(resultado());
    q.update = (patch: Record<string, unknown>) => {
      if (tabela === "contacts") Object.assign(banco.contacts, patch);
      return q;
    };
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve(resultado()).then(ok);
    return q;
  };
  return { createAdminClient: () => ({ from: consulta }) };
});
vi.mock("@/lib/sales/consulta-cep", () => ({ consultarCep: async () => null }));

import { gravarDadosDoCliente } from "@/lib/sales/dados-do-cliente";

const campo = (key: string, label: string, escopo: "contato" | "negocio") => ({ key, label, type: "text", escopo });

describe("o agente grava também nos campos do contato (o que o painel da conversa mostra)", () => {
  beforeEach(() => {
    banco.contacts = { id: "c1", organization_id: "o1", name: "Eduardo Freitas Oliveira", custom_fields: {} };
    banco.settings = { fields: [campo("cf_cpf", "CPF", "contato"), campo("cf_rg", "RG", "contato"), campo("cf_valor", "Valor da causa", "negocio")] };
  });

  it("CPF e RG informados aparecem em contacts.custom_fields, nas chaves do funil", async () => {
    await gravarDadosDoCliente("o1", "c1", { cpf: "225.188.548-00", rg: "12.345.678-9" });
    const cf = banco.contacts.custom_fields as Record<string, unknown>;
    expect(cf.cf_cpf).toBe("225.188.548-00");
    expect(cf.cf_rg).toBe("12.345.678-9");
    expect(cf.cf_valor).toBeUndefined();
  });

  it("um dado já gravado antes também aparece na próxima gravação, sem atropelar o que a equipe digitou", async () => {
    banco.contacts.custom_fields = { sales: { dados: { rg: "99" } }, cf_cpf: "digitado pela equipe" };
    await gravarDadosDoCliente("o1", "c1", { nacionalidade: "brasileiro" });
    const cf = banco.contacts.custom_fields as Record<string, unknown>;
    expect(cf.cf_rg).toBe("99");
    expect(cf.cf_cpf).toBe("digitado pela equipe");
  });
});
