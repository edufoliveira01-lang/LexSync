/**
 * Fork Sales — os números do ATENDIMENTO que aparecem na tela Início do Sales: quantos leads chegaram em cada mês, quantos foram qualificados,
 * quantos desqualificados, quantos perderam o interesse e onde estão os que seguem em atendimento.
 *
 * O Deskcomm calcula e EMPURRA um retrato para o escritório (mesmo canal assinado dos contratos) a cada 30 minutos. O Sales só guarda e mostra.
 * A conta é por COORTE: «neste mês» são os leads que NASCERAM neste mês e como estão agora (as etapas se leem pelo NOME, que é o que o dono vê).
 */
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

import { configDosContratos, enviarIndicadoresDoAtendimento } from "./contratos";

export type Situacao = "desqualificado" | "sem_interesse" | "qualificado" | "em_andamento";
export interface EtapaLida { id: string; name: string; is_lost: boolean; is_won: boolean; position: number | null }
export interface LeadLido { created_at: string; status: string; stage_id: string; source?: string | null; tags?: string[] | null; contacts?: { tags?: string[] | null } | Array<{ tags?: string[] | null }> | null }

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

export function montarRetrato(leads: readonly LeadLido[], abertos: readonly { stage_id: string }[], etapas: readonly EtapaLida[], agora = new Date()) {
  const porId = new Map(etapas.map((e) => [e.id, e]));
  const meses = ultimosMesesDoRetrato(mesDeBrasilia(agora.toISOString()));
  const base = new Map<string, MesDoRetrato>(meses.map((m) => [m, { mes: m, novos: 0, qualificados: 0, desqualificados: 0, sem_interesse: 0, em_andamento: 0, fontes: {} }]));
  for (const l of leadsQueContam(leads)) {
    const linha = base.get(mesDeBrasilia(l.created_at));
    if (!linha) continue;
    linha.novos++;
    const fonte = String(l.source ?? "").trim().slice(0, 60);
    if (fonte) linha.fontes[fonte] = (linha.fontes[fonte] ?? 0) + 1;
    const s = situacaoDoLead(l, porId.get(l.stage_id));
    if (s === "qualificado") linha.qualificados++; else if (s === "desqualificado") linha.desqualificados++; else if (s === "sem_interesse") linha.sem_interesse++; else linha.em_andamento++;
  }
  const contagem = new Map<string, number>();
  for (const a of abertos) contagem.set(a.stage_id, (contagem.get(a.stage_id) ?? 0) + 1);
  const por_etapa = [...contagem].flatMap(([id, total]) => {
    const e = porId.get(id);
    return e && !e.is_lost && !e.is_won ? [{ nome: e.name, total, posicao: Number(e.position ?? 0) }] : [];
  }).sort((a, b) => a.posicao - b.posicao);
  return { meses: [...base.values()], por_etapa, abertos: abertos.length };
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
  const leads = await lerTudo<LeadLido>((de, ate) => admin.from("crm_leads").select("created_at, status, stage_id, source, tags, contacts(tags)").eq("organization_id", orgId).gte("created_at", desde).order("created_at").range(de, ate));
  const abertos = await lerTudo<{ stage_id: string }>((de, ate) => admin.from("crm_leads").select("stage_id").eq("organization_id", orgId).eq("status", "open").range(de, ate), 5);
  return montarRetrato(leads, abertos, etapas, agora);
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

let iniciado = false;
export function iniciarEnvioDosIndicadores(): void {
  if (iniciado || !configDosContratos()) return;
  iniciado = true;
  const rodar = () => { void enviarRetratos().catch(() => undefined); };
  setTimeout(rodar, 3 * 60_000).unref?.();
  setInterval(rodar, 30 * 60_000).unref?.();
}
