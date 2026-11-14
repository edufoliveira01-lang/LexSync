/**
 * Fork Sales — anotações internas do chat: o que o AGENTE (e o sistema) fez na conversa, visível só para a equipe.
 *
 * Cada ação relevante vira uma linha centralizada na conversa ("Agente de IA: moveu o negócio para «Proposta aceita»"). Reaproveita a nota interna com a marca
 * de evento (`MARCA_DE_EVENTO`): nunca sai para o cliente e aparece em tempo real, sem migration. Nunca derruba a ação que anota (tudo é melhor-esforço).
 */
import { MARCA_DE_EVENTO } from "@/lib/inbox/evento-na-conversa-marca";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const QUEM_AGENTE = "Agente de IA";
export const QUEM_SISTEMA = "Sistema";

const ROTULOS_DOS_DADOS: Record<string, string> = {
  nome: "nome", email: "e-mail", data_nascimento: "data de nascimento", nome_da_mae: "nome da mãe", cpf: "CPF", rg: "RG", nacionalidade: "nacionalidade", sexo: "sexo", estado_civil: "estado civil", profissao: "profissão",
  cep: "CEP", logradouro: "rua", numero: "número", complemento: "complemento", bairro: "bairro", cidade: "cidade", uf: "UF",
};

/** A frase da ação, pelo nome da ferramenta e o que foi enviado. `null` = não anota. As frases NUNCA levam o valor do dado (só o nome do campo). */
export function frasesDaFerramenta(nome: string, entrada: Record<string, unknown>): string | null {
  switch (nome) {
    case "crm_registrar_dados_do_cliente": {
      const campos = Object.keys(entrada).filter((k) => entrada[k] !== undefined && entrada[k] !== null && String(entrada[k]).trim() !== "").map((k) => ROTULOS_DOS_DADOS[k] ?? k);
      return campos.length > 0 ? `gravou no cadastro: ${campos.join(", ")}` : null;
    }
    case "crm_passar_para_agente": {
      const ag = String(entrada.agente ?? "").trim();
      return ag ? `passou a conversa para o agente «${ag}»${String(entrada.funil ?? "").trim() ? ` (funil ${String(entrada.funil).trim()})` : ""}` : null;
    }
    case "crm_anotar_no_sales": return String(entrada.processo ?? "").trim() ? "anotou no processo do cliente, no Sales" : "anotou no cadastro do cliente, no Sales";
    case "crm_notificar_equipe": {
      const nome = String(entrada.notificacao ?? "").trim();
      return nome ? `avisou a equipe por WhatsApp («${nome}»)` : null;
    }
    case "crm_salvar_documento_do_cliente": {
      // Sem argumentos é só a listagem: não anota. Com os três campos, diz qual documento e em que pasta (nunca o conteúdo).
      const tipo = String(entrada.tipo ?? "").trim();
      const titulo = String(entrada.titulo ?? "").trim();
      if (!tipo || !titulo) return null;
      return tipo === "A CLASSIFICAR"
        ? `guardou o documento «${titulo}» em A CLASSIFICAR: a equipe precisa classificar`
        : `guardou o documento «${titulo}» na pasta ${tipo} do cliente (vai para o drive depois da assinatura do contrato)`;
    }
    case "crm_update_lead": return "atualizou dados do negócio";
    case "crm_create_lead": return "criou o negócio";
    case "crm_book_appointment":
    case "crm_find_and_book_appointment": return "marcou um compromisso na agenda";
    case "crm_reschedule_appointment": return "remarcou um compromisso";
    case "crm_cancel_appointment": return "cancelou um compromisso";
    case "crm_confirm_appointment": return "confirmou um compromisso";
    default: return null;
  }
}

const moeda = (n: unknown) => (typeof n === "number" ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "");

/** As consultas do Sales que o agente faz (nome da ferramenta → o que foi consultado, na frase da conversa). */
const CONSULTAS_DO_SALES: Record<string, string> = {
  consultar_cliente: "o cadastro do cliente",
  andamento_do_processo: "o andamento do processo",
  proximos_compromissos: "os próximos compromissos do cliente",
  financeiro_do_cliente: "o financeiro do cliente",
  documentos_do_cliente: "os documentos do cliente",
};

