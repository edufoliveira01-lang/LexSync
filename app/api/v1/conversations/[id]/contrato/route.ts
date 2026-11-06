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
import { aposAssinaturaSchema } from "@/lib/sales/apos-assinatura";
import { conferirContratosDaConversa } from "@/lib/sales/acompanhar-contratos";
import { criarContratoNaConversa, slugDaOrg } from "@/lib/sales/contrato-na-conversa";
import { ErroContratoSales } from "@/lib/sales/contratos";

export const dynamic = "force-dynamic";
interface RouteCtx { params: Promise<{ id: string }> }

const pessoaSchema = z.object({
  nome: z.string().trim().max(120).optional(), nacionalidade: z.string().trim().max(40).optional(), estado_civil: z.string().trim().max(40).optional(),
  profissao: z.string().trim().max(100).optional(), rg: z.string().trim().max(30).optional(), cpf: z.string().trim().max(25).optional(),
  endereco: z.string().trim().max(250).optional(), qualidade: z.string().trim().max(60).optional(),
});

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
  apos_assinatura: aposAssinaturaSchema.optional(),
  variante: z.enum(["comum", "representado", "rogo"]).optional(),
  representante: pessoaSchema.optional(),
  a_rogo: pessoaSchema.optional(),
  campos: z.record(z.string().max(40), z.string().max(200)).optional(),
  modelo_honorarios: z.string().max(20).optional(),
});

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const parsed = corpo.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("validation_error", "Confira os dados do contrato: nome, CPF e endereço são obrigatórios.", 422, { requestId });

  const slug = await slugDaOrg(authz.org.orgId);
  if (!slug) return fail("not_found", "Esta empresa não está ligada ao Sales.", 404, { requestId });
  try {
    const { apos_assinatura: doContrato, ...dadosDoCliente } = parsed.data;
    const { contrato } = await criarContratoNaConversa({
      orgId: authz.org.orgId, conversationId: id, slug, userId: authz.user.id, nomeDeQuemPediu: authz.user.full_name ?? authz.user.email,
      dados: dadosDoCliente, aposAssinatura: doContrato ?? null,
    });
    return ok({ contrato_id: contrato.id, sign_url: contrato.sign_url, documentos: contrato.documentos, email_enviado: contrato.email_enviado }, { requestId });
  } catch (e) {
    // 5xx viraria "Erro interno" genérico na tela; a mensagem do painel/escritório diz o que aconteceu, então vai como 424.
    if (e instanceof ErroContratoSales) return fail("upstream_error", e.message, e.status >= 500 ? 424 : e.status, { requestId });
    throw e;
  }
}

/**
 * Confere os contratos desta conversa e trata os que acabaram de ser assinados — NO SERVIDOR (a mesma função da rodada automática):
 * negócio, etiqueta, fechamento, evento e a mensagem ao cliente. A tela só dispara a conferência; não precisa mais agir sobre o resultado.
 */
export async function GET(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const r = await conferirContratosDaConversa(authz.org.orgId, id);
  return ok({ pendentes: r.pendentes, assinados: r.assinados, acoes: { criarNegocio: null, mensagem: null } }, { requestId });
}
