/**
 * Fork Sales — POST/GET /api/v1/conversations/[id]/contrato
 *
 * POST pede o contrato ao painel do Sales (que cadastra o cliente, monta os documentos e manda ao ZapSign) e registra
 * "Contrato enviado para assinatura" na conversa. GET confere os contratos ainda não assinados e registra
 * "Contrato assinado" na conversa quando o cliente assina.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { registrarEventoNaConversa } from "@/lib/inbox/evento-na-conversa";
import { MARCA_DE_EVENTO } from "@/lib/inbox/evento-na-conversa-marca";
import { ErroContratoSales, estadoDoContrato, pedirContrato } from "@/lib/sales/contratos";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
interface RouteCtx { params: Promise<{ id: string }> }

const corpo = z.object({
  nome: z.string().trim().min(3).max(200),
  cpf: z.string().trim().min(11).max(20),
  rg: z.string().trim().max(30).optional(),
  nacionalidade: z.string().trim().max(40).optional(),
  sexo: z.enum(["M", "F"]).optional(),
  estado_civil: z.string().trim().max(40).optional(),
  profissao: z.string().trim().max(100).optional(),
  logradouro: z.string().trim().min(2).max(200),
  numero: z.string().trim().max(20).optional(),
  complemento: z.string().trim().max(100).optional(),
  bairro: z.string().trim().max(100).optional(),
  cidade: z.string().trim().max(100).optional(),
  uf: z.string().trim().max(2).optional(),
  cep: z.string().trim().max(12).optional(),
  email: z.string().trim().max(254).optional(),
  telefone: z.string().trim().max(30).optional(),
});

async function slugDaOrg(orgId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("organizations").select("slug").eq("id", orgId).maybeSingle();
  return (data as { slug: string | null } | null)?.slug ?? null;
}

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const parsed = corpo.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("validation_error", "Confira os dados do contrato: nome, CPF e endereço são obrigatórios.", 422, { requestId });

  const slug = await slugDaOrg(authz.org.orgId);
  if (!slug) return fail("not_found", "Esta empresa não está ligada ao Sales.", 404, { requestId });
  const nomeDoAtendente = authz.user.full_name ?? authz.user.email;
  try {
    const r = await pedirContrato(slug, { ...parsed.data, conversa_ref: id, criado_por: nomeDoAtendente });
    await registrarEventoNaConversa({
      organizationId: authz.org.orgId, conversationId: id, userId: authz.user.id,
      acao: "contrato_enviado", detalhe: `${parsed.data.nome} · nº ${r.id}`,
    });
    return ok({ contrato_id: r.id, sign_url: r.sign_url, email_enviado: r.email_enviado }, { requestId });
  } catch (e) {
    if (e instanceof ErroContratoSales) return fail("upstream_error", e.message, e.status, { requestId });
    throw e;
  }
}

export async function GET(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const admin = createAdminClient();
  const { data } = await admin.from("conversation_notes").select("body").eq("conversation_id", id).eq("organization_id", authz.org.orgId).like("body", `${MARCA_DE_EVENTO}Contrato %`);
  const corpos = ((data ?? []) as { body: string }[]).map((n) => n.body);
  const numeros = (rx: RegExp) => new Set(corpos.filter((b) => rx.test(b)).map((b) => Number(/nº (\d+)/.exec(b)?.[1])).filter(Number.isInteger));
  const enviados = numeros(/Contrato enviado/), assinados = numeros(/Contrato assinado/);
  const pendentes = [...enviados].filter((n) => !assinados.has(n));
  if (pendentes.length === 0) return ok({ pendentes: 0, assinados: assinados.size }, { requestId });
  const slug = await slugDaOrg(authz.org.orgId);
  if (!slug) return ok({ pendentes: pendentes.length, assinados: assinados.size }, { requestId });
  let novos = 0;
  for (const n of pendentes) {
    try {
      const e = await estadoDoContrato(slug, n);
      if (e.status === "assinado") {
        await registrarEventoNaConversa({ organizationId: authz.org.orgId, conversationId: id, userId: null, acao: "contrato_assinado", detalhe: `nº ${n}` });
        novos += 1;
      }
    } catch { /* o painel pode estar fora por instantes: tenta na próxima conferência */ }
  }
  return ok({ pendentes: pendentes.length - novos, assinados: assinados.size + novos }, { requestId });
}
