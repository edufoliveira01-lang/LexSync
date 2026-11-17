/**
 * Fork Sales — os números do ATENDIMENTO que aparecem na tela Início do Sales: quantos leads chegaram em cada mês, quantos foram qualificados,
 * quantos desqualificados, quantos perderam o interesse e onde estão os que seguem em atendimento.
 *
 * O Deskcomm calcula e EMPURRA um retrato para o escritório (mesmo canal assinado dos contratos) por eventos (negócio criado, mudou de etapa, ganho ou perdido: em poucos segundos) e, como rede de segurança, a cada 10 minutos. O Sales só guarda e mostra.
 * A conta é por COORTE: «neste mês» são os leads que NASCERAM neste mês e como estão agora (as etapas se leem pelo NOME, que é o que o dono vê).
 */
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

import { configDosContratos, enviarIndicadoresDoAtendimento } from "./contratos";

export type Situacao = "desqualificado" | "sem_interesse" | "qualificado" | "em_andamento";
export interface EtapaLida { id: string; name: string; is_lost: boolean; is_won: boolean; position: number | null }
export interface LeadLido { id?: string; lost_reason?: string | null; created_at: string; status: string; stage_id: string; pipeline_id?: string | null; contact_id?: string | null; source?: string | null; tags?: string[] | null; contacts?: { tags?: string[] | null } | Array<{ tags?: string[] | null }> | null }

/** A etiqueta que o agente (ou a equipe) põe quando a pessoa é um contato NOVO — só estes contam como «lead que entrou». */
export const ETIQUETA_DE_LEAD = "lead";
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const temEtiquetaDeLead = (l: LeadLido): boolean => {
  const c = Array.isArray(l.contacts) ? l.contacts[0] : l.contacts;
  return [...(l.tags ?? []), ...(c?.tags ?? [])].some((t) => semAcento(String(t)) === ETIQUETA_DE_LEAD);
};
/**
 * Funcionário, cliente que volta a falar e número de teste também abrem card. Depois que a etiqueta «Lead» entra em uso, só conta quem a tem.
 * O que nasceu ANTES do primeiro lead etiquetado segue contado como estava (o histórico não zera). Sem nenhum etiquetado, conta tudo.
 */
export function leadsQueContam<T extends LeadLido>(leads: readonly T[]): T[] {
  const etiquetados = leads.filter(temEtiquetaDeLead);
  if (etiquetados.length === 0) return [...leads];
  const corte = etiquetados.reduce((m, l) => (l.created_at < m ? l.created_at : m), etiquetados[0]!.created_at);
  return leads.filter((l) => l.created_at < corte || temEtiquetaDeLead(l));
}

/**
 * Quem NUNCA foi lead: vendedor, spam, propaganda, número errado, assunto que não é do escritório. Entra no funil como cartão (o agente
 * atende e se despede), mas contar como «Chegaram» e «Sem interesse» infla a captação. Reconhecido pelo motivo da perda ou pelo detalhe
 * que a equipe escreveu ao perder («Outro: Vendedor/Spam/Marketing»).
 */
const NAO_E_LEAD = /(\bspam\b|vendedor|marketing|propaganda|nao e lead|nao eh lead|numero errado|fora do escritorio|oferta de (servico|produto))/;
export const ehNaoLead = (texto: string | null | undefined): boolean => NAO_E_LEAD.test(semAcento(String(texto ?? "")));

export interface MesDoRetrato { mes: string; novos: number; qualificados: number; desqualificados: number; sem_interesse: number; em_andamento: number; fontes: Record<string, number> }

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** O mês (YYYY-MM) no horário de Brasília (UTC-3). */
export const mesDeBrasilia = (iso: string): string => new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().slice(0, 7);

/** Em que situação o lead está, pelo nome da etapa e pelo desfecho. */
export function situacaoDoLead(lead: Pick<LeadLido, "status">, etapa: Pick<EtapaLida, "name" | "is_lost" | "is_won"> | undefined): Situacao {
  const nome = norm(etapa?.name ?? "");
  if (/desqualific/.test(nome)) return "desqualificado";
  if (lead.status === "lost" || etapa?.is_lost) return "sem_interesse";
  if (lead.status === "won" || etapa?.is_won || /(proposta|contrato|assinad|document)/.test(nome)) return "qualificado";
  return "em_andamento";
}

/** Os últimos `n` meses terminando em `ate` (YYYY-MM), do mais antigo ao mais novo. */
export function ultimosMesesDoRetrato(ate: string, n = 12): string[] {
  const [a, m] = ate.split("-").map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(a, m - 1 - (n - 1 - i), 1)); return d.toISOString().slice(0, 7); });
}

