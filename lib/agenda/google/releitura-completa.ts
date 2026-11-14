/**
 * Pede a RELEITURA COMPLETA de uma agenda do Google na próxima rodada.
 *
 * A leitura é incremental: depois da primeira, o Google só devolve o que MUDOU desde o último `sync_token`. Quem liga "mostrar o título"
 * numa agenda que já estava sendo lida esperava ver os títulos na hora, mas os eventos antigos não voltam no incremental — ficavam
 * "Ocupado" até a releitura completa automática (24 h). Limpar o `sync_token` faz `fn_google_calendar('claim')` montar um cursor
 * `full`, que percorre a janela inteira e passa por todos os eventos (de novo), e a rodada de 1 min já a pega (`sync_next_attempt_at`).
 *
 * Nunca lança: a opção foi salva; no pior caso o título espera a releitura automática.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function pedirReleituraCompleta(db: SupabaseClient, organizationId: string, calendarId: string, agora: () => Date = () => new Date()): Promise<boolean> {
  try {
    const { error } = await db
      .from("calendar_connection_calendars")
      .update({ sync_token: null, sync_next_attempt_at: agora().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", calendarId);
    return !error;
  } catch {
    return false;
  }
}
