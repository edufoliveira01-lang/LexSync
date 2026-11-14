/**
 * Fork Sales — /api/v1/conversations/[id]/anotacao-sales
 *
 * GET  (agent+): acha, no Sales, o cliente dono do telefone desta conversa (com os processos e as últimas anotações).
 * POST (agent+): grava a anotação no cadastro do cliente ou no processo escolhido — em nome de quem está atendendo.
 * O atendente anota sem sair da conversa (atalho Alt+N); o Deskcomm não guarda a anotação: ela mora no Sales.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { anotarNoSales, buscarClienteParaAnotar, ErroContratoSales } from "@/lib/sales/contratos";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
interface RouteCtx { params: Promise<{ id: string }> }

async function contexto(id: string, orgId: string) {
  const admin = createAdminClient();
  const [{ data: org }, { data: conv }] = await Promise.all([
    admin.from("organizations").select("slug").eq("id", orgId).maybeSingle(),
    admin.from("conversations").select("contact_id").eq("id", id).eq("organization_id", orgId).maybeSingle(),
  ]);
  const slug = (org as { slug: string | null } | null)?.slug ?? null;
  const contactId = (conv as { contact_id: string | null } | null)?.contact_id ?? null;
  let telefone = "";
  if (contactId) {
    const { data: c } = await admin.from("contacts").select("phone_number").eq("id", contactId).eq("organization_id", orgId).maybeSingle();
    telefone = (c as { phone_number: string | null } | null)?.phone_number ?? "";
  }
  return { slug, telefone, existe: Boolean(conv) };
}

export async function GET(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const { slug, telefone, existe } = await contexto(id, authz.org.orgId);
  if (!existe) return fail("not_found", "Conversa não encontrada.", 404, { requestId });
  if (!slug) return ok({ disponivel: false, encontrado: false }, { requestId });
  if (!telefone) return ok({ disponivel: true, encontrado: false, semTelefone: true }, { requestId });
  try {
    return ok({ disponivel: true, ...(await buscarClienteParaAnotar(slug, telefone)) }, { requestId });
  } catch (e) {
    const msg = e instanceof ErroContratoSales ? e.message : "Não foi possível falar com o Sales.";
    return fail("upstream_error", msg, 502, { requestId });
  }
}

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const corpo = (await req.json().catch(() => ({}))) as { pessoa_id?: unknown; processo_id?: unknown; texto?: unknown; importante?: unknown };
  const texto = typeof corpo.texto === "string" ? corpo.texto.trim() : "";
  const pessoaId = Number(corpo.pessoa_id);
  const processoId = Number(corpo.processo_id) || undefined;
  if (texto.length < 2) return fail("validation_error", "Escreva a anotação.", 400, { requestId });
  if (!Number.isSafeInteger(pessoaId) || pessoaId <= 0) return fail("validation_error", "Cliente não identificado.", 400, { requestId });
  const { slug, telefone, existe } = await contexto(id, authz.org.orgId);
  if (!existe || !slug) return fail("not_found", "Conversa não encontrada.", 404, { requestId });
  try {
    // O cliente precisa ser o dono do telefone DESTA conversa: o atendente não grava anotação em cliente alheio por este caminho.
    const achado = await buscarClienteParaAnotar(slug, telefone);
    if (!achado.encontrado || achado.pessoa?.id !== pessoaId) return fail("validation_error", "Este cliente não corresponde ao telefone da conversa.", 409, { requestId });
    const r = await anotarNoSales(slug, { pessoa_id: pessoaId, processo_id: processoId, texto: texto.slice(0, 4000), importante: corpo.importante === true, autor_nome: authz.user.full_name ?? authz.user.email, autor_email: authz.user.email });
    return ok(r, { requestId });
  } catch (e) {
    const status = e instanceof ErroContratoSales && e.status >= 400 && e.status < 500 ? e.status : 502;
    return fail(status === 502 ? "upstream_error" : "validation_error", e instanceof Error ? e.message : "Não foi possível salvar.", status, { requestId });
  }
}
