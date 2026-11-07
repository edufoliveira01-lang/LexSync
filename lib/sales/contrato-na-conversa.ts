/**
 * Fork Sales — o contrato DENTRO da conversa, usado pela tela do atendente (rota) e pelo agente (ferramenta `crm_enviar_contrato`).
 * Uma implementação só: pedir ao Sales, devolver ao contato o que foi digitado, registrar o evento e (depois) aplicar o que o escritório quer na assinatura.
 */
import { registrarEventoNaConversa } from "@/lib/inbox/evento-na-conversa";
import { camposDoFunil } from "@/lib/leads/campos-do-funil";
import { preencherCamposDoNegocio, type DadosDoCliente } from "@/lib/sales/campos-do-contrato";
import { embutirEscolha, escolhaEfetiva, padraoDaEmpresa, type AposAssinatura } from "@/lib/sales/apos-assinatura";
import { ErroContratoSales, pedirContrato, type ContratoPedido, type DadosDoContrato } from "@/lib/sales/contratos";
import { moverParaEtapaDoContrato } from "@/lib/sales/etapa-do-contrato";
import { mensagemDoContrato } from "@/lib/sales/mensagem-do-contrato";
import { createAdminClient } from "@/lib/supabase/admin";


export async function padraoDaOrg(orgId: string): Promise<AposAssinatura> {
  const { data } = await createAdminClient().from("organizations").select("settings").eq("id", orgId).maybeSingle();
  return padraoDaEmpresa(data?.settings);
}

/** Aplica o que o escritório escolheu para depois da assinatura. Cada passo falha sozinho, sem derrubar os outros. */
/**
 * O contrato traz dados que o Deskcomm não tinha: devolve ao contato (nome, e-mail, endereço) e aos campos do negócio (CPF, RG…)
 * o que foi digitado, e guarda a ligação com o cadastro do Sales. Cada passo falha sozinho — o contrato já foi gerado.
 */
export async function sincronizarContato(orgId: string, conversationId: string, d: Record<string, string | undefined>, pessoaId: number) {
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

export async function aplicar(orgId: string, conversationId: string, escolha: AposAssinatura, dados: Record<string, string> = {}) {
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

export async function slugDaOrg(orgId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("organizations").select("slug").eq("id", orgId).maybeSingle();
  return (data as { slug: string | null } | null)?.slug ?? null;
}


const CAMPOS_DO_NEGOCIO = ["cpf", "rg", "nacionalidade", "estado_civil", "profissao", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "sexo"] as const;

export interface ContratoCriado { contrato: ContratoPedido; mensagem: string }

/** Pede o contrato ao Sales, devolve os dados ao contato/negócio e registra "Contrato enviado" na conversa. Quem chama decide como o link chega ao cliente. */
export async function criarContratoNaConversa(p: {
  orgId: string; conversationId: string; slug: string; userId: string | null; nomeDeQuemPediu: string;
  dados: DadosDoContrato & { nome: string }; aposAssinatura?: AposAssinatura | null;
}): Promise<ContratoCriado> {
  const efetiva = escolhaEfetiva(await padraoDaOrg(p.orgId), p.aposAssinatura ?? null);
  const r = await pedirContrato(p.slug, { ...p.dados, conversa_ref: p.conversationId, criado_por: p.nomeDeQuemPediu });
  const paraOsCampos: Record<string, string> = Object.fromEntries(
    CAMPOS_DO_NEGOCIO.flatMap((k) => ((p.dados as unknown as Record<string, unknown>)[k] ? [[k, String((p.dados as unknown as Record<string, unknown>)[k])]] : [])),
  );
  // Em contrato de representado/a rogo, quem conversa pode ser o representante: não troca o nome nem o endereço do contato pelos do cliente.
  if (!p.dados.variante || p.dados.variante === "comum") {
    try { await sincronizarContato(p.orgId, p.conversationId, { ...p.dados, ...paraOsCampos } as unknown as Record<string, string | undefined>, r.pessoa_id); } catch { /* não derruba o contrato */ }
  }
  await registrarEventoNaConversa({
    organizationId: p.orgId, conversationId: p.conversationId, userId: p.userId,
    acao: "contrato_enviado", detalhe: `${p.dados.nome} · nº ${r.id}`, oculto: embutirEscolha("", efetiva, paraOsCampos),
  });
  // O funil anda sozinho: "Contrato enviado" (nunca derruba o envio; o card pode ser movido à mão)
  await moverParaEtapaDoContrato(p.orgId, p.conversationId, "enviado");
  const documentos = r.documentos?.length ? r.documentos : [{ nome: "Contrato", sign_url: r.sign_url }];
  return { contrato: r, mensagem: mensagemDoContrato(p.dados.nome, documentos, r.email_enviado) };
}

export { ErroContratoSales };

/** Contrato enviado nesta conversa nos últimos dias e ainda sem assinatura registrada (para o agente não gerar outro por engano). */
export async function contratoPendenteDaConversa(orgId: string, conversationId: string, horas = 72): Promise<{ numero: number } | null> {
  const { data } = await createAdminClient().from("conversation_notes").select("body").eq("organization_id", orgId).eq("conversation_id", conversationId).like("body", "%Contrato %").gte("created_at", new Date(Date.now() - horas * 3_600_000).toISOString());
  const corpos = ((data ?? []) as { body: string }[]).map((n) => n.body);
  const numeros = (rx: RegExp) => new Set(corpos.filter((b) => rx.test(b)).map((b) => Number(/nº (\d+)/.exec(b)?.[1])).filter(Number.isInteger));
  const assinados = numeros(/Contrato assinado/);
  const pendente = [...numeros(/Contrato enviado/)].filter((n) => !assinados.has(n)).sort((a, b) => b - a)[0];
  return pendente === undefined ? null : { numero: pendente };
}
