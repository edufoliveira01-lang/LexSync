"use server";

/**
 * Fork Sales — ações da CENTRAL DE NOTIFICAÇÕES DA EQUIPE.
 *
 * Configuração em `organizations.settings.notificacoes_equipe` (sem migration). Piso `manager`, gravação por service role (mesmo motivo de
 * `definirTagsDaEquipe`: o client de sessão não grava em `organizations`). O id da organização vem de `resolveActiveOrg`, nunca do argumento.
 */
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { loadAuthUser, mfaEmDivida, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { candidatosParaConversaNova, rotuloDoTipoDeCanal } from "@/lib/channels/conversa-nova";
import { lerEstadoDoCanal } from "@/lib/channels/estado";
import { supportWriteError } from "@/lib/impersonate/support";
import { logger } from "@/lib/logger";
import {
  configSchema, DADOS_DE_EXEMPLO, lerConfig, mascararTelefone, normalizarTelefone, renderizarMensagem,
  type ConfigDeNotificacoes, type RegistroDeEnvio,
} from "@/lib/notificacoes-equipe/config";
import { enviarAviso } from "@/lib/notificacoes-equipe/enviar";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CanalDaCentral {
  id: string;
  nome: string;
  telefone: string;
  tipo: string | null;
  pronto: boolean;
  estado: string;
  /** Já está marcado como número de avisos (a IA não responde nele). */
  deAvisos: boolean;
  /** Tem agente publicado atendendo por ele: não pode virar número de avisos. */
  temAgente: boolean;
}

export type EstadoDaCentral = {
  ok: true;
  config: ConfigDeNotificacoes;
  canais: CanalDaCentral[];
  registros: RegistroDeEnvio[];
};
type Falha = { ok: false; error: "unauthenticated" | "forbidden_tenant" | "forbidden_role" | "mfa_required" | "validation_failed" | "erro_ao_gravar" | "canal_invalido" | "canal_com_agente" | "sem_numero" | "sem_conexao" };

async function autorizar(escrita: boolean): Promise<{ orgId: string; erro?: undefined } | { erro: Falha["error"] }> {
  const user = await loadAuthUser();
  if (!user) return { erro: "unauthenticated" };
  if (escrita && supportWriteError(user.support)) return { erro: "forbidden_role" };
  const org = await resolveActiveOrg(user);
  if (!org) return { erro: "forbidden_tenant" };
  if (ROLE_RANK[org.role] < ROLE_RANK.manager) return { erro: "forbidden_role" };
  if (escrita && (await mfaEmDivida())) return { erro: "mfa_required" };
  return { orgId: org.orgId };
}

async function lerSettings(orgId: string): Promise<Record<string, unknown> | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("organizations").select("settings").eq("id", orgId).maybeSingle();
  if (error) return null;
  return ((data as { settings?: Record<string, unknown> | null } | null)?.settings ?? {}) as Record<string, unknown>;
}

async function canaisComAgente(orgId: string): Promise<Set<string>> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("ai_agent_versions").select("channel_session_id").eq("organization_id", orgId).eq("status", "published").not("channel_session_id", "is", null);
    return new Set(((data ?? []) as { channel_session_id: string | null }[]).map((r) => r.channel_session_id).filter((x): x is string => !!x));
  } catch { return new Set(); }
}

export async function lerCentralDeNotificacoes(): Promise<EstadoDaCentral | Falha> {
  const a = await autorizar(false);
  if (a.erro) return { ok: false, error: a.erro };
  const orgId = a.orgId!;
  const settings = await lerSettings(orgId);
  if (!settings) return { ok: false, error: "erro_ao_gravar" };
  const admin = createAdminClient();
  const { data } = await admin
    .from("channel_sessions")
    .select("id, provider, status, waha_session_name, metadata, phone_number, archived_at, display_name")
    .eq("organization_id", orgId);
  const linhas = (data ?? []) as Array<{ id: string; provider: string | null; status: string | null; waha_session_name: string | null; metadata: Record<string, unknown> | null; phone_number: string | null; archived_at: string | null; display_name?: string | null }>;
  const comAgente = await canaisComAgente(orgId);
  const canais: CanalDaCentral[] = candidatosParaConversaNova(linhas).map((c) => {
    const l = linhas.find((x) => x.id === c.id)!;
    const est = lerEstadoDoCanal(c.status);
    return {
      id: c.id,
      nome: l.display_name || l.waha_session_name || "WhatsApp",
      telefone: c.phone_number ?? "",
      tipo: rotuloDoTipoDeCanal(c.provider),
      pronto: est.utilizavel,
      estado: String(c.status ?? ""),
      deAvisos: c.metadata?.["finalidade"] === "avisos",
      temAgente: comAgente.has(c.id),
    };
  });
  const registros = Array.isArray(settings.notificacoes_equipe_registros) ? (settings.notificacoes_equipe_registros as RegistroDeEnvio[]) : [];
  return { ok: true, config: lerConfig(settings), canais, registros };
}

