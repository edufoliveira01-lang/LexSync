/**
 * Fork Sales — dispara as notificações da equipe de um gatilho (passou para a equipe, contrato enviado, contrato assinado ou chamada do Roteiro).
 *
 * NUNCA lança e nunca atrasa quem chamou por muito tempo: o handoff, o contrato e o agente não podem falhar por causa de um aviso. Cada envio fica
 * registrado (número mascarado) para a aba Relatórios.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  lerConfig, MAXIMO_DE_REGISTROS, mascararTelefone, renderizarMensagem,
  type DadosDaMensagem, type Gatilho, type Notificacao, type RegistroDeEnvio,
} from "./config";
import { enviarAviso } from "./enviar";

const URL_DO_APP = () => (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");

/** Quem é o cliente da conversa e um resumo curto das últimas mensagens (sem IA: rápido e sem custo). */
export async function dadosDaConversa(admin: SupabaseClient, orgId: string, conversationId: string, resumoExtra?: string | null): Promise<DadosDaMensagem> {
  const dados: DadosDaMensagem = { link: URL_DO_APP() ? `${URL_DO_APP()}/app/inbox?id=${conversationId}` : "" };
  try {
    const { data: conv } = await admin.from("conversations").select("contact_id, contacts:contact_id(name, display_name, phone_number)").eq("id", conversationId).eq("organization_id", orgId).maybeSingle();
    const c = (conv as { contacts?: { name?: string | null; display_name?: string | null; phone_number?: string | null } | null } | null)?.contacts;
    dados.nome = c?.display_name || c?.name || "";
    dados.telefone = c?.phone_number ?? "";
  } catch { /* segue sem o nome */ }
  const partes: string[] = [];
  if (resumoExtra?.trim()) partes.push(resumoExtra.trim());
  try {
    const { data: msgs } = await admin.from("messages").select("direction, body").eq("organization_id", orgId).eq("conversation_id", conversationId).not("body", "is", null).order("sent_at", { ascending: false }).limit(4);
    const lista = ((msgs ?? []) as { direction: string; body: string }[]).reverse().map((m) => `${m.direction === "inbound" ? "Cliente" : "Atendimento"}: ${m.body.replace(/\s+/g, " ").slice(0, 160)}`);
    if (lista.length > 0 && !resumoExtra?.trim()) partes.push(lista.join("\n"));
  } catch { /* segue sem o resumo */ }
  dados.resumo = partes.join("\n").slice(0, 400);
  return dados;
}

async function gravarRegistros(admin: SupabaseClient, orgId: string, novos: RegistroDeEnvio[]): Promise<void> {
  if (novos.length === 0) return;
  try {
    const { data } = await admin.from("organizations").select("settings").eq("id", orgId).maybeSingle();
    const settings = ((data as { settings?: Record<string, unknown> | null } | null)?.settings ?? {}) as Record<string, unknown>;
    const antigos = Array.isArray(settings.notificacoes_equipe_registros) ? (settings.notificacoes_equipe_registros as RegistroDeEnvio[]) : [];
    const lista = [...novos, ...antigos].slice(0, MAXIMO_DE_REGISTROS);
    await admin.from("organizations").update({ settings: { ...settings, notificacoes_equipe_registros: lista } }).eq("id", orgId);
  } catch (e) {
    logger.warn("[notificacoes-equipe] registro do envio não gravado", { erro: e instanceof Error ? e.message : String(e) });
  }
}

export interface PedidoDeDisparo {
  orgId: string;
  gatilho: Gatilho;
  conversationId?: string | null;
  /** Para o gatilho `roteiro`: o nome (ou o id) da notificação que o Roteiro chamou. */
  nomeDaNotificacao?: string;
  resumo?: string | null;
  admin?: SupabaseClient;
}

/** Dispara as notificações ATIVAS do gatilho. Devolve quantas saíram e quantas falharam. */
export async function dispararNotificacoes(p: PedidoDeDisparo): Promise<{ enviadas: number; falhas: number; motivo?: string }> {
  try {
    const admin = p.admin ?? createAdminClient();
    const { data } = await admin.from("organizations").select("settings").eq("id", p.orgId).maybeSingle();
    const config = lerConfig((data as { settings?: unknown } | null)?.settings);
    if (!config.canal_id) return { enviadas: 0, falhas: 0, motivo: "sem_conexao" };

    const procurado = (p.nomeDaNotificacao ?? "").trim().toLowerCase();
    const alvo = (n: Notificacao) => p.gatilho === "roteiro"
      ? n.gatilho === "roteiro" && (n.id.toLowerCase() === procurado || n.nome.trim().toLowerCase() === procurado)
      : n.gatilho === p.gatilho;
    const lista = config.notificacoes.filter((n) => n.ativa && n.destinatarios.length > 0 && alvo(n));
    if (lista.length === 0) return { enviadas: 0, falhas: 0, motivo: "nenhuma_notificacao" };

    const dados = p.conversationId ? await dadosDaConversa(admin, p.orgId, p.conversationId, p.resumo) : { resumo: p.resumo ?? "" };
    const registros: RegistroDeEnvio[] = [];
    let enviadas = 0, falhas = 0;
    for (const n of lista) {
      const texto = renderizarMensagem(n.mensagem, dados);
      for (const telefone of n.destinatarios) {
        const r = await enviarAviso({ orgId: p.orgId, canalId: config.canal_id, telefone, texto, admin });
        if (r.ok) enviadas++; else falhas++;
        registros.push({ em: new Date().toISOString(), notificacao: n.nome, gatilho: p.gatilho, destino: mascararTelefone(telefone), ok: r.ok, ...(r.erro ? { erro: r.erro } : {}) });
      }
    }
    await gravarRegistros(admin, p.orgId, registros);
    return { enviadas, falhas };
  } catch (e) {
    logger.warn("[notificacoes-equipe] disparo falhou", { gatilho: p.gatilho, erro: e instanceof Error ? e.message : String(e) });
    return { enviadas: 0, falhas: 0, motivo: "erro" };
  }
}