/**
 * O que o agente CONSULTOU na base jurídica (leituras não gravam nada, então não passavam pela anotação): a equipe vê na conversa que a resposta veio da
 * ficha (com a data da revisão e a fonte) e da calculadora, e não da memória do modelo. `null` = não anota.
 */
export function frasesDeConsulta(nome: string, resultado: unknown): string | null {
  const r = (resultado && typeof resultado === "object" ? resultado : {}) as Record<string, unknown>;
  if (nome === "crm_consultar_base_juridica") {
    if (r.cobertura === false) return "consultou a base jurídica: o tema não está na base (respondeu só o que é geral e disse que o advogado confirma)";
    const f = (r.ficha ?? {}) as { titulo?: string; revisado_em?: string; status?: string; fontes?: { url?: string }[] };
    if (!f.titulo) return null;
    const hosts = [...new Set((f.fontes ?? []).map((x) => { try { return new URL(String(x.url)).hostname.replace(/^www\./, ""); } catch { return ""; } }).filter(Boolean))].slice(0, 3);
    const aviso = Array.isArray(r.aviso) && r.aviso.length > 0 ? " · com ressalva (ficha ainda sem a conferência de um advogado)" : "";
    return `consultou a base jurídica: ${f.titulo} (revisada em ${f.revisado_em ?? "?"}${hosts.length ? ` · fontes: ${hosts.join(", ")}` : ""})${aviso}`;
  }
  // As consultas do Sales (servidor MCP externo, só leitura): a equipe vê na conversa que o agente consultou o cadastro e o que voltou. O resultado vem como
  // `{ texto, dados }`; `dados.encontrado` diz se o telefone está no cadastro. A frase NUNCA leva nome, CPF, número de processo nem valor: só o desfecho.
  const base = nome.replace(/^.*__/, "");
  const objeto = CONSULTAS_DO_SALES[base];
  if (objeto) {
    const dados = (r.dados && typeof r.dados === "object" ? r.dados : {}) as Record<string, unknown>;
    if (dados.encontrado === false) return `consultou ${objeto}: nenhum cliente localizado pelo telefone da conversa`;
    if (dados.ambiguo === true) return `consultou ${objeto}: mais de um cadastro com este telefone (a identidade precisa ser confirmada)`;
    if (base === "consultar_cliente") {
      const n = Array.isArray(dados.processos) ? dados.processos.length : null;
      return `consultou ${objeto}: cliente localizado${n !== null ? ` (${n} ${n === 1 ? "processo" : "processos"})` : ""}`;
    }
    return `consultou ${objeto}`;
  }
  if (nome === "crm_calcular_renda_per_capita") {
    if (typeof r.renda_per_capita !== "number") return null;
    return `calculou a renda por pessoa: ${moeda(r.renda_per_capita)} (1/4 do salário mínimo: ${moeda(r.limite_um_quarto)} · 1/2: ${moeda(r.limite_meio)} · salário mínimo ${moeda(r.salario_minimo)}${r.salario_minimo_confirmado === false ? ", a confirmar" : ""})`;
  }
  return null;
}

