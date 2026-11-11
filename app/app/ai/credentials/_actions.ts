"use server";
/**
 * Server actions thin para a tela de credentials. A lógica pesada (AES-GCM
 * encrypt + async provider validation) vive nas rotas REST `/api/v1/ai/credentials/*`
 * e o cliente usa `apiClient` direto. Esta action existe apenas para revalidar
 * o `usage_map` rendered no Server Component após mutations.
 */
import { revalidatePath } from "next/cache";

import { loadAuthUser, mfaEmDivida, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { supportWriteError } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export async function refreshCredentialsView() {
  revalidatePath("/app/ai/credentials");
}

/**
 * Fork Sales — ARQUIVAR credencial: ela some da lista principal e continua existindo e funcionando (as versões de agente que a usam seguem válidas).
 * Existe porque a exclusão é travada pelo histórico de versões. A lista dos ids arquivados mora em `organizations.settings.credenciais_arquivadas`
 * (sem coluna nova). Só admin.
 */

export type ResultadoDoArquivar = { ok: true; arquivadas: string[] } | { ok: false; error: "unauthenticated" | "forbidden" | "mfa_required" | "nao_encontrada" | "erro_ao_gravar" };

export async function definirCredencialArquivada(id: string, arquivada: boolean): Promise<ResultadoDoArquivar> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "nao_encontrada" };
  const user = await loadAuthUser();
  if (!user) return { ok: false, error: "unauthenticated" };
  if (supportWriteError(user.support)) return { ok: false, error: "forbidden" };
  const org = await resolveActiveOrg(user);
  if (!org || ROLE_RANK[org.role] < ROLE_RANK.admin) return { ok: false, error: "forbidden" };
  if (await mfaEmDivida()) return { ok: false, error: "mfa_required" };

  const admin = createAdminClient();
  const { data: cred } = await admin.from("ai_provider_credentials").select("id").eq("id", id).eq("organization_id", org.orgId).maybeSingle();
  if (!cred) return { ok: false, error: "nao_encontrada" };
  const { data: o, error } = await admin.from("organizations").select("settings").eq("id", org.orgId).maybeSingle();
  if (error) return { ok: false, error: "erro_ao_gravar" };
  const settings = ((o as { settings?: Record<string, unknown> | null } | null)?.settings ?? {}) as Record<string, unknown>;
  const atuais = Array.isArray(settings.credenciais_arquivadas) ? (settings.credenciais_arquivadas as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const novas = arquivada ? [...new Set([...atuais, id])] : atuais.filter((x) => x !== id);
  const { error: erroGravar } = await admin.from("organizations").update({ settings: { ...settings, credenciais_arquivadas: novas } }).eq("id", org.orgId);
  if (erroGravar) return { ok: false, error: "erro_ao_gravar" };
  revalidatePath("/app/ai/credentials");
  return { ok: true, arquivadas: novas };
}
