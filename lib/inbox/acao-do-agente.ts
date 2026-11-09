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
  nome: "nome", email: "e-mail", cpf: "CPF", rg: "RG", nacionalidade: "nacionalidade", sexo: "sexo", estado_civil: "estado civil", profissao: "profissão",
  cep: "CEP", logradouro: "rua", numero: "número", complemento: "complemento", bairro: "bairro", cidade: "cidade", uf: "UF",
};

/** A frase da ação, pelo nome da ferramenta e o que foi enviado. `null` = não anota. As frases NUNCA levam o valor do dado (só o nome do campo). */
export function frasesDaFerramenta(nome: string, entrada: Record<string, unknown>): string | null {
  switch (nome) {
    case "crm_registrar_dados_do_cliente": {
      const campos = Object.keys(entrada).filter((k) => entrada[k] !== undefined && entrada[k] !== null && String(entrada[k]).trim() !== "").map((k) => ROTULOS_DOS_DADOS[k] ?? k);
      return campos.length > 0 ? `gravou no cadastro: ${campos.join(", ")}` : null;
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

/** "moveu o negócio para «Etapa»": lê a etapa ATUAL do negócio aberto do contato (vale para o espelho do funil, a ferramenta e o sistema). */
export async function anotarMovimentoDoNegocio(orgId: string, contactId: string, quem: string = QUEM_AGENTE, prefixo = "moveu o negócio para"): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("crm_leads").select("crm_stages(name)").eq("organization_id", orgId).eq("contact_id", contactId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const e = (data as { crm_stages?: { name?: string } | { name?: string }[] | null } | null)?.crm_stages;
    const nome = (Array.isArray(e) ? e[0]?.name : e?.name)?.trim();
    if (nome) await anotarNaConversaDoContato(orgId, contactId, `${prefixo} «${nome}»`, quem);
  } catch (err) {
    logger.warn("[inbox.acao-do-agente] não consegui ler a etapa do negócio", { contact_id: contactId, erro: err instanceof Error ? err.message : String(err) });
  }
}
