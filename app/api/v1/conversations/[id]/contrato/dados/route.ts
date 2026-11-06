/**
 * Fork Sales — GET /api/v1/conversations/[id]/contrato/dados
 *
 * Sugere os campos do formulário do contrato com o que o Deskcomm já sabe do contato: nome, telefone, e-mail e os campos
 * personalizados do negócio (CPF, RG, endereço…), reconhecidos pelo NOME do campo. O atendente sempre confere antes de gerar.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { camposDoFunil } from "@/lib/leads/campos-do-funil";
import { sugerirDados } from "@/lib/sales/sugerir-dados";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
interface RouteCtx { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const admin = createAdminClient();
  const { data: conv } = await admin.from("conversations").select("contact_id").eq("id", id).eq("organization_id", authz.org.orgId).maybeSingle();
  const contactId = (conv as { contact_id: string | null } | null)?.contact_id;
  if (!contactId) return ok({ sugestoes: {} }, { requestId });
  const [{ data: contato }, { data: negocios }] = await Promise.all([
    admin.from("contacts").select("display_name, name, phone_number, email").eq("id", contactId).maybeSingle(),
    admin.from("crm_leads").select("custom_fields, status, created_at, crm_pipelines(settings)").eq("organization_id", authz.org.orgId).eq("contact_id", contactId).order("created_at", { ascending: false }).limit(5),
  ]);
  const campos: { rotulo: string; valor: string }[] = [];
  for (const n of (negocios ?? []) as unknown as { custom_fields: Record<string, unknown> | null; crm_pipelines: { settings?: Record<string, unknown> } | { settings?: Record<string, unknown> }[] | null }[]) {
    const pipe = Array.isArray(n.crm_pipelines) ? n.crm_pipelines[0] : n.crm_pipelines;
    for (const def of camposDoFunil(pipe?.settings ?? null)) {
      const v = n.custom_fields?.[def.key];
      if (v !== undefined && v !== null && String(v).trim() !== "") campos.push({ rotulo: def.label, valor: String(v) });
    }
  }
  return ok({ sugestoes: sugerirDados({ contato: (contato ?? {}) as Record<string, string | null>, campos }) }, { requestId });
}
