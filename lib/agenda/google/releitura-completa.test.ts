import { describe, expect, it } from "vitest";

import { pedirReleituraCompleta } from "./releitura-completa";

function bancoFalso(erro: unknown = null) {
  const chamadas: Array<{ tabela: string; dados: Record<string, unknown>; filtros: Array<[string, unknown]> }> = [];
  const db = {
    from(tabela: string) {
      const reg = { tabela, dados: {} as Record<string, unknown>, filtros: [] as Array<[string, unknown]> };
      chamadas.push(reg);
      const cadeia = {
        update(dados: Record<string, unknown>) { reg.dados = dados; return cadeia; },
        eq(coluna: string, valor: unknown) { reg.filtros.push([coluna, valor]); return reg.filtros.length >= 2 ? Promise.resolve({ error: erro }) : cadeia; },
      };
      return cadeia;
    },
  };
  return { db: db as never, chamadas };
}

describe("pedirReleituraCompleta", () => {
  it("limpa o sync_token e antecipa a próxima rodada, só da agenda e da organização pedidas", async () => {
    const { db, chamadas } = bancoFalso();
    const ok = await pedirReleituraCompleta(db, "org-1", "cal-1", () => new Date("2026-11-14T15:00:00.000Z"));
    expect(ok).toBe(true);
    expect(chamadas[0]).toEqual({
      tabela: "calendar_connection_calendars",
      dados: { sync_token: null, sync_next_attempt_at: "2026-11-14T15:00:00.000Z" },
      filtros: [["organization_id", "org-1"], ["id", "cal-1"]],
    });
  });
  it("falha do banco devolve false e nunca lança", async () => {
    const { db } = bancoFalso({ message: "x" });
    expect(await pedirReleituraCompleta(db, "o", "c")).toBe(false);
    const quebrado = { from() { throw new Error("caiu"); } } as never;
    expect(await pedirReleituraCompleta(quebrado, "o", "c")).toBe(false);
  });
});
