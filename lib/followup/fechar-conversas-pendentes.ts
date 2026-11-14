/**
 * "Ao concluir: fechar a conversa" — a REDE DE SEGURANÇA do fechamento.
 *
 * O caminho rápido (`roteiro-no-turno.ts`) fecha a conversa ~25 s depois da resposta, com um temporizador em memória. Se o servidor
 * reiniciar nesses segundos (deploy, falta de memória), o temporizador some e a conversa ficava aberta para sempre. Esta rodada, de
 * minuto em minuto, olha as inscrições concluídas nos últimos 30 minutos cujo nó Fim manda fechar a conversa e fecha as que ainda
 * estão abertas. Nada é gravado à parte: a prova de que "era para fechar" é o próprio roteiro concluído.
 *
 * Não fecha de novo o que a equipe reabriu: se já existe um evento "fechou" ou "reabriu" na conversa depois da conclusão, o fechamento
 * já aconteceu (ou a equipe decidiu) e a rodada deixa quieto. Conversa assumida pela equipe (`claimed`) nunca é fechada.
 * Desligar: `FECHAR_CONVERSAS_DO_ROTEIRO_AUTO=0`.
 */
import { fecharConversaAoFimDoFluxo } from "@/lib/followup/fechar-conversa-ao-fim";
import { MARCA_DE_EVENTO } from "@/lib/inbox/evento-na-conversa-marca";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/** Espera mínima depois da conclusão: dá tempo de o caminho rápido agir e de a resposta da IA sair. */
export const ESPERA_MINIMA_MS = 60_000;
/** Depois disso a inscrição é antiga demais: não mexe mais (a equipe pode ter deixado aberta de propósito). */
export const JANELA_MAXIMA_MS = 30 * 60_000;

/** O nó Fim do grafo manda fechar a conversa? */
export function grafoFechaAConversa(graph: unknown): boolean {
  const nos = (graph as { nodes?: unknown } | null)?.nodes;
  if (!Array.isArray(nos)) return false;
  return nos.some((n) => {
    const no = n as { type?: unknown; config?: { ao_finalizar?: { tipo?: unknown } } };
    return no?.type === "end" && no.config?.ao_finalizar?.tipo === "fechar_conversa";
  });
}

/** Já houve evento de fechar/reabrir na conversa depois da conclusão? */
export function jaTratadaDepoisDaConclusao(notas: ReadonlyArray<{ body: string; created_at: string }>, concluidaEm: string): boolean {
  const limite = Date.parse(concluidaEm);
  return notas.some((n) => {
    if (!n.body.startsWith(MARCA_DE_EVENTO)) return false;
    if (Date.parse(n.created_at) < limite) return false;
    return n.body.includes("fechou a conversa") || n.body.includes("reabriu a conversa");
  });
}

export async function fecharConversasPendentesDoRoteiro(agora: Date = new Date()): Promise<number> {
  const admin = createAdminClient();
  const de = new Date(agora.getTime() - JANELA_MAXIMA_MS).toISOString();
  const ate = new Date(agora.getTime() - ESPERA_MINIMA_MS).toISOString();
  const { data, error } = await admin
    .from("followup_enrollments")
    .select("id, organization_id, contact_id, conversation_id, completed_at, followup_flow_versions(graph)")
    .eq("status", "completed")
    .not("conversation_id", "is", null)
    .gte("completed_at", de)
    .lte("completed_at", ate)
    .limit(100);
  if (error || !Array.isArray(data)) return 0;

  let fechadas = 0;
  for (const linha of data as unknown as Array<{
    organization_id: string;
    contact_id: string;
    conversation_id: string;
    completed_at: string;
    followup_flow_versions: { graph: unknown } | { graph: unknown }[] | null;
  }>) {
    try {
      const versao = Array.isArray(linha.followup_flow_versions) ? linha.followup_flow_versions[0] : linha.followup_flow_versions;
      if (!versao || !grafoFechaAConversa(versao.graph)) continue;

      const { data: notas } = await admin
        .from("conversation_notes")
        .select("body, created_at")
        .eq("conversation_id", linha.conversation_id)
        .gte("created_at", linha.completed_at)
        .order("created_at", { ascending: false })
        .limit(50);
      if (jaTratadaDepoisDaConclusao((notas ?? []) as Array<{ body: string; created_at: string }>, linha.completed_at)) continue;

      const fechou = await fecharConversaAoFimDoFluxo({
        organizationId: linha.organization_id,
        contactId: linha.contact_id,
        conversationId: linha.conversation_id,
      });
      if (fechou) fechadas += 1;
    } catch (err) {
      logger.warn("[roteiro.fechar] rodada falhou numa inscrição", { erro: err instanceof Error ? err.message : String(err) });
    }
  }
  return fechadas;
}

let ligado = false;

export function iniciarFechamentoDeConversasDoRoteiro(intervaloMs = 60_000): void {
  if (ligado || process.env.FECHAR_CONVERSAS_DO_ROTEIRO_AUTO === "0") return;
  ligado = true;
  let rodando = false;
  const rodada = () => {
    if (rodando) return;
    rodando = true;
    void fecharConversasPendentesDoRoteiro()
      .catch((e) => logger.warn("[roteiro.fechar] rodada falhou", { erro: e instanceof Error ? e.message : String(e) }))
      .finally(() => {
        rodando = false;
      });
  };
  setTimeout(rodada, 45_000).unref();
  setInterval(rodada, intervaloMs).unref();
}
