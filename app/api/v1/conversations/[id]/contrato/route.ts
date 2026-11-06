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
import { camposDoFunil } from "@/lib/leads/campos-do-funil";
import { preencherCamposDoNegocio, type DadosDoCliente } from "@/lib/sales/campos-do-contrato";
import { aposAssinaturaSchema, embutirEscolha, escolhaEfetiva, lerDadosEmbutidos, lerEscolhaEmbutida, mensagemAposAssinatura, padraoDaEmpresa, resumoDoQueFoiFeito, type AposAssinatura } from "@/lib/sales/apos-assinatura";
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
  apos_assinatura: aposAssinaturaSchema.optional(),
});

async function padraoDaOrg(orgId: string): Promise<AposAssinatura> {
  const { data } = await createAdminClient().from("organizations").select("settings").eq("id", orgId).maybeSingle();
  return padraoDaEmpresa(data?.settings);
}

/** Aplica o que o escritório escolheu para depois da assinatura. Cada passo falha sozinho, sem derrubar os outros. */
/**
 * O contrato traz dados que o Deskcomm não tinha: devolve ao contato (nome, e-mail, endereço) e aos campos do negócio (CPF, RG…)
 * o que foi digitado, e guarda a ligação com o cadastro do Sales. Cada passo falha sozinho — o contrato já foi gerado.
 */
