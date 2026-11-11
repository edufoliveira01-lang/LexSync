/**
 * Fork Sales — o vigia do envio ao Dropbox: de tempos em tempos pergunta ao Sales como está o envio dos documentos e, quando aparece um PROBLEMA NOVO,
 * avisa a equipe por WhatsApp (Central de notificações, gatilho «Quando o envio ao Dropbox der problema»).
 *
 * Só olha organizações que têm uma notificação ATIVA desse gatilho e que estão ligadas ao Sales. O mesmo problema não é avisado de novo: a chave do
 * problema (que o Sales calcula) fica em `settings.notificacoes_equipe_estado.armazenamento_alertado`, e é limpa quando o problema some.
 * Nunca lança: Sales fora do ar, organização sem notificação ou qualquer falha só viram log.
 */
import { logger } from "@/lib/logger";
import { lerConfig } from "@/lib/notificacoes-equipe/config";
import { dispararNotificacoes } from "@/lib/notificacoes-equipe/disparar";
import { createAdminClient } from "@/lib/supabase/admin";

import { configDosContratos, saudeDoArmazenamento, type SaudeDoArmazenamento } from "./contratos";

export type DecisaoDoVigia = { acao: "avisar"; chave: string; texto: string } | { acao: "limpar" } | { acao: "nada" };

/** O que fazer com a saúde lida, dado o que já foi avisado. Puro. */
export function decidirAviso(alertado: string | null | undefined, saude: Pick<SaudeDoArmazenamento, "problema" | "chave">): DecisaoDoVigia {
  if (!saude.problema) return alertado ? { acao: "limpar" } : { acao: "nada" };
  if (alertado === saude.chave) return { acao: "nada" };
  return { acao: "avisar", chave: saude.chave, texto: saude.problema };
}

const INTERVALO_MS = 10 * 60_000;

export async function vigiarOArmazenamento(): Promise<void> {
  if (!configDosContratos()) return;
  const admin = createAdminClient();
  const { data, error } = await admin.from("organizations").select("id, slug, settings").limit(500);
  if (error || !data) return;
  for (const org of data as Array<{ id: string; slug: string | null; settings: Record<string, unknown> | null }>) {
    try {
      if (!org.slug) continue;
      const config = lerConfig(org.settings);
      if (!config.canal_id || !config.notificacoes.some((n) => n.ativa && n.gatilho === "armazenamento" && n.destinatarios.length > 0)) continue;
      const saude = await saudeDoArmazenamento(org.slug);
      const estado = ((org.settings?.notificacoes_equipe_estado ?? {}) as { armazenamento_alertado?: string });
      const d = decidirAviso(estado.armazenamento_alertado, saude);
      if (d.acao === "nada") continue;
      let novo: string | undefined = estado.armazenamento_alertado;
      if (d.acao === "avisar") {
        const r = await dispararNotificacoes({ orgId: org.id, gatilho: "armazenamento", resumo: d.texto, admin });
        // só marca como avisado se pelo menos um aviso saiu: senão tenta de novo na próxima volta
        if (r.enviadas > 0) novo = d.chave;
        else continue;
      } else novo = undefined;
      const { data: atual } = await admin.from("organizations").select("settings").eq("id", org.id).maybeSingle();
      const settings = ((atual as { settings?: Record<string, unknown> | null } | null)?.settings ?? {}) as Record<string, unknown>;
      const estadoNovo = { ...((settings.notificacoes_equipe_estado ?? {}) as Record<string, unknown>), armazenamento_alertado: novo };
      if (novo === undefined) delete (estadoNovo as Record<string, unknown>).armazenamento_alertado;
      await admin.from("organizations").update({ settings: { ...settings, notificacoes_equipe_estado: estadoNovo } }).eq("id", org.id);
    } catch (e) {
      logger.warn("[vigia-do-armazenamento] não consegui conferir uma organização", { org: org.id, erro: e instanceof Error ? e.message : String(e).slice(0, 160) });
    }
  }
}

let iniciado = false;
export function iniciarVigiaDoArmazenamento(): void {
  if (iniciado || !configDosContratos()) return;
  iniciado = true;
  const rodar = () => { void vigiarOArmazenamento().catch(() => undefined); };
  setTimeout(rodar, 2 * 60_000).unref?.();
  setInterval(rodar, INTERVALO_MS).unref?.();
}
