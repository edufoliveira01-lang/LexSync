/**
 * Fork Sales — funil pronto para escritório de advocacia.
 *
 * Cada escritório que entra no sistema começa com o funil genérico (Novo / Em andamento / Ganho / Perdido). Este modelo cria, em um clique,
 * o funil do atendimento jurídico JÁ LIGADO ao agente: `agent_stage_hint` diz a que passo do atendimento cada etapa corresponde, então o
 * agente move o card sozinho (Novo contato → Em triagem → Proposta enviada → Proposta aceita); o sistema move em Contrato enviado e Contrato assinado; Aguardando documentos fecha o ganho.
 *
 * ⚠️ Cada passo do agente (`lead_state.stage`) só pode apontar para UMA etapa do funil (índice único). `contacted` fica sem etapa de propósito:
 * o card segue em "Novo contato" até o agente começar a triagem. "Contrato enviado" e "Contrato assinado" não têm passo do agente: quem as ocupa é o fluxo do contrato.
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
  // Boas-vindas, recepção e apresentação.
  { name: "Novo contato", slug: "novo_contato", is_won: false, is_lost: false, agent_stage_hint: "new" },
  // O cliente desenvolveu a conversa: análise do caso, detalhamento, perguntas e viabilidade.
  { name: "Em triagem", slug: "em_triagem", is_won: false, is_lost: false, agent_stage_hint: "qualifying" },
  // Caso viável: resumo do caso e a pergunta "Você quer seguir com a gente?".
  { name: "Proposta enviada", slug: "proposta_enviada", is_won: false, is_lost: false, agent_stage_hint: "qualified" },
  // O cliente aceitou: é aqui que o agente colhe os dados e as informações para o contrato.
  { name: "Proposta aceita", slug: "proposta_aceita", is_won: false, is_lost: false, agent_stage_hint: "negotiating" },
  // Dados completos e contrato enviado: o SISTEMA move o card quando o link sai (sem passo do agente).
  { name: "Contrato enviado", slug: "contrato_enviado", is_won: false, is_lost: false, agent_stage_hint: null },
  // O cliente assinou: o SISTEMA move o card ao detectar a assinatura (sem passo do agente).
  { name: "Contrato assinado", slug: "contrato_assinado", is_won: false, is_lost: false, agent_stage_hint: null },
  // Assinado e conferido: o agente segue pedindo os documentos. É a etapa de GANHO (o funil só aceita uma), para o negócio não ser reaberto.
  { name: "Aguardando documentos", slug: "aguardando_documentos", is_won: true, is_lost: false, agent_stage_hint: "won" },
  { name: "Sem interesse", slug: "sem_interesse", is_won: false, is_lost: true, agent_stage_hint: "lost" },
];

/**
 * Os dados de qualificação que o contrato pede, como CAMPOS DO NEGÓCIO. O agente os preenche na conversa (`crm_update_lead`) e o formulário
 * "Gerar contrato" já abre com eles: os rótulos são os que `lib/sales/sugerir-dados.ts` reconhece. Quem confere e envia o contrato é a pessoa.
 */
export const CAMPOS_DE_CONTRATO_ADVOCACIA: ReadonlyArray<{ key: string; label: string; type: "text" }> = [
  { key: "cpf", label: "CPF", type: "text" }, { key: "rg", label: "RG", type: "text" },
  { key: "nacionalidade", label: "Nacionalidade", type: "text" }, { key: "estado_civil", label: "Estado civil", type: "text" },
  { key: "profissao", label: "Profissão", type: "text" }, { key: "cep", label: "CEP", type: "text" },
  { key: "logradouro", label: "Logradouro", type: "text" }, { key: "numero", label: "Número", type: "text" },
  { key: "complemento", label: "Complemento", type: "text" }, { key: "bairro", label: "Bairro", type: "text" },
  { key: "cidade", label: "Cidade", type: "text" }, { key: "uf", label: "UF", type: "text" },
];