async function sincronizarContato(orgId: string, conversationId: string, d: Record<string, string | undefined>, pessoaId: number) {
  const admin = createAdminClient();
  const { data: conv } = await admin.from("conversations").select("contact_id").eq("id", conversationId).eq("organization_id", orgId).maybeSingle();
  const contactId = (conv as { contact_id: string | null } | null)?.contact_id;
  if (!contactId) return;
  const { data: atual } = await admin.from("contacts").select("custom_fields").eq("id", contactId).maybeSingle();
  const cf = ((atual as { custom_fields: Record<string, unknown> | null } | null)?.custom_fields ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {
    name: d.nome, street: d.logradouro, number: d.numero ?? null, complement: d.complemento ?? null, district: d.bairro ?? null,
    city: d.cidade ?? null, state: d.uf ? d.uf.toUpperCase().slice(0, 2) : null, zip_code: d.cep ? d.cep.replace(/\D/g, "") : null,
    custom_fields: { ...cf, sales: { ...(typeof cf.sales === "object" && cf.sales ? (cf.sales as object) : {}), cadastro_id: pessoaId } },
  };
  let { error } = await admin.from("contacts").update(d.email ? { ...patch, email: d.email } : patch).eq("id", contactId);
  if (error && d.email) ({ error } = await admin.from("contacts").update(patch).eq("id", contactId)); // e-mail já usado por outro contato: segue sem ele
  // negócios abertos do contato: preenche CPF, RG, endereço… nos campos que existirem e estiverem vazios
  try {
    const { data: negocios } = await admin.from("crm_leads").select("id, custom_fields, crm_pipelines(settings)").eq("organization_id", orgId).eq("contact_id", contactId).eq("status", "open");
    for (const n of (negocios ?? []) as unknown as { id: string; custom_fields: Record<string, unknown> | null; crm_pipelines: { settings?: Record<string, unknown> } | { settings?: Record<string, unknown> }[] | null }[]) {
      const pipe = Array.isArray(n.crm_pipelines) ? n.crm_pipelines[0] : n.crm_pipelines;
      const novos = preencherCamposDoNegocio(camposDoFunil(pipe?.settings ?? null), d as DadosDoCliente, n.custom_fields);
      if (Object.keys(novos).length) await admin.from("crm_leads").update({ custom_fields: { ...(n.custom_fields ?? {}), ...novos } }).eq("id", n.id);
    }
  } catch { /* o contato já foi atualizado */ }
}

async function aplicar(orgId: string, conversationId: string, escolha: AposAssinatura, dados: Record<string, string> = {}) {
  const admin = createAdminClient();
  const r = { moveu: null as string | null, criou: null as string | null, semNegocio: false, tag: null as string | null, fechou: false, criarNegocio: null as null | { pipeline_id: string; stage_id: string; contact_id: string; title: string; custom_fields?: Record<string, string> } };
  const { data: conv } = await admin.from("conversations").select("contact_id, service_revision, status").eq("id", conversationId).eq("organization_id", orgId).maybeSingle();
  const c = conv as { contact_id: string | null; service_revision: number; status: string } | null;
  if (!c) return r;
  if (escolha.stage_id && escolha.pipeline_id && c.contact_id) {
    try {
      const { data: neg } = await admin.from("crm_leads").select("id, stage_id").eq("organization_id", orgId).eq("contact_id", c.contact_id).eq("pipeline_id", escolha.pipeline_id).eq("status", "open").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!neg) {
        // Sem negócio aberto neste funil: o NAVEGADOR cria um na etapa escolhida (pela rota oficial de leads, com todas as regras dela).
        const { data: ct } = await admin.from("contacts").select("display_name, name, phone_number").eq("id", c.contact_id).maybeSingle();
        const nomeDoContato = ((ct as { display_name: string | null; name: string | null; phone_number: string | null } | null)?.display_name ?? (ct as { name: string | null } | null)?.name ?? (ct as { phone_number: string | null } | null)?.phone_number ?? "Cliente");
        const { data: et } = await admin.from("crm_stages").select("name").eq("id", escolha.stage_id).maybeSingle();
        const { data: fn } = await admin.from("crm_pipelines").select("settings").eq("id", escolha.pipeline_id).maybeSingle();
        const camposDoNegocio = preencherCamposDoNegocio(camposDoFunil((fn as { settings?: Record<string, unknown> } | null)?.settings ?? null), dados as DadosDoCliente, null);
        r.criarNegocio = { pipeline_id: escolha.pipeline_id, stage_id: escolha.stage_id, contact_id: c.contact_id, title: String(nomeDoContato).slice(0, 200), ...(Object.keys(camposDoNegocio).length ? { custom_fields: camposDoNegocio } : {}) };
        r.criou = (et as { name: string } | null)?.name ?? "etapa escolhida";
      } else {
        const { error } = await admin.from("crm_leads").update({ stage_id: escolha.stage_id }).eq("id", (neg as { id: string }).id);
        if (!error) {
          const { data: et } = await admin.from("crm_stages").select("name").eq("id", escolha.stage_id).maybeSingle();
          r.moveu = (et as { name: string } | null)?.name ?? "etapa escolhida";
        }
      }
    } catch { /* segue para os outros passos */ }
  }
  if (escolha.tag && c.contact_id) {
    try {
      const { data: ct } = await admin.from("contacts").select("tags").eq("id", c.contact_id).maybeSingle();
      const tags = ((ct as { tags: string[] | null } | null)?.tags ?? []) as string[];
      if (!tags.some((t) => t.toLowerCase() === escolha.tag!.toLowerCase())) {
        const { error } = await admin.from("contacts").update({ tags: [...tags, escolha.tag] }).eq("id", c.contact_id);
        if (!error) r.tag = escolha.tag;
      } else r.tag = escolha.tag;
    } catch { /* idem */ }
  }
  if (escolha.fechar_conversa && c.status !== "closed") {
    try {
      const { error } = await admin.rpc("fn_service_status", { p_org: orgId, p_conversation: conversationId, p_status: "closed", p_expected: c.service_revision });
      if (!error) r.fechou = true;
    } catch { /* idem */ }
  }
  return r;
}

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
    const { apos_assinatura: doContrato, ...dadosDoCliente } = parsed.data;
    const efetiva = escolhaEfetiva(await padraoDaOrg(authz.org.orgId), doContrato ?? null);
    const r = await pedirContrato(slug, { ...dadosDoCliente, conversa_ref: id, criado_por: nomeDoAtendente });
    // O cadastro agora existe nos dois sistemas: devolve ao contato do Deskcomm o que foi digitado e guarda a ligação.
    const paraOsCampos: Record<string, string> = Object.fromEntries(
      (["cpf", "rg", "nacionalidade", "estado_civil", "profissao", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "sexo"] as const)
        .flatMap((k) => (dadosDoCliente[k] ? [[k, String(dadosDoCliente[k])]] : [])),
    );
    try { await sincronizarContato(authz.org.orgId, id, { ...dadosDoCliente, ...paraOsCampos } as Record<string, string | undefined>, r.pessoa_id); } catch { /* não derruba o contrato */ }
    await registrarEventoNaConversa({
      organizationId: authz.org.orgId, conversationId: id, userId: authz.user.id,
      acao: "contrato_enviado", detalhe: `${parsed.data.nome} · nº ${r.id}`, oculto: embutirEscolha("", efetiva, paraOsCampos),
    });
    return ok({ contrato_id: r.id, sign_url: r.sign_url, documentos: r.documentos, email_enviado: r.email_enviado }, { requestId });
  } catch (e) {
    // 5xx viraria "Erro interno" genérico na tela; a mensagem do painel/escritório diz o que aconteceu, então vai como 424.
    if (e instanceof ErroContratoSales) return fail("upstream_error", e.message, e.status >= 500 ? 424 : e.status, { requestId });
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
  const corpoDoEnviado = (n: number) => corpos.find((b) => /Contrato enviado/.test(b) && new RegExp(`nº ${n}(?!\\d)`).test(b)) ?? "";
  const pendentes = [...enviados].filter((n) => !assinados.has(n));
  if (pendentes.length === 0) return ok({ pendentes: 0, assinados: assinados.size }, { requestId });
  const slug = await slugDaOrg(authz.org.orgId);
  if (!slug) return ok({ pendentes: pendentes.length, assinados: assinados.size }, { requestId });
  let novos = 0;
  const acoes: { criarNegocio: unknown; mensagem: string | null } = { criarNegocio: null, mensagem: null };
  for (const n of pendentes) {
    try {
      const e = await estadoDoContrato(slug, n);
      if (e.status === "assinado") {
        const escolha = escolhaEfetiva(await padraoDaOrg(authz.org.orgId), lerEscolhaEmbutida(corpoDoEnviado(n)));
        const feito = await aplicar(authz.org.orgId, id, escolha, lerDadosEmbutidos(corpoDoEnviado(n)));
        const { data: org } = await createAdminClient().from("organizations").select("settings").eq("id", authz.org.orgId).maybeSingle();
        const { data: cv } = await createAdminClient().from("conversations").select("contacts(display_name, name)").eq("id", id).maybeSingle();
        const contato = (Array.isArray((cv as { contacts?: unknown } | null)?.contacts) ? ((cv as { contacts: unknown[] }).contacts[0]) : (cv as { contacts?: unknown } | null)?.contacts) as { display_name?: string | null; name?: string | null } | null;
        const mensagem = mensagemAposAssinatura(org?.settings, contato?.display_name ?? contato?.name ?? null);
        if (feito.criarNegocio) acoes.criarNegocio = feito.criarNegocio;
        if (mensagem) acoes.mensagem = mensagem;
        const resumo = resumoDoQueFoiFeito({ ...feito, mensagem: Boolean(mensagem) });
        await registrarEventoNaConversa({ organizationId: authz.org.orgId, conversationId: id, userId: null, acao: "contrato_assinado", detalhe: `nº ${n}${resumo ? ` · ${resumo}` : ""}${e.arquivo_salvo === false ? " · PDF assinado ainda não guardado no cadastro" : ""}` });
        novos += 1;
      }
    } catch { /* o painel pode estar fora por instantes: tenta na próxima conferência */ }
  }
  return ok({ pendentes: pendentes.length - novos, assinados: assinados.size + novos, acoes }, { requestId });
}
