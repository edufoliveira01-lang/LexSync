/**
 * Fork Sales — /api/v1/conversations/[id]/pendencias-sales
 *
 * GET  (agent+): as pendências do cliente desta conversa — anotações marcadas como IMPORTANTES no Sales que ninguém deu por cumpridas.
 *                O atendente as vê numa faixa no chat. Sem Sales ligado, sem telefone ou sem cliente: lista vazia (o aviso é um extra, nunca erro).
 * POST (agent+): dá uma pendência por cumprida ({ origem, id }). Só vale para pendência DESTE cliente: o atendente não mexe em anotação alheia.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { cumprirPendenciaNoSales, ErroContratoSales, pendenciasDoClienteNoSales } from "@/lib/sales/contratos";
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
  if (!slug || !telefone) return ok({ pendencias: [] }, { requestId });
  try {
    const r = await pendenciasDoClienteNoSales(slug, telefone);
    return ok({ pendencias: r.pendencias ?? [], pessoa: r.pessoa ?? null }, { requestId });
  } catch {
    // Sales fora do ar ou ainda sem a versão que conhece pendências: o chat segue sem o aviso.
    return ok({ pendencias: [] }, { requestId });
  }
}

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const corpo = (await req.json().catch(() => ({}))) as { origem?: unknown; id?: unknown; cumprida?: unknown };
  const origem = corpo.origem === "processo" ? "processo" : "cadastro";
  const pendenciaId = Number(corpo.id);
  if (!Number.isSafeInteger(pendenciaId) || pendenciaId <= 0) return fail("validation_error", "Escolha a pendência.", 400, { requestId });
  const { slug, telefone, existe } = await contexto(id, authz.org.orgId);
  if (!existe || !slug || !telefone) return fail("not_found", "Conversa não encontrada.", 404, { requestId });
  try {
    // Só cumpre pendência DESTE cliente (a lista vem do telefone da conversa). Reabrir não tem essa trava: a pendência já saiu da lista.
    if (corpo.cumprida !== false) {
      const atuais = await pendenciasDoClienteNoSales(slug, telefone);
      if (!atuais.pendencias.some((p) => p.id === pendenciaId && p.origem === origem)) return fail("validation_error", "Esta pendência não é deste cliente.", 409, { requestId });
    }
    const r = await cumprirPendenciaNoSales(slug, { origem, id: pendenciaId, cumprida: corpo.cumprida !== false, autor_nome: authz.user.full_name ?? authz.user.email, autor_email: authz.user.email });
    return ok(r, { requestId });
  } catch (e) {
    const status = e instanceof ErroContratoSales && e.status >= 400 && e.status < 500 ? e.status : 502;
    return fail(status === 502 ? "upstream_error" : "validation_error", e instanceof Error ? e.message : "Não foi possível alterar.", status, { requestId });
  }
}
