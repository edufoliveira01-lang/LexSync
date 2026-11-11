/**
 * Fork Sales — CENTRAL DE NOTIFICAÇÕES DA EQUIPE (avisos por WhatsApp).
 *
 * O que é: o dono cadastra avisos (nome, mensagem com marcadores, números que recebem, quando disparam) e escolhe QUAL conexão de WhatsApp os envia —
 * normalmente um segundo número, só para avisos. O sistema dispara sozinho quando o agente passa a conversa para a equipe e quando o contrato é enviado
 * ou assinado; o Roteiro pode disparar outros (ação `@ Notificar equipe`).
 *
 * Onde mora: `organizations.settings.notificacoes_equipe` (sem tabela nova: nada de SQL para aplicar). Este arquivo é só a REGRA (tipos, validação e
 * marcadores), sem banco e sem rede.
 */
import { z } from "zod";

/** Quando a notificação dispara. `roteiro` só dispara quando o Roteiro do agente chama a ação `@ Notificar equipe`. */
export const GATILHOS = ["passou_para_equipe", "contrato_enviado", "contrato_assinado", "roteiro"] as const;
export type Gatilho = (typeof GATILHOS)[number];

export const ROTULO_DO_GATILHO: Record<Gatilho, string> = {
  passou_para_equipe: "Quando o agente passar para um atendente",
  contrato_enviado: "Quando o contrato for enviado",
  contrato_assinado: "Quando o contrato for assinado",
  roteiro: "Só quando o Roteiro chamar (ação @)",
};

export const MARCADORES = ["nome", "telefone", "resumo", "link"] as const;
export type Marcador = (typeof MARCADORES)[number];

export const DESCRICAO_DO_MARCADOR: Record<Marcador, string> = {
  nome: "Nome do cliente",
  telefone: "Telefone do cliente",
  resumo: "Resumo do que aconteceu",
  link: "Link que abre a conversa no CRM",
};

export const MAXIMO_DE_DESTINATARIOS = 10;
export const MAXIMO_DE_NOTIFICACOES = 30;
export const TAMANHO_MAXIMO_DA_MENSAGEM = 500;

/** O telefone só com dígitos e com o 55 na frente; `null` se não for um número de celular/fixo brasileiro plausível. */
export function normalizarTelefone(bruto: unknown): string | null {
  const d = String(bruto ?? "").replace(/\D/g, "");
  const comPais = d.length === 10 || d.length === 11 ? `55${d}` : d;
  return /^55\d{10,11}$/.test(comPais) ? comPais : null;
}

export const notificacaoSchema = z.object({
  id: z.string().min(6).max(64),
  nome: z.string().trim().min(1, "Dê um nome à notificação.").max(100),
  ativa: z.boolean(),
  gatilho: z.enum(GATILHOS),
  mensagem: z.string().min(1, "Escreva a mensagem.").max(TAMANHO_MAXIMO_DA_MENSAGEM, `A mensagem passa de ${TAMANHO_MAXIMO_DA_MENSAGEM} caracteres.`),
  destinatarios: z
    .array(z.string())
    .max(MAXIMO_DE_DESTINATARIOS, `No máximo ${MAXIMO_DE_DESTINATARIOS} números por notificação.`)
    .transform((lista, ctx) => {
      const vistos = new Set<string>();
      for (const bruto of lista) {
        const n = normalizarTelefone(bruto);
        if (!n) { ctx.addIssue({ code: "custom", message: `Número inválido: ${String(bruto).slice(0, 25)}` }); return z.NEVER; }
        vistos.add(n);
      }
      return [...vistos];
    }),
});
export type Notificacao = z.infer<typeof notificacaoSchema>;

export const configSchema = z.object({
  /** A conexão de WhatsApp que envia os avisos (`channel_sessions.id`). */
  canal_id: z.string().uuid().nullable(),
  notificacoes: z.array(notificacaoSchema).max(MAXIMO_DE_NOTIFICACOES, `No máximo ${MAXIMO_DE_NOTIFICACOES} notificações.`),
});
export type ConfigDeNotificacoes = z.infer<typeof configSchema>;

export const CONFIG_VAZIA: ConfigDeNotificacoes = { canal_id: null, notificacoes: [] };

/** A configuração gravada em `organizations.settings`, tolerando o que não existe ou está torto (nunca lança). */
export function lerConfig(settings: unknown): ConfigDeNotificacoes {
  const bruto = (settings as { notificacoes_equipe?: unknown } | null | undefined)?.notificacoes_equipe;
  const r = configSchema.safeParse(bruto);
  if (r.success) return r.data;
  // Aproveita o que dá: uma notificação torta não derruba as outras.
  const lista = (bruto as { notificacoes?: unknown[] } | null | undefined)?.notificacoes;
  const canal = (bruto as { canal_id?: unknown } | null | undefined)?.canal_id;
  const notificacoes = Array.isArray(lista) ? lista.flatMap((n) => { const p = notificacaoSchema.safeParse(n); return p.success ? [p.data] : []; }) : [];
  return { canal_id: typeof canal === "string" && z.string().uuid().safeParse(canal).success ? canal : null, notificacoes };
}

export interface DadosDaMensagem { nome?: string | null; telefone?: string | null; resumo?: string | null; link?: string | null }

/** Troca `{{nome}}`, `{{telefone}}`, `{{resumo}}` e `{{link}}`. Marcador sem valor vira texto vazio; marcador desconhecido fica como está. */
export function renderizarMensagem(modelo: string, dados: DadosDaMensagem): string {
  return modelo
    .replace(/\{\{\s*(nome|telefone|resumo|link)\s*\}\}/gi, (_t, m: string) => String(dados[m.toLowerCase() as Marcador] ?? "").trim())
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1000);
}

/** Os dados de exemplo da prévia (a mesma ideia da tela: a pessoa vê como vai chegar antes de salvar). */
export const DADOS_DE_EXEMPLO: Required<DadosDaMensagem> = {
  nome: "João Silva",
  telefone: "5513999990000",
  resumo: "Cliente quer saber do benefício e pediu para falar com o advogado.",
  link: "https://crm.exemplo.com.br/app/inbox?id=exemplo",
};

/** Um modelo de partida para cada gatilho (o dono edita). */
export const MENSAGEM_PADRAO: Record<Gatilho, string> = {
  passou_para_equipe: "🙋 *Cliente para atender*\n\n*Cliente*: {{nome}}\n*WhatsApp*: {{telefone}}\n\n*Resumo*: {{resumo}}\n\n{{link}}",
  contrato_enviado: "📄 *Contrato enviado*\n\n*Cliente*: {{nome}}\n*WhatsApp*: {{telefone}}\n*Status*: aguardando assinatura\n\n{{link}}",
  contrato_assinado: "✅ *Contrato assinado*\n\n*Cliente*: {{nome}}\n*WhatsApp*: {{telefone}}\n\n{{link}}",
  roteiro: "🔔 *Aviso do atendimento*\n\n*Cliente*: {{nome}}\n*WhatsApp*: {{telefone}}\n\n*Resumo*: {{resumo}}\n\n{{link}}",
};

/** O registro de cada envio (só o necessário, com o número mascarado). */
export interface RegistroDeEnvio {
  em: string;
  notificacao: string;
  gatilho: Gatilho | "teste";
  destino: string;
  ok: boolean;
  erro?: string;
}
export const MAXIMO_DE_REGISTROS = 100;

/** `5513974045973` → `…5973`: o relatório não guarda o número inteiro. */
export const mascararTelefone = (t: string) => (t.length > 4 ? `…${t.slice(-4)}` : t);
