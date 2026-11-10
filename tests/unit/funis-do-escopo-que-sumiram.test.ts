import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { soFunisQueExistem } from "@/lib/ai/agents/escopo";

/** Um supabase de mentira: só `crm_pipelines` com os ids que "existem" nesta organização. */
function bancoCom(existem: string[]) {
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.eq = () => q;
  q.in = (_c: string, ids: string[]) => Promise.resolve({ data: existem.filter((id) => ids.includes(id)).map((id) => ({ id })), error: null });
  return { from: () => q } as unknown as SupabaseClient;
}

describe("funis marcados no agente que foram apagados", () => {
  it("o funil apagado sai da lista em silêncio; os que existem ficam", async () => {
    expect(await soFunisQueExistem(bancoCom(["a", "b"]), "o1", ["a", "morto", "b"])).toEqual(["a", "b"]);
  });
  it("lista vazia ou ausente passa como está", async () => {
    expect(await soFunisQueExistem(bancoCom([]), "o1", [])).toEqual([]);
    expect(await soFunisQueExistem(bancoCom([]), "o1", undefined)).toBeUndefined();
  });
  it("só ids mortos: a lista fica vazia (valia para nenhum funil mesmo)", async () => {
    expect(await soFunisQueExistem(bancoCom(["a"]), "o1", ["x", "y"])).toEqual([]);
  });
});
