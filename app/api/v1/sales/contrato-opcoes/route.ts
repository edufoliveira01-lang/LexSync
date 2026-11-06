/**
 * Fork Sales — GET/PUT /api/v1/sales/contrato-opcoes
 *
 * GET (agent+): funis e etapas da empresa e o padrão "depois da assinatura" — alimenta o formulário do contrato e a tela de Configurações.
 * PUT (manager+): grava o padrão em `organizations.settings.sales.apos_assinatura`.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { limparEscolha, padraoDaEmpresa } from "@/lib/sales/apos-assinatura";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  const admin = createAdminClient();
  const [{ data: org }, { data: funis }, { data: etapas }] = await Promise.all([
    admin.from("organizations").select("settings").eq("id", authz.org.orgId).maybeSingle(),
    admin.from("crm_pipelines").select("id, name, is_archived").eq("organization_id", authz.org.orgId).order("name", { ascending: true }),
    admin.from("crm_stages").select("id, pipeline_id, name, position").eq("organization_id", authz.org.orgId).order("position", { ascending: true }),
  ]);
  const pipelines = ((funis ?? []) as { id: string; name: string; is_archived: boolean | null }[])
    .filter((f) => !f.is_archived)
    .map((f) => ({ id: f.id, name: f.name, stages: ((etapas ?? []) as { id: string; pipeline_id: string; name: string }[]).filter((e) => e.pipeline_id === f.id).map((e) => ({ id: e.id, name: e.name })) }));
  return ok({ padrao: padraoDaEmpresa(org?.settings), pipelines }, { requestId });
}

export async function PUT(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "organizations" });
  if (!authz.ok) return authz.response;
  const escolha = limparEscolha(await req.json().catch(() => ({})));
  const admin = createAdminClient();
  const { data: atual } = await admin.from("organizations").select("settings").eq("id", authz.org.orgId).maybeSingle();
  const settings = (atual?.settings ?? {}) as Record<string, unknown>;
  const sales = (settings.sales ?? {}) as Record<string, unknown>;
  const { error } = await admin.from("organizations").update({ settings: { ...settings, sales: { ...sales, apos_assinatura: escolha } } }).eq("id", authz.org.orgId);
  if (error) return fail("internal_error", "Não foi possível salvar.", 500, { requestId });
  return ok({ padrao: escolha }, { requestId });
}
