/**
 * Fork Sales — "Passar para outro agente" (ação @ do Roteiro).
 *
 * Duas coisas, nesta ordem: (1) a conversa passa a ser atendida pelo agente indicado (`conversations.active_ai_agent_id` + `active_intent = 'passagem_do_roteiro'`; o
 * resolvedor de turno honra essa marca mesmo sem roteador); (2) se o Roteiro indicou funil, o card do contato muda para esse funil pela MESMA transferência do roteador
 * de intenção (`aplicaDestinoDaIntencao`: clona no destino e encerra a origem como transferência, que não conta como perda comercial).
 *
 * Nunca lança: devolve `{ ok:false, motivo }` com uma frase que o agente pode usar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { aplicaDestinoDaIntencao } from "@/lib/agent-engine/agent/destino-da-intencao";
import { INTENCAO_DA_PASSAGEM } from "./intencao";
import type { HandlerCtx } from "@/lib/api/handlers/types";

export { INTENCAO_DA_PASSAGEM };

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export interface PedidoDePassagem {
  admin: SupabaseClient;
  organizationId: string;
  contactId: string;
  conversationId: string;
  agente: string;
  funil?: string;
  etapa?: string;
  handlerCtx: HandlerCtx;
}

export type ResultadoDaPassagem =
  | { ok: true; agente: string; agentId: string; funil?: string; card?: string }
  | { ok: false; motivo: string };

function acharPorNome<T extends { name: string }>(lista: T[], nome: string): T | null {
  const alvo = norm(nome);
  return lista.find((x) => norm(x.name) === alvo) ?? lista.find((x) => norm(x.name).includes(alvo)) ?? null;
}

export async function passarParaAgente(p: PedidoDePassagem): Promise<ResultadoDaPassagem> {
  try {
    const { data: agentes, error } = await p.admin
      .from("ai_agents")
      .select("id, name, published_version_id")
      .eq("organization_id", p.organizationId)
      .is("archived_at", null)
      .not("published_version_id", "is", null);
    if (error) return { ok: false, motivo: "Não consegui consultar os agentes agora." };
    const agente = acharPorNome((agentes ?? []) as { id: string; name: string }[], p.agente);
    if (!agente) return { ok: false, motivo: `Não encontrei um agente publicado chamado «${p.agente}».` };

    // O funil primeiro, para não passar a conversa se o destino do card estiver errado.
    let destino: { pipelineId: string; stageId: string | null; nome: string } | null = null;
    if (p.funil?.trim()) {
      const { data: funis } = await p.admin.from("crm_pipelines").select("id, name").eq("organization_id", p.organizationId).eq("is_archived", false);
      const funil = acharPorNome((funis ?? []) as { id: string; name: string }[], p.funil);
      if (!funil) return { ok: false, motivo: `Não encontrei o funil «${p.funil}».` };
      let stageId: string | null = null;
      if (p.etapa?.trim()) {
        const { data: etapas } = await p.admin.from("crm_stages").select("id, name").eq("organization_id", p.organizationId).eq("pipeline_id", funil.id).eq("is_archived", false);
        const etapa = acharPorNome((etapas ?? []) as { id: string; name: string }[], p.etapa);
        if (!etapa) return { ok: false, motivo: `Não encontrei a etapa «${p.etapa}» no funil «${funil.name}».` };
        stageId = etapa.id;
      }
      destino = { pipelineId: funil.id, stageId, nome: funil.name };
    }

    let card: string | undefined;
    if (destino) {
      const r = await aplicaDestinoDaIntencao({
        admin: p.admin,
        organizationId: p.organizationId,
        contactId: p.contactId,
        destinoPipelineId: destino.pipelineId,
        destinoStageId: destino.stageId,
        handlerCtx: p.handlerCtx,
        funisDeProduto: [],
      });
      card = r.status;
      // Só estes resultados deixam o card no lugar certo; o resto avisa a equipe pelo aviso da Central e a conversa NÃO passa.
      if (!["transferido", "ja_no_destino", "card_adicional"].includes(r.status)) {
        return { ok: false, motivo: `O card não pôde ir para o funil «${destino.nome}» (${r.status}${r.error ? `: ${r.error}` : ""}). A conversa continua com você; chame a equipe.` };
      }
    }

    const { error: erroAtualizar } = await p.admin
      .from("conversations")
      .update({ active_ai_agent_id: agente.id, active_intent: INTENCAO_DA_PASSAGEM, active_agent_set_at: new Date().toISOString() })
      .eq("organization_id", p.organizationId)
      .eq("id", p.conversationId);
    if (erroAtualizar) return { ok: false, motivo: "Não consegui passar a conversa agora. Chame a equipe." };

    return { ok: true, agente: agente.name, agentId: agente.id, ...(destino ? { funil: destino.nome } : {}), ...(card ? { card } : {}) };
  } catch (e) {
    return { ok: false, motivo: `Não consegui passar a conversa: ${(e instanceof Error ? e.message : String(e)).slice(0, 120)}` };
  }
}
