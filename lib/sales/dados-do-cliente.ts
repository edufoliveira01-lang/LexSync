/**
 * Fork Sales — os dados do cliente, gravados NA HORA em que ele os informa (e lidos de volta na hora do contrato).
 *
 * Por que existe: o agente perguntava de novo o que o cliente já tinha dito, porque tudo morava só na memória da conversa. Agora cada dado vai para
 * o cadastro (contato: nome, e-mail, endereço; negócio: CPF, RG, estado civil… nos campos do funil), e o contrato sai desses dados: o agente só confirma.
 * O alvo é SEMPRE o contato do turno e o negócio aberto dele — a ferramenta não recebe id nenhum.
 */
import { camposDoFunil } from "@/lib/leads/campos-do-funil";
import { valorParaOCampo, type DadosDoCliente } from "@/lib/sales/campos-do-contrato";
import { REGRAS, sem } from "@/lib/sales/sugerir-dados";
import { createAdminClient } from "@/lib/supabase/admin";

export interface DadosGravados extends DadosDoCliente { nome?: string; email?: string; data_nascimento?: string; nome_da_mae?: string }

const CAMPOS_DE_TEXTO = ["nome", "email", "data_nascimento", "nome_da_mae", "cpf", "rg", "nacionalidade", "estado_civil", "profissao", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "sexo"] as const;
export type CampoDoCliente = (typeof CAMPOS_DE_TEXTO)[number];

const vazio = (v: unknown) => v === undefined || v === null || String(v).trim() === "";
const limpa = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

/** O nome tem ao menos nome e sobrenome? É o que o contrato exige (na conversa, o primeiro nome basta). */
export const nomeCompleto = (nome: string | undefined | null): boolean => limpa(nome).split(" ").filter((p) => p.length > 1).length >= 2;

/**
 * O que falta para o contrato sair COMPLETO. Obrigatórios: o que qualifica a pessoa no contrato (nome completo, CPF, RG, nacionalidade, estado civil,
 * profissão) e o endereço (rua, número, bairro, cidade e UF). Recomendados: e-mail (a cópia vai por ele), CEP, data de nascimento e nome da mãe (comuns em procuração e petição). O agente só chama o contrato quando
 * nenhum obrigatório falta; se a pessoa realmente não tem um dado (ex.: sem RG), o agente passa a conversa à equipe em vez de gerar um contrato incompleto.
 */
export function faltaParaOContrato(d: DadosGravados): { obrigatorios: string[]; recomendados: string[] } {
  const obrigatorios: string[] = [];
  if (!nomeCompleto(d.nome)) obrigatorios.push("nome completo (nome e sobrenome)");
  if (limpa(d.cpf).replace(/\D/g, "").length < 11) obrigatorios.push("CPF");
  for (const [k, rotulo] of [["rg", "RG"], ["nacionalidade", "nacionalidade"], ["estado_civil", "estado civil"], ["profissao", "profissão"]] as const) if (vazio(d[k])) obrigatorios.push(rotulo);
  if (vazio(d.logradouro)) obrigatorios.push("endereço (rua ou avenida)");
  for (const [k, rotulo] of [["numero", "número da casa ou prédio"], ["bairro", "bairro"], ["cidade", "cidade"], ["uf", "UF"]] as const) if (vazio(d[k])) obrigatorios.push(rotulo);
  const recomendados = ([["email", "e-mail"], ["cep", "CEP"], ["data_nascimento", "data de nascimento"], ["nome_da_mae", "nome da mãe"]] as const).filter(([k]) => vazio(d[k])).map(([, rotulo]) => rotulo);
  return { obrigatorios, recomendados };
}

interface ContatoRow { name: string | null; display_name: string | null; email: string | null; street: string | null; number: string | null; complement: string | null; district: string | null; city: string | null; state: string | null; zip_code: string | null }
interface NegocioRow { id: string; custom_fields: Record<string, unknown> | null; crm_pipelines: { settings?: Record<string, unknown> } | { settings?: Record<string, unknown> }[] | null }

async function negociosAbertos(orgId: string, contactId: string): Promise<NegocioRow[]> {
  const { data } = await createAdminClient().from("crm_leads").select("id, custom_fields, crm_pipelines(settings)").eq("organization_id", orgId).eq("contact_id", contactId).eq("status", "open").order("created_at", { ascending: false }).limit(3);
  return (data ?? []) as unknown as NegocioRow[];
}
const defsDoNegocio = (n: NegocioRow) => camposDoFunil((Array.isArray(n.crm_pipelines) ? n.crm_pipelines[0] : n.crm_pipelines)?.settings ?? null);