/**
 * QUEM ENTRA NA CONTA. A tela Início separa dois públicos:
 *  - LEAD / primeira vez: cartões dos funis comuns. É o que o funil «Chegaram → Passaram da triagem → …» mede.
 *  - CLIENTE: cartões de funis marcados como «funil de clientes» (`crm_pipelines.is_client_pipeline`, ex.: «Andamento Jurídico»). Quem já é
 *    cliente NÃO é captação: não entra no funil acima e aparece à parte (`clientes`).
 * Dentro dos leads, uma PESSOA conta UMA vez por mês (a pessoa que perdeu o interesse e voltou abre outro cartão: é o mesmo lead).
 * A situação da pessoa é a do cartão mais recente do mês.
 */
export function montarRetrato(
  leads: readonly LeadLido[],
  abertos: readonly { stage_id: string; pipeline_id?: string | null }[],
  etapas: readonly EtapaLida[],
  agora = new Date(),
  funisDeCliente: ReadonlySet<string> = new Set(),
  naoLeads: ReadonlySet<string> = new Set(),
) {
  const porId = new Map(etapas.map((e) => [e.id, e]));
  const meses = ultimosMesesDoRetrato(mesDeBrasilia(agora.toISOString()));
  const base = new Map<string, MesDoRetrato>(meses.map((m) => [m, { mes: m, novos: 0, qualificados: 0, desqualificados: 0, sem_interesse: 0, em_andamento: 0, fontes: {} }]));
  const ehCliente = (l: { pipeline_id?: string | null }) => Boolean(l.pipeline_id && funisDeCliente.has(l.pipeline_id));
  const naoELead = (l: LeadLido) => (l.id !== undefined && naoLeads.has(l.id)) || (l.status === "lost" && ehNaoLead(l.lost_reason));
  const deLead = leadsQueContam(leads.filter((l) => !ehCliente(l) && !naoELead(l)));

  // uma pessoa por mês: o cartão mais recente decide a situação; a fonte é a do primeiro cartão
  const porPessoa = new Map<string, LeadLido[]>();
  deLead.forEach((l, i) => {
    const chave = l.contact_id ? `${mesDeBrasilia(l.created_at)}|${l.contact_id}` : `sem-contato|${i}`;
    porPessoa.set(chave, [...(porPessoa.get(chave) ?? []), l]);
  });
  for (const cartoes of porPessoa.values()) {
    const ordenados = [...cartoes].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    const primeiro = ordenados[0]!;
    const ultimo = ordenados[ordenados.length - 1]!;
    const linha = base.get(mesDeBrasilia(primeiro.created_at));
    if (!linha) continue;
    linha.novos++;
    const fonte = String(primeiro.source ?? "").trim().slice(0, 60);
    if (fonte) linha.fontes[fonte] = (linha.fontes[fonte] ?? 0) + 1;
    const s = situacaoDoLead(ultimo, porId.get(ultimo.stage_id));
    if (s === "qualificado") linha.qualificados++; else if (s === "desqualificado") linha.desqualificados++; else if (s === "sem_interesse") linha.sem_interesse++; else linha.em_andamento++;
  }

  const contar = (itens: readonly { stage_id: string }[]) => {
    const contagem = new Map<string, number>();
    for (const a of itens) contagem.set(a.stage_id, (contagem.get(a.stage_id) ?? 0) + 1);
    return [...contagem].flatMap(([id, total]) => {
      const e = porId.get(id);
      return e && !e.is_lost && !e.is_won ? [{ nome: e.name, total, posicao: Number(e.position ?? 0) }] : [];
    }).sort((a, b) => a.posicao - b.posicao);
  };
  const abertosDeLead = abertos.filter((a) => !ehCliente(a));
  const abertosDeCliente = abertos.filter((a) => ehCliente(a));
  return {
    meses: [...base.values()],
    por_etapa: contar(abertosDeLead),
    abertos: abertosDeLead.length,
    // Quem já é cliente: acompanhado à parte, fora da conta de captação.
    clientes: { abertos: abertosDeCliente.length, por_etapa: contar(abertosDeCliente) },
  };
}

const TAMANHO_DA_PAGINA = 1000;
async function lerTudo<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>, maximo = 10): Promise<T[]> {
  const todas: T[] = [];
  for (let p = 0; p < maximo; p++) {
    const { data, error } = await consulta(p * TAMANHO_DA_PAGINA, (p + 1) * TAMANHO_DA_PAGINA - 1);
    if (error || !data) break;
    todas.push(...(data as T[]));
    if (data.length < TAMANHO_DA_PAGINA) break;
  }
  return todas;
}

