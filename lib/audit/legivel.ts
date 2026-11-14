/**
 * Registro de auditoria em português de escritório: "Conversa assumida", não `conversation.claimed`.
 *
 * A tela mostrava a ação crua (`ai_provider_credentials.updated`), o ator como início de UUID e o JSON da metadata. Quem audita no
 * escritório (sócio, responsável pela LGPD) precisa ler QUEM fez O QUÊ e QUANDO, sem conhecer o banco. Aqui ficam as traduções;
 * o que não está no dicionário cai numa versão legível genérica, nunca vazia. É puro (sem servidor nem navegador) para ser testado.
 */

type Genero = "m" | "f";
interface Area {
  prefixo: string;
  rotulo: string;
  genero: Genero;
}

/** As áreas, da mais específica para a mais geral (casa pelo PREFIXO antes do primeiro ponto). */
export const AREAS_DA_AUDITORIA: readonly Area[] = [
  { prefixo: "message", rotulo: "Mensagem", genero: "f" },
  { prefixo: "conversation", rotulo: "Conversa", genero: "f" },
  { prefixo: "contact", rotulo: "Contato", genero: "m" },
  { prefixo: "lead", rotulo: "Negócio", genero: "m" },
  { prefixo: "pipeline", rotulo: "Funil", genero: "m" },
  { prefixo: "proposal", rotulo: "Proposta", genero: "f" },
  { prefixo: "followup_flow", rotulo: "Roteiro de follow-up", genero: "m" },
  { prefixo: "followup", rotulo: "Follow-up", genero: "m" },
  { prefixo: "template", rotulo: "Modelo de mensagem", genero: "m" },
  { prefixo: "ai_agent", rotulo: "Agente de IA", genero: "m" },
  { prefixo: "ai_provider_credentials", rotulo: "Chave do provedor de IA", genero: "f" },
  { prefixo: "ai", rotulo: "Agente de IA", genero: "m" },
  { prefixo: "channel", rotulo: "Canal", genero: "m" },
  { prefixo: "agenda", rotulo: "Agenda", genero: "f" },
  { prefixo: "member", rotulo: "Equipe", genero: "f" },
  { prefixo: "org", rotulo: "Escritório", genero: "m" },
  { prefixo: "cobranca", rotulo: "Plano e cobrança", genero: "m" },
  { prefixo: "auth", rotulo: "Acesso", genero: "m" },
  { prefixo: "authz", rotulo: "Permissão", genero: "f" },
  { prefixo: "webhook", rotulo: "Webhook", genero: "m" },
  { prefixo: "retention", rotulo: "Retenção de dados", genero: "f" },
  { prefixo: "system", rotulo: "Sistema", genero: "m" },
  { prefixo: "notification_prefs", rotulo: "Notificações", genero: "f" },
  { prefixo: "platform_branding", rotulo: "Marca da plataforma", genero: "f" },
  { prefixo: "prospecting", rotulo: "Prospecção", genero: "f" },
  { prefixo: "external_db_connection", rotulo: "Base de dados externa", genero: "f" },
  { prefixo: "nuvemshop", rotulo: "Integração de loja", genero: "f" },
];

/** O verbo (último trecho da ação), no masculino e no feminino. */
const VERBOS: Record<string, [string, string]> = {
  created: ["criado", "criada"],
  updated: ["alterado", "alterada"],
  deleted: ["excluído", "excluída"],
  archived: ["arquivado", "arquivada"],
  sent: ["enviado", "enviada"],
  received: ["recebido", "recebida"],
  closed: ["fechado", "fechada"],
  claimed: ["assumido", "assumida"],
  released: ["devolvido à fila", "devolvida à fila"],
  transferred: ["transferido", "transferida"],
  invited: ["convidado", "convidada"],
  connected: ["conectado", "conectada"],
  revoked: ["revogado", "revogada"],
  denied: ["negado", "negada"],
  failed: ["com falha", "com falha"],
  saved: ["salvo", "salva"],
  cancelled: ["cancelado", "cancelada"],
  canceled: ["cancelado", "cancelada"],
  finished: ["concluído", "concluída"],
  requested: ["solicitado", "solicitada"],
  read: ["consultado", "consultada"],
  changed: ["alterado", "alterada"],
  disabled: ["desativado", "desativada"],
  enabled: ["ativado", "ativada"],
  draft_created: ["com rascunho criado", "com rascunho criado"],
  version_created: ["com nova versão", "com nova versão"],
  logout: ["saída do sistema", "saída do sistema"],
  login: ["entrada no sistema", "entrada no sistema"],
};

function humanizar(texto: string): string {
  const t = texto.replace(/[._]+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "—";
}

export function areaDaAcao(action: string): Area | undefined {
  const mais = [...AREAS_DA_AUDITORIA].sort((a, b) => b.prefixo.length - a.prefixo.length);
  return mais.find((a) => action === a.prefixo || action.startsWith(`${a.prefixo}.`) || action.startsWith(`${a.prefixo}_`));
}

/** "conversation.claimed" → "Conversa assumida". Sem tradução: uma versão legível da própria ação. */
export function descreverAcao(action: string): string {
  const area = areaDaAcao(action);
  if (!area) return humanizar(action);
  const resto = action.slice(area.prefixo.length).replace(/^[._]+/, "");
  if (!resto) return area.rotulo;
  const verbo = VERBOS[resto] ?? VERBOS[resto.split(".").pop() ?? ""];
  if (verbo) return `${area.rotulo} ${verbo[area.genero === "f" ? 1 : 0]}`;
  return `${area.rotulo} — ${humanizar(resto).toLowerCase()}`;
}

export interface AtorDaAuditoria {
  acting_as_platform_admin: boolean;
  actor_user_id: string | null;
  actor_api_token_id: string | null;
}

/** Quem fez. `nomes` mapeia id de usuário → nome (a equipe do escritório). */
export function descreverAtor(r: AtorDaAuditoria, nomes: ReadonlyMap<string, string>): { nome: string; tipo: "pessoa" | "sistema" | "integracao" | "plataforma" } {
  if (r.acting_as_platform_admin) return { nome: "Suporte da plataforma", tipo: "plataforma" };
  if (r.actor_user_id) return { nome: nomes.get(r.actor_user_id) ?? "Usuário removido ou externo", tipo: "pessoa" };
  if (r.actor_api_token_id) return { nome: "Integração (chave de API)", tipo: "integracao" };
  return { nome: "Sistema", tipo: "sistema" };
}

/** Pares chave/valor da metadata para ler, sem JSON. Objetos aninhados viram texto curto. */
export function detalhesDaMetadata(metadata: Record<string, unknown> | null, max = 12): Array<{ chave: string; valor: string }> {
  if (!metadata || typeof metadata !== "object") return [];
  return Object.entries(metadata)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .slice(0, max)
    .map(([k, v]) => {
      const bruto = typeof v === "string" ? v : JSON.stringify(v);
      return { chave: humanizar(k), valor: bruto.length > 140 ? `${bruto.slice(0, 140)}…` : bruto };
    });
}