async function conversaDoContato(admin: ReturnType<typeof createAdminClient>, orgId: string, contactId: string): Promise<string | null> {
  const { data } = await admin.from("conversations").select("id").eq("organization_id", orgId).eq("contact_id", contactId).order("last_inbound_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Grava a linha na conversa MAIS RECENTE do contato. Melhor-esforço: qualquer falha vira aviso no log. */
export async function anotarNaConversaDoContato(orgId: string, contactId: string, texto: string, quem: string = QUEM_AGENTE): Promise<void> {
  try {
    const admin = createAdminClient();
    const conversationId = await conversaDoContato(admin, orgId, contactId);
    if (!conversationId) return;
    await admin.from("conversation_notes").insert({
      organization_id: orgId, conversation_id: conversationId, body: `${MARCA_DE_EVENTO}${quem}: ${texto}`, created_by_user_id: null, created_by_name: quem,
    });
  } catch (err) {
    logger.warn("[inbox.acao-do-agente] não consegui anotar na conversa", { contact_id: contactId, erro: err instanceof Error ? err.message : String(err) });
  }
}

/** "moveu o negócio para «Etapa»": lê a etapa ATUAL do negócio aberto do contato (vale para o espelho do funil, a ferramenta e o sistema). Duas consultas simples (sem embutir tabela). */
export async function anotarMovimentoDoNegocio(orgId: string, contactId: string, quem: string = QUEM_AGENTE, prefixo = "moveu o negócio para"): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: lead, error } = await admin.from("crm_leads").select("stage_id").eq("organization_id", orgId).eq("contact_id", contactId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (error || !lead) { if (error) logger.warn("[inbox.acao-do-agente] não consegui ler o negócio", { contact_id: contactId, erro: error.message }); return; }
    const { data: etapa, error: erroEtapa } = await admin.from("crm_stages").select("name").eq("id", (lead as { stage_id: string }).stage_id).maybeSingle();
    if (erroEtapa) { logger.warn("[inbox.acao-do-agente] não consegui ler a etapa", { contact_id: contactId, erro: erroEtapa.message }); return; }
    const nome = (etapa as { name?: string } | null)?.name?.trim();
    if (nome) await anotarNaConversaDoContato(orgId, contactId, `${prefixo} «${nome}»`, quem);
  } catch (err) {
    logger.warn("[inbox.acao-do-agente] não consegui anotar o movimento do negócio", { contact_id: contactId, erro: err instanceof Error ? err.message : String(err) });
  }
}

const PASSOS_DO_AGENTE: Record<string, string> = { new: "novo contato", contacted: "primeiro contato", qualifying: "triagem", qualified: "caso qualificado", negotiating: "negociação", won: "ganho", lost: "perdido" };

/** O que o agente fez com uma ferramenta NATIVA do motor (as do catálogo CRM já são anotadas em `wrapMcpTool`). `null` = não anota. */
export function frasesDaFerramentaNativa(nome: string, entrada: Record<string, unknown>, estado: "ok" | "falhou" | "bloqueada"): string | null {
  const curto = (v: unknown, n = 100) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const base = (() => {
    switch (nome) {
      case "update_lead_state": {
        const passo = typeof entrada.stage === "string" ? (PASSOS_DO_AGENTE[entrada.stage] ?? entrada.stage) : null;
        return passo ? `marcou o atendimento como «${passo}»` : "atualizou o estado do atendimento";
      }
      case "save_lead_note": return "salvou uma observação sobre o cliente";
      case "request_human_handoff": return `passou a conversa para a equipe${curto(entrada.reason) ? ` — ${curto(entrada.reason)}` : ""}`;
      case "open_human_case": return `abriu um chamado para a equipe${curto(entrada.title) ? `: ${curto(entrada.title)}` : ""}`;
      case "provide_case_update": return "atualizou um chamado da equipe";
      default: return null;
    }
  })();
  if (base === null) return null;
  return estado === "ok" ? base : `tentou ${base.replace(/^(marcou|atualizou|salvou|passou|abriu)\b/, (m) => ({ marcou: "marcar", atualizou: "atualizar", salvou: "salvar", passou: "passar", abriu: "abrir" } as Record<string, string>)[m] ?? m)}, mas não foi concluído`;
}

/** Anota (melhor-esforço) o que o agente fez com uma ferramenta nativa. */
export async function anotarFerramentaNativa(orgId: string, contactId: string, e: { nome: string; estado: "ok" | "falhou" | "bloqueada"; entrada: unknown }): Promise<void> {
  const entrada = (typeof e.entrada === "object" && e.entrada !== null ? e.entrada : {}) as Record<string, unknown>;
  const frase = frasesDaFerramentaNativa(e.nome, entrada, e.estado);
  if (frase) await anotarNaConversaDoContato(orgId, contactId, frase);
}
