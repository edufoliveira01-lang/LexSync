import { describe, expect, it } from "vitest";
import { CAMPOS_DE_CONTRATO_ADVOCACIA, ETAPAS_ADVOCACIA, NOME_DO_FUNIL_ADVOCACIA } from "@/lib/pipelines/modelo-advocacia";
import { CAMPOS_DE_CONTRATO, ETAPAS, NOME_DO_FUNIL, semearFunilDeAdvocacia, SLUG_DO_FUNIL } from "../../sales-bridge/src/funil-advocacia";

describe("funil de advocacia da ponte", () => {
  it("é a mesma lista do app (etapas, nome e campos)", () => {
    expect(NOME_DO_FUNIL).toBe(NOME_DO_FUNIL_ADVOCACIA);
    expect(ETAPAS.map((e) => ({ ...e }))).toEqual(ETAPAS_ADVOCACIA.map((e) => ({ ...e })));
    expect(CAMPOS_DE_CONTRATO.map((c) => ({ ...c }))).toEqual(CAMPOS_DE_CONTRATO_ADVOCACIA.map((c) => ({ ...c })));
  });

  /** Banco falso: guarda funis e etapas e entende o que a função usa (select/insert/update/delete com eq). */
  function banco(funis: Array<Record<string, unknown>>) {
    const etapas: Array<Record<string, unknown>> = [];
    let n = 0;
    const db: any = {
      from: (t: string) => {
        const f: Record<string, unknown> = {};
        let op: "select" | "insert" | "update" | "delete" = "select"; let dados: any = null;
        const q: any = {
          select: () => q, eq: (c: string, v: unknown) => { f[c] = v; return q; },
          insert: (d: any) => { op = "insert"; dados = d; return q; }, update: (d: any) => { op = "update"; dados = d; return q; }, delete: () => { op = "delete"; return q; },
          single: async () => { const novo = { id: `p${++n}`, ...dados }; funis.push(novo); return { data: novo, error: null }; },
          then: (res: any) => {
            if (t === "crm_stages" && op === "insert") { etapas.push(...dados); return Promise.resolve({ data: null, error: null }).then(res); }
            if (t === "crm_pipelines" && op === "update") { for (const x of funis) if (x.id === f.id) Object.assign(x, dados); return Promise.resolve({ data: null, error: null }).then(res); }
            if (t === "crm_pipelines" && op === "select") return Promise.resolve({ data: funis, error: null }).then(res);
            return Promise.resolve({ data: null, error: null }).then(res);
          },
        };
        return q;
      },
    };
    return { db, etapas };
  }

  it("cria o funil de advocacia como padrão e arquiva o genérico de loja", async () => {
    const funis: Array<Record<string, unknown>> = [{ id: "loja", slug: "pedidos", is_default: true, is_archived: false }];
    const { db, etapas } = banco(funis);
    expect(await semearFunilDeAdvocacia(db, "org1")).toBe("criado");
    expect(funis.find((f) => f.id === "loja")).toMatchObject({ is_default: false, is_archived: true });
    expect(funis.find((f) => f.slug === SLUG_DO_FUNIL)).toMatchObject({ is_default: true });
    expect(etapas.map((e) => e.name)).toEqual(ETAPAS_ADVOCACIA.map((e) => e.name));
  });

  it("não repete quando o funil já existe", async () => {
    const { db } = banco([{ id: "a", slug: SLUG_DO_FUNIL, is_archived: false }]);
    expect(await semearFunilDeAdvocacia(db, "org1")).toBe("ja_existia");
  });

  it("nunca lança: devolve 'falhou' se o banco recusar", async () => {
    const db: any = { from: () => { throw new Error("banco fora"); } };
    expect(await semearFunilDeAdvocacia(db, "org1")).toBe("falhou");
  });
});