export async function salvarCentralDeNotificacoes(input: unknown): Promise<{ ok: true; config: ConfigDeNotificacoes } | Falha> {
  const entrada = configSchema.safeParse(input);
  if (!entrada.success) return { ok: false, error: "validation_failed" };
  const a = await autorizar(true);
  if (a.erro) return { ok: false, error: a.erro };
  const orgId = a.orgId!;
  const config = entrada.data;
  const admin = createAdminClient();
  if (config.canal_id) {
    const { data } = await admin.from("channel_sessions").select("id").eq("id", config.canal_id).eq("organization_id", orgId).is("archived_at", null).maybeSingle();
    if (!data) return { ok: false, error: "canal_invalido" };
  }
  const settings = await lerSettings(orgId);
  if (!settings) return { ok: false, error: "erro_ao_gravar" };
  const { error } = await admin.from("organizations").update({ settings: { ...settings, notificacoes_equipe: config } }).eq("id", orgId);
  if (error) {
    logger.error("[notificacoes-equipe] gravação falhou", { organization_id: orgId, code: error.code, error: error.message });
    return { ok: false, error: "erro_ao_gravar" };
  }
  revalidatePath("/app/ai/notificacoes");
  return { ok: true, config };
}

/** Marca a conexão como número de AVISOS: a IA nunca responde nele (modo de teste sem número autorizado). Recusa conexão que já tem agente. */
export async function prepararCanalDeAvisos(canalId: string): Promise<{ ok: true } | Falha> {
  if (typeof canalId !== "string" || !/^[0-9a-f-]{36}$/i.test(canalId)) return { ok: false, error: "validation_failed" };
  const a = await autorizar(true);
  if (a.erro) return { ok: false, error: a.erro };
  const orgId = a.orgId!;
  const admin = createAdminClient();
  const { data } = await admin.from("channel_sessions").select("id, metadata").eq("id", canalId).eq("organization_id", orgId).is("archived_at", null).maybeSingle();
  if (!data) return { ok: false, error: "canal_invalido" };
  if ((await canaisComAgente(orgId)).has(canalId)) return { ok: false, error: "canal_com_agente" };
  const metadata = ((data as { metadata?: Record<string, unknown> | null }).metadata ?? {}) as Record<string, unknown>;
  const { error } = await admin.from("channel_sessions").update({ metadata: { ...metadata, ai_gate: "allowlist", ai_test_phone_numbers: [], finalidade: "avisos" } }).eq("id", canalId).eq("organization_id", orgId);
  if (error) return { ok: false, error: "erro_ao_gravar" };
  revalidatePath("/app/ai/notificacoes");
  return { ok: true };
}

/** Manda uma mensagem de teste (com os dados de exemplo) para UM número, pela conexão escolhida. */
export async function enviarTesteDeNotificacao(input: { canalId: string | null; telefone: string; mensagem: string }): Promise<{ ok: true } | { ok: false; error: Falha["error"] | "falhou"; detalhe?: string }> {
  const a = await autorizar(true);
  if (a.erro) return { ok: false, error: a.erro };
  const orgId = a.orgId!;
  if (!input?.canalId) return { ok: false, error: "sem_conexao" };
  const telefone = normalizarTelefone(input.telefone);
  if (!telefone) return { ok: false, error: "sem_numero" };
  const admin = createAdminClient();
  const { data } = await admin.from("channel_sessions").select("id").eq("id", input.canalId).eq("organization_id", orgId).is("archived_at", null).maybeSingle();
  if (!data) return { ok: false, error: "canal_invalido" };
  const texto = renderizarMensagem(String(input.mensagem ?? "").slice(0, 500), DADOS_DE_EXEMPLO);
  if (!texto) return { ok: false, error: "validation_failed" };
  const r = await enviarAviso({ orgId, canalId: input.canalId, telefone, texto: `🧪 TESTE\n\n${texto}`, admin });
  const settings = await lerSettings(orgId);
  if (settings) {
    const antigos = Array.isArray(settings.notificacoes_equipe_registros) ? (settings.notificacoes_equipe_registros as RegistroDeEnvio[]) : [];
    const novo: RegistroDeEnvio = { em: new Date().toISOString(), notificacao: "Teste", gatilho: "teste", destino: mascararTelefone(telefone), ok: r.ok, ...(r.erro ? { erro: r.erro } : {}) };
    await admin.from("organizations").update({ settings: { ...settings, notificacoes_equipe_registros: [novo, ...antigos].slice(0, 100) } }).eq("id", orgId);
  }
  return r.ok ? { ok: true } : { ok: false, error: "falhou", detalhe: r.erro };
}

export async function novoIdDeNotificacao(): Promise<string> {
  return `n_${randomUUID().slice(0, 12)}`;
}
