/**
 * Fork Sales — o que o botão "Usar o texto do escritório" configura no agente, além do texto das instruções.
 *
 * NÃO mexe no que é da instalação (provedor, modelo, credencial, canal): essas escolhas continuam da pessoa. Mexe no que define um
 * agente de atendimento jurídico: nome, descrição, ferramentas (funil, agenda, passagem para humano), palavras de passagem, mensagens
 * curtas de WhatsApp e o funil "Atendimento jurídico". Tudo continua editável na tela antes de salvar.
 */
export const FERRAMENTAS_DO_AGENTE_JURIDICO: readonly string[] = [
  // funil e cadastro
  "crm_get_lead", "crm_create_lead", "crm_update_lead", "crm_move_lead_stage", "crm_list_pipelines",
  "crm_get_contact", "crm_search_contacts", "crm_propose_contact_field",
  // passagem para a equipe e notas
  "crm_request_human_handoff", "crm_add_case_note",
  // agenda (consultas, confirmações)
  "crm_list_event_types", "crm_find_free_slots", "crm_book_appointment", "crm_list_appointments",
  "crm_confirm_appointment", "crm_reschedule_appointment", "crm_cancel_appointment",
];

export const PALAVRAS_DE_PASSAGEM_JURIDICO: readonly string[] = ["falar com humano", "atendente", "pessoa real", "advogado", "advogada", "falar com o advogado"];

export const SLUG_DO_FUNIL_JURIDICO = "atendimento-juridico";

export interface PedacoDoAgente {
  name?: string;
  description: string;
  tool_ids: string[];
  handoff_keywords: string[];
  handoff_tool_enabled: boolean;
  /** Desligada de propósito: num escritório, "questão jurídica" é o assunto do atendimento, não motivo para passar a conversa. */
  handoff_legal_enabled: boolean;
  image_vision_enabled: boolean;
  split_messages: boolean;
  split_max_chars: number;
  history_message_window: number;
  pipeline_ids?: string[];
}

/** `nomeAtual` e `funis` só decidem o que NÃO sobrescrever: nome já digitado fica; sem o funil jurídico, o escopo não é alterado. */
export function pedacoDoAgenteJuridico(args: { nomeDoAgente: string; nomeAtual: string; funis: { id: string; slug: string }[]; pipelinesAtuais: string[] }): PedacoDoAgente {
  const funil = args.funis.find((f) => f.slug === SLUG_DO_FUNIL_JURIDICO);
  const nome = args.nomeAtual.trim() ? undefined : args.nomeDoAgente.trim() || "Atendimento jurídico";
  return {
    ...(nome ? { name: nome } : {}),
    description: "Assistente virtual de atendimento jurídico: recepciona, faz a triagem, organiza os documentos e leva a pessoa ao contrato.",
    tool_ids: [...FERRAMENTAS_DO_AGENTE_JURIDICO],
    handoff_keywords: [...PALAVRAS_DE_PASSAGEM_JURIDICO],
    handoff_tool_enabled: true,
    handoff_legal_enabled: false,
    image_vision_enabled: true,
    split_messages: true,
    split_max_chars: 400,
    history_message_window: 30,
    ...(funil ? { pipeline_ids: Array.from(new Set([...args.pipelinesAtuais, funil.id])) } : {}),
  };
}
