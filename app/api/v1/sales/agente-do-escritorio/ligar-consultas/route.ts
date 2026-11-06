/**
 * Fork Sales — POST /api/v1/sales/agente-do-escritorio/ligar-consultas (admin)
 *
 * Liga o agente às consultas do Sales (processos, andamento, perícias, audiências, documentos, honorários do cliente): registra o servidor de
 * ferramentas do escritório (`<SALES_PAINEL_URL>/mcp/<slug>`) com a chave calculada do segredo que o Deskcomm e o painel já dividem.
 * Idempotente: chamar de novo só reescreve o mesmo registro. O endereço passa pelo MESMO guard anti-SSRF do cadastro manual.
 */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { BOLSO_MCP_EXTERNO, conferirEndpointSeguro, hostDoEndpoint, mesclarServidorMcpExterno } from "@/lib/mcp/servidor-externo/registro";
import { cifrarChaveMcpExterno } from "@/lib/mcp/servidor-externo/segredo";
import { chaveDoServidorMcp, enderecoDoServidorMcp, FERRAMENTAS_DO_SALES } from "@/lib/sales/mcp";
import { configDosContratos } from "@/lib/sales/contratos";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "organizations" });
  if (!authz.ok) return authz.response;
  const cfg = configDosContratos();
  if (!cfg) return fail("service_unavailable", "A ligação com o Sales ainda não foi configurada neste servidor (SALES_PAINEL_URL e CONTRATOS_SEGREDO).", 503, { requestId });

  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("slug, settings").eq("id", authz.org.orgId).maybeSingle();
  const slug = (org as { slug: string | null } | null)?.slug;
  if (!slug) return fail("not_found", "Esta empresa não está ligada ao Sales.", 404, { requestId });

  const endpoint = enderecoDoServidorMcp(cfg.url, slug);
  try {
    conferirEndpointSeguro(endpoint);
  } catch {
    return fail("unprocessable_entity", `O endereço do painel (${hostDoEndpoint(endpoint)}) não passou na conferência de segurança das ferramentas externas: ele precisa ser um endereço https público. Ajuste SALES_PAINEL_URL.`, 422, { requestId });
  }

  const settings = mesclarServidorMcpExterno((org as { settings: unknown } | null)?.settings ?? {}, { endpoint, chave: chaveDoServidorMcp(cfg.segredo, slug) });
  const { error } = await admin.from("organizations").update({ settings, ...cifrarChaveMcpExterno(chaveDoServidorMcp(cfg.segredo, slug)) }).eq("id", authz.org.orgId);
  if (error) return fail("internal_error", "Não foi possível registrar as consultas do Sales.", 500, { requestId });

  void audit({
    action: "org.mcp_externo_registrado", actorUserId: authz.user.id, organizationId: authz.org.orgId, resourceType: "organization", resourceId: authz.org.orgId, requestId,
    metadata: { endpoint: hostDoEndpoint(endpoint), registrado: true, chave_presente: true, origem: "sales_agente_do_escritorio", bolso: BOLSO_MCP_EXTERNO },
  });
  return ok({ ligado: true, ferramentas: FERRAMENTAS_DO_SALES }, { requestId });
}
