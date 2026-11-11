/**
 * Fork Sales — onde a base jurídica mora em produção: as fichas e os valores que a rotina de atualização grava no banco SOBREPÕEM os que vão no código.
 * Sem as tabelas (ou sem resposta), vale o do código: a consulta nunca quebra por causa do armazém. Cache curto para não ir ao banco a cada mensagem.
 * As tabelas são criadas pelo SQL em docs/sales/BASE-JURIDICA.md.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

import { FICHAS, type FichaJuridica } from "./fichas";
import { VALORES, type ValorVigente } from "./valores";

const TTL_MS = 5 * 60_000;
let cache: { em: number; fichas: FichaJuridica[]; valores: ValorVigente[] } | null = null;

type Tabela = { select: (c: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
const tabela = (nome: string): Tabela => (createAdminClient() as unknown as { from: (n: string) => Tabela }).from(nome);

export function limparCacheDaBase(): void { cache = null; }

export async function carregarBase(agora = Date.now()): Promise<{ fichas: FichaJuridica[]; valores: ValorVigente[] }> {
  if (cache && agora - cache.em < TTL_MS) return cache;
  const fichas = new Map<string, FichaJuridica>(FICHAS.map((f) => [f.tema, f]));
  let valores: ValorVigente[] = [...VALORES];
  try {
    const f = await tabela("sales_base_juridica_fichas").select("tema, conteudo");
    if (!f.error) for (const r of (f.data ?? []) as { tema: string; conteudo: FichaJuridica }[]) if (r?.conteudo?.tema === r.tema) fichas.set(r.tema, { ...(fichas.get(r.tema) ?? {}), ...r.conteudo });
    const v = await tabela("sales_base_juridica_valores").select("chave, vigente_desde, valor, fonte, revisado_em, confirmado");
    if (!v.error) {
      for (const r of (v.data ?? []) as ValorVigente[]) {
        const i = valores.findIndex((x) => x.chave === r.chave && x.vigente_desde === String(r.vigente_desde).slice(0, 10));
        const novo = { ...r, vigente_desde: String(r.vigente_desde).slice(0, 10), valor: Number(r.valor), revisado_em: String(r.revisado_em).slice(0, 10) };
        if (i >= 0) valores[i] = novo; else valores.push(novo);
      }
    }
  } catch (e) {
    logger.warn("[base-juridica] armazém indisponível, usando a base do código", { erro: e instanceof Error ? e.message : String(e) });
    valores = [...VALORES];
  }
  cache = { em: agora, fichas: [...fichas.values()], valores };
  return cache;
}
