/**
 * Fork Sales — funil pronto para escritório de advocacia.
 *
 * Cada escritório que entra no sistema começa com o funil genérico (Novo / Em andamento / Ganho / Perdido). Este modelo cria, em um clique,
 * o funil do atendimento jurídico JÁ LIGADO ao agente: `agent_stage_hint` diz a que passo do atendimento cada etapa corresponde, então o
 * agente move o card sozinho (Novo contato → Em triagem → Aguardando documentos → Proposta enviada → Contrato assinado).
 *
 * ⚠️ Cada passo do agente (`lead_state.stage`) só pode apontar para UMA etapa do funil (índice único). `contacted` fica sem etapa de propósito:
 * o card segue em "Novo contato" até o agente começar a triagem. "Contrato enviado" não tem passo do agente: quem a ocupa é o fluxo do contrato.
 * O CHECK do banco exige que `won`/`lost` coincidam com `is_won`/`is_lost`.
 */
export interface EtapaDoModelo {
  name: string;
  slug: string;
  is_won: boolean;
  is_lost: boolean;
  agent_stage_hint: "new" | "contacted" | "qualifying" | "qualified" | "negotiating" | "won" | "lost" | null;
}

export const NOME_DO_FUNIL_ADVOCACIA = "Atendimento jurídico";

export const ETAPAS_ADVOCACIA: ReadonlyArray<EtapaDoModelo> = [
  { name: "Novo contato", slug: "novo_contato", is_won: false, is_lost: false, agent_stage_hint: "new" },
  { name: "Em triagem", slug: "em_triagem", is_won: false, is_lost: false, agent_stage_hint: "qualifying" },
  { name: "Aguardando documentos", slug: "aguardando_documentos", is_won: false, is_lost: false, agent_stage_hint: "qualified" },
  { name: "Proposta enviada", slug: "proposta_enviada", is_won: false, is_lost: false, agent_stage_hint: "negotiating" },
  { name: "Contrato enviado", slug: "contrato_enviado", is_won: false, is_lost: false, agent_stage_hint: null },
  { name: "Contrato assinado", slug: "contrato_assinado", is_won: true, is_lost: false, agent_stage_hint: "won" },
  { name: "Sem interesse", slug: "sem_interesse", is_won: false, is_lost: true, agent_stage_hint: "lost" },
];
