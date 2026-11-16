import { toolIdRemoto } from "@/lib/mcp/servidor-externo/ids";

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
  // contrato: o agente gera e envia o link de assinatura quando o cliente confirma os dados
  "crm_enviar_contrato",
  // dados do cliente: gravados na hora, para não perguntar de novo e o contrato sair só com a confirmação
  "crm_registrar_dados_do_cliente",
  // anotação na ficha do cliente no Sales (a equipe vê no cadastro)
  "crm_anotar_no_sales",
  // cobrança: o agente manda ao cliente o boleto/PIX da parcela dele (gerado no Asaas pelo Sales)
  "crm_enviar_cobranca",
  // documentos que o cliente manda pelo chat: o agente classifica e o sistema guarda no drive, depois da assinatura
  "crm_salvar_documento_do_cliente",
  // aviso à equipe por WhatsApp (central de notificações)
  "crm_notificar_equipe",
  "crm_passar_para_agente",
  // encerra a conversa quando não há mais nada a fazer (spam, fornecedor, número errado, desistência)
  "crm_encerrar_atendimento",
  // base jurídica e cálculo (BPC): responder com a ficha e a conta certa, não de memória
  "crm_consultar_base_juridica", "crm_calcular_renda_per_capita",
  // agenda: o agente consulta, confirma, remarca e desmarca; quem MARCA atendimento novo é só a equipe (por isso sem crm_book_appointment)
  "crm_list_event_types", "crm_find_free_slots", "crm_list_appointments",
  "crm_confirm_appointment", "crm_reschedule_appointment", "crm_cancel_appointment",
];

/**
 * Palavras que passam a conversa à equipe. A busca é por TRECHO do que o cliente escreve: "advogado" solto disparava a passagem em "preciso pagar o
 * advogado" ou "meu advogado antigo", antes de a IA ler a mensagem. Por isso só entram PEDIDOS explícitos de falar com alguém.
 */
export const PALAVRAS_DE_PASSAGEM_JURIDICO: readonly string[] = [
  "falar com humano", "falar com um humano", "atendente", "pessoa real",
  "falar com o advogado", "falar com a advogada", "falar com advogado", "falar com um advogado", "falar com uma advogada",
];

export const SLUG_DO_FUNIL_JURIDICO = "atendimento-juridico";

/**
 * O funil jurídico a ligar ao agente. Funil recriado nasce com o slug seguinte (`atendimento-juridico-2`, `-3`…), porque o antigo,
 * mesmo arquivado, ainda ocupa o slug: vale o de MAIOR número.
 */
export function funilJuridicoMaisRecente<T extends { slug: string }>(funis: readonly T[]): T | undefined {
  const rx = new RegExp(`^${SLUG_DO_FUNIL_JURIDICO}(?:-(\\d+))?$`);
  return funis
    .map((f) => ({ f, n: rx.exec(f.slug) }))
    .filter((x): x is { f: T; n: RegExpExecArray } => x.n !== null)
    .sort((a, b) => Number(b.n[1] ?? 1) - Number(a.n[1] ?? 1))[0]?.f;
}

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
export function pedacoDoAgenteJuridico(args: { nomeDoAgente: string; nomeAtual: string; funis: { id: string; slug: string }[]; pipelinesAtuais: string[]; ferramentasRemotas?: readonly string[] }): PedacoDoAgente {
  const funil = funilJuridicoMaisRecente(args.funis);
  const nome = args.nomeAtual.trim() ? undefined : args.nomeDoAgente.trim() || "Atendimento jurídico";
  return {
    ...(nome ? { name: nome } : {}),
    description: "Assistente virtual de atendimento jurídico: recepciona, faz a triagem, organiza os documentos e leva a pessoa ao contrato.",
    // As consultas do Sales entram como ferramentas remotas de LEITURA (a marca é nossa: o servidor só tem ferramentas que não escrevem nada).
    tool_ids: [...FERRAMENTAS_DO_AGENTE_JURIDICO, ...(args.ferramentasRemotas ?? []).map((n) => toolIdRemoto(n, "leitura"))],
    handoff_keywords: [...PALAVRAS_DE_PASSAGEM_JURIDICO],
    handoff_tool_enabled: true,
    handoff_legal_enabled: false,
    image_vision_enabled: true,
    split_messages: true,
    split_max_chars: 400,
    history_message_window: 60,
    ...(funil ? { pipeline_ids: Array.from(new Set([...args.pipelinesAtuais, funil.id])) } : {}),
  };
}