/** O que já está gravado deste contato (contato + campos do negócio aberto). */
export async function lerDadosGravados(orgId: string, contactId: string): Promise<DadosGravados> {
  const admin = createAdminClient();
  const { data: ct } = await admin.from("contacts").select("name, display_name, email, street, number, complement, district, city, state, zip_code, custom_fields").eq("id", contactId).eq("organization_id", orgId).maybeSingle();
  const c = (ct ?? {}) as Partial<ContatoRow> & { custom_fields?: Record<string, unknown> | null };
  // base: tudo o que o agente já gravou no contato (vale mesmo sem negócio aberto)
  const guardados = ((c.custom_fields?.sales as { dados?: Record<string, unknown> } | undefined)?.dados ?? {});
  const d: DadosGravados = {};
  for (const k of CAMPOS_DE_TEXTO) if (!vazio(guardados[k])) (d as Record<string, string>)[k] = limpa(guardados[k]);
  const nome = limpa(c.name || c.display_name);
  if (nome && (!d.nome || nomeCompleto(nome) || !nomeCompleto(d.nome))) d.nome = nome;
  if (!vazio(c.email)) d.email = limpa(c.email);
  if (!vazio(c.street)) d.logradouro = limpa(c.street);
  if (!vazio(c.number)) d.numero = limpa(c.number);
  if (!vazio(c.complement)) d.complemento = limpa(c.complement);
  if (!vazio(c.district)) d.bairro = limpa(c.district);
  if (!vazio(c.city)) d.cidade = limpa(c.city);
  if (!vazio(c.state)) d.uf = limpa(c.state).toUpperCase().slice(0, 2);
  if (!vazio(c.zip_code)) d.cep = limpa(c.zip_code);
  for (const n of await negociosAbertos(orgId, contactId)) {
    for (const def of defsDoNegocio(n)) {
      const v = n.custom_fields?.[def.key];
      if (vazio(v)) continue;
      const regra = REGRAS.find(([, rx]) => rx.test(sem(def.label)));
      if (!regra) continue;
      const campo = regra[0] as keyof DadosGravados;
      if (vazio((d as Record<string, unknown>)[campo])) (d as Record<string, string>)[campo] = limpa(v);
    }
  }
  return d;
}

/** Grava o que o cliente acabou de informar. Só toca nos campos recebidos; devolve o que ficou gravado. */
export async function gravarDadosDoCliente(orgId: string, contactId: string, novos: Partial<Record<CampoDoCliente, string>>): Promise<DadosGravados> {
  const admin = createAdminClient();
  const recebidos: Record<string, string> = {};
  for (const k of CAMPOS_DE_TEXTO) { const v = novos[k]; if (!vazio(v)) recebidos[k] = limpa(v); }
  if (recebidos.uf) recebidos.uf = recebidos.uf.toUpperCase().slice(0, 2);
  if (recebidos.cpf) recebidos.cpf = recebidos.cpf.replace(/[^\d.\-/]/g, "").trim();

  const patch: Record<string, unknown> = {};
  if (Object.keys(recebidos).length) {
    const { data: atual } = await admin.from("contacts").select("custom_fields").eq("id", contactId).eq("organization_id", orgId).maybeSingle();
    const cf = ((atual as { custom_fields: Record<string, unknown> | null } | null)?.custom_fields ?? {}) as Record<string, unknown>;
    const sales = (typeof cf.sales === "object" && cf.sales ? cf.sales : {}) as Record<string, unknown>;
    patch.custom_fields = { ...cf, sales: { ...sales, dados: { ...((sales.dados as Record<string, unknown> | undefined) ?? {}), ...recebidos } } };
  }
  if (recebidos.nome) patch.name = recebidos.nome;
  if (recebidos.email) patch.email = recebidos.email;
  if (recebidos.logradouro) patch.street = recebidos.logradouro;
  if (recebidos.numero) patch.number = recebidos.numero;
  if (recebidos.complemento) patch.complement = recebidos.complemento;
  if (recebidos.bairro) patch.district = recebidos.bairro;
  if (recebidos.cidade) patch.city = recebidos.cidade;
  if (recebidos.uf) patch.state = recebidos.uf;
  if (recebidos.cep) patch.zip_code = recebidos.cep.replace(/\D/g, "");
  if (Object.keys(patch).length) {
    let { error } = await admin.from("contacts").update(patch).eq("id", contactId).eq("organization_id", orgId);
    // e-mail já usado por outro contato: segue sem ele (o dado continua nos campos do negócio quando houver campo para ele)
    if (error && patch.email) { delete patch.email; ({ error } = await admin.from("contacts").update(patch).eq("id", contactId).eq("organization_id", orgId)); }
    if (error) throw new Error(error.message);
  }
  // campos do negócio aberto (CPF, RG, estado civil…): reconhecidos pelo rótulo, como o formulário de contrato
  for (const n of await negociosAbertos(orgId, contactId)) {
    const novosCampos: Record<string, string> = {};
    for (const def of defsDoNegocio(n)) {
      const v = valorParaOCampo(def.label, recebidos as DadosDoCliente);
      if (v !== null) novosCampos[def.key] = v;
    }
    if (Object.keys(novosCampos).length) await admin.from("crm_leads").update({ custom_fields: { ...(n.custom_fields ?? {}), ...novosCampos } }).eq("id", n.id).eq("organization_id", orgId);
  }
  return lerDadosGravados(orgId, contactId);
}