/** Calcula o retrato de UMA organização no banco do atendimento. */
export async function calcularRetratoDaOrganizacao(orgId: string, agora = new Date()) {
  const admin = createAdminClient();
  const meses = ultimosMesesDoRetrato(mesDeBrasilia(agora.toISOString()));
  const desde = new Date(Date.parse(`${meses[0]}-01T03:00:00Z`)).toISOString();
  const etapas = await lerTudo<EtapaLida>((de, ate) => admin.from("crm_stages").select("id, name, is_lost, is_won, position").eq("organization_id", orgId).range(de, ate));
  const leads = await lerTudo<LeadLido>((de, ate) => admin.from("crm_leads").select("id, lost_reason, created_at, status, stage_id, pipeline_id, contact_id, source, tags, contacts(tags)").eq("organization_id", orgId).gte("created_at", desde).order("created_at").range(de, ate));
  const abertos = await lerTudo<{ stage_id: string; pipeline_id: string | null }>((de, ate) => admin.from("crm_leads").select("stage_id, pipeline_id").eq("organization_id", orgId).eq("status", "open").range(de, ate), 5);
  const { data: funis } = await admin.from("crm_pipelines").select("id").eq("organization_id", orgId).eq("is_client_pipeline", true);
  const funisDeCliente = new Set(((funis ?? []) as Array<{ id: string }>).map((f) => f.id));
  // O detalhe que a equipe escreveu ao perder («Outro: Vendedor/Spam/Marketing») fica na linha do tempo, não no motivo gravado.
  const naoLeads = new Set<string>();
  const perdidos = leads.filter((l) => l.status === "lost" && l.id).map((l) => l.id as string);
  for (let i = 0; i < perdidos.length; i += 200) {
    const { data: ativ } = await admin.from("crm_lead_activities").select("lead_id, reason, payload").eq("organization_id", orgId).eq("type", "demand_closed").in("lead_id", perdidos.slice(i, i + 200));
    for (const a of (ativ ?? []) as Array<{ lead_id: string; reason: string | null; payload: { detalhe?: unknown } | null }>) {
      if (ehNaoLead(a.reason) || ehNaoLead(typeof a.payload?.detalhe === "string" ? a.payload.detalhe : "")) naoLeads.add(a.lead_id);
    }
  }
  return montarRetrato(leads, abertos, etapas, agora, funisDeCliente, naoLeads);
}

export async function enviarRetratos(): Promise<void> {
  if (!configDosContratos()) return;
  const admin = createAdminClient();
  const { data } = await admin.from("organizations").select("id, slug").not("slug", "is", null).limit(500);
  for (const org of (data ?? []) as Array<{ id: string; slug: string | null }>) {
    try {
      if (!org.slug) continue;
      await enviarIndicadoresDoAtendimento(org.slug, await calcularRetratoDaOrganizacao(org.id));
    } catch (e) {
      logger.warn("[indicadores-do-atendimento] não consegui enviar o retrato", { org: org.id, erro: e instanceof Error ? e.message.slice(0, 160) : String(e).slice(0, 160) });
    }
  }
}

/** Manda o retrato de UMA organização (quando algo muda no funil). Melhor esforço: nunca lança. */
export async function enviarRetratoDaOrganizacao(orgId: string): Promise<void> {
  try {
    if (!configDosContratos()) return;
    const admin = createAdminClient();
    const { data } = await admin.from("organizations").select("slug").eq("id", orgId).maybeSingle();
    const slug = (data as { slug: string | null } | null)?.slug;
    if (!slug) return;
    await enviarIndicadoresDoAtendimento(slug, await calcularRetratoDaOrganizacao(orgId));
  } catch (e) {
    logger.warn("[indicadores-do-atendimento] não consegui enviar o retrato da organização", { org: orgId, erro: e instanceof Error ? e.message.slice(0, 160) : String(e).slice(0, 160) });
  }
}

/**
 * Tempo real, na prática: quando um negócio nasce, muda de etapa, é ganho ou perdido, o retrato daquela organização segue em poucos
 * segundos. Vários eventos seguidos (um turno do agente mexe em etapa e etiqueta) viram UM envio: espera `atrasoMs` depois do último.
 */
const agendados = new Map<string, ReturnType<typeof setTimeout>>();
export function agendarRetratoDaOrganizacao(orgId: string, atrasoMs = 8_000): void {
  if (!configDosContratos()) return;
  const anterior = agendados.get(orgId);
  if (anterior) clearTimeout(anterior);
  const t = setTimeout(() => { agendados.delete(orgId); void enviarRetratoDaOrganizacao(orgId); }, atrasoMs);
  t.unref?.();
  agendados.set(orgId, t);
}

let iniciado = false;
export function iniciarEnvioDosIndicadores(): void {
  if (iniciado || !configDosContratos()) return;
  iniciado = true;
  const rodar = () => { void enviarRetratos().catch(() => undefined); };
  setTimeout(rodar, 3 * 60_000).unref?.();
  // Rede de segurança: o envio por evento (acima) é o caminho normal; este corrige qualquer evento perdido.
  setInterval(rodar, 10 * 60_000).unref?.();
}
