/**
 * Fork Sales — GET/POST /api/v1/sales/agente-do-escritorio
 *
 * O prompt do agente de cada escritório NÃO é escrito à mão: o Sales o monta do cadastro ("Atendimento com IA" + dados do escritório).
 * GET (admin): lista os agentes da empresa e devolve as pendências do cadastro.
 * POST (admin) `{ agent_id }`: busca o prompt pronto no Sales (pelo painel) e grava uma NOVA VERSÃO RASCUNHO do agente escolhido, copiando
 * todo o resto da versão atual (modelo, ferramentas, funil, base de conhecimento…) e trocando só o texto do prompt. NUNCA publica:
 * a versão publicada segue atendendo até alguém publicar o rascunho na tela do agente.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { pickSourceVersion, versionPayloadFrom } from "@/lib/ai/agents/duplicate";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { ErroContratoSales, promptDoAgenteDoEscritorio } from "@/lib/sales/contratos";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function slugDaOrg(orgId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("organizations").select("slug").eq("id", orgId).maybeSingle();
  return (data as { slug: string | null } | null)?.slug ?? null;
}

function falha(e: unknown, requestId: string): Response {
  if (e instanceof ErroContratoSales) return fail("upstream_error", e.message, e.status >= 400 && e.status < 600 ? (e.status === 401 ? 502 : e.status) : 502, { requestId });
  return fail("internal_error", "Erro ao falar com o Sales.", 500, { requestId });
}

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "ai_agents" });
  if (!authz.ok) return authz.response;
  const admin = createAdminClient();
  const { data: agentes } = await admin
    .from("ai_agents")
    .select("id, name, kind, published_version_id")
    .eq("organization_id", authz.org.orgId)
    .is("archived_at", null)
    .eq("kind", "mcp_agent")
    .order("name", { ascending: true });
  const slug = await slugDaOrg(authz.org.orgId);
  let pendencias: string[] = [];
  let nomeAgente = "";
  let prompt = "";
  let semLigacao: string | null = null;
  if (!slug) semLigacao = "Esta empresa não está ligada ao Sales.";
  else {
    try {
      const p = await promptDoAgenteDoEscritorio(slug);
      pendencias = p.pendencias;
      nomeAgente = p.nome_agente;
      prompt = p.prompt;
    } catch (e) {
      semLigacao = e instanceof ErroContratoSales ? e.message : "Não foi possível falar com o Sales.";
    }
  }
  return ok({ agentes: agentes ?? [], pendencias, nome_agente: nomeAgente, prompt, erro_sales: semLigacao }, { requestId });
}

const corpo = z.object({ agent_id: z.string().uuid() }).strict();

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "ai_agents" });
  if (!authz.ok) return authz.response;
  const parsed = corpo.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("validation_error", "Escolha o agente que será atualizado.", 422, { requestId });
  const orgId = authz.org.orgId;

  const admin = createAdminClient();
  const { data: agente } = await admin.from("ai_agents").select("id, kind, archived_at").eq("id", parsed.data.agent_id).eq("organization_id", orgId).maybeSingle();
  if (!agente || (agente as { archived_at: string | null }).archived_at) return fail("not_found", "Agente não encontrado.", 404, { requestId });
  if ((agente as { kind: string }).kind !== "mcp_agent") return fail("unprocessable_entity", "Só agentes com versões podem ser atualizados por aqui.", 422, { requestId });

  const slug = await slugDaOrg(orgId);
  if (!slug) return fail("not_found", "Esta empresa não está ligada ao Sales.", 404, { requestId });
  let prompt: string;
  try {
    prompt = (await promptDoAgenteDoEscritorio(slug)).prompt;
  } catch (e) {
    return falha(e, requestId);
  }
  if (prompt.trim().length < 10 || prompt.length > 20000) return fail("unprocessable_entity", "O texto gerado pelo Sales não é válido. Confira o cadastro em Atendimento com IA.", 422, { requestId });

  const origem = await pickSourceVersion(admin, orgId, parsed.data.agent_id);
  if (!origem) return fail("conflict", "Este agente ainda não tem nenhuma versão para copiar. Crie a primeira versão na tela do agente.", 409, { requestId });

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data: maior } = await admin.from("ai_agent_versions").select("version_number").eq("agent_id", parsed.data.agent_id).eq("organization_id", orgId).order("version_number", { ascending: false }).limit(1).maybeSingle();
    const numero = ((maior as { version_number: number } | null)?.version_number ?? 0) + 1;
    const { data, error } = await admin
      .from("ai_agent_versions")
      .insert({
        organization_id: orgId,
        agent_id: parsed.data.agent_id,
        version_number: numero,
        ...versionPayloadFrom(origem),
        system_prompt: prompt,
        status: "draft",
        created_by: authz.user.id,
      })
      .select("id, version_number")
      .single();
    if (!error && data) {
      void audit({
        action: "ai_agent.version_created", actorUserId: authz.user.id, organizationId: orgId, resourceType: "ai_agent_version",
        resourceId: (data as { id: string }).id, requestId, metadata: { agent_id: parsed.data.agent_id, version_number: numero, origem: "sales_atendimento_ia" },
      });
      return ok({ version_id: (data as { id: string }).id, version_number: (data as { version_number: number }).version_number, agent_id: parsed.data.agent_id }, { status: 201, requestId });
    }
    if ((error as { code?: string } | null)?.code !== "23505") break;
  }
  return fail("internal_error", "Não foi possível gravar o rascunho do agente. Tente de novo.", 500, { requestId });
}
