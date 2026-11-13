/**
 * GET /api/v1/contacts/resumo — os números do alto da tela de Contatos: quantos são, quantos são clientes, quantos são
 * pessoais e quantos chegaram na última semana. Só contagem (`head`), nenhuma linha trafega.
 *
 * Mesmos filtros base da lista (`_handler.ts`): sem fundidos, sem anonimizados, e "pessoal" fora do total (é fora da operação).
 */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { loadAuthUser } from "@/lib/auth/server";
import { orgAtivaDaApi } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const user = await loadAuthUser();
  if (!user) return fail("unauthenticated", "Auth required.", 401, { requestId });
  const ativa = await orgAtivaDaApi(user, requestId);
  if (!ativa.ok) return ativa.response;
  const org = ativa.org;
  if (!org) {
    return fail("forbidden_tenant", traduzir("Organização ativa não resolvida.", user.idioma), 403, { requestId });
  }

  const supabase = await createClient();
  const base = () =>
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.orgId)
      .is("is_merged_into", null)
      .eq("is_anonymized", false);

  const seteDias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [total, clientes, pessoais, novos] = await Promise.all([
    base().eq("is_personal", false),
    base().eq("is_personal", false).not("first_service_at", "is", null),
    base().eq("is_personal", true),
    base().eq("is_personal", false).gte("created_at", seteDias),
  ]);
  const falha = [total, clientes, pessoais, novos].find((r) => r.error);
  if (falha?.error) return fail("internal_error", falha.error.message, 500, { requestId });

  return ok(
    {
      total: total.count ?? 0,
      clientes: clientes.count ?? 0,
      pessoais: pessoais.count ?? 0,
      novos_7_dias: novos.count ?? 0,
    },
    { requestId },
  );
}
