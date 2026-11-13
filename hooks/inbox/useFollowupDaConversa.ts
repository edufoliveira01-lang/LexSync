"use client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { apiClient } from "@/lib/api/client";
import { MARCA_DE_EVENTO } from "@/lib/inbox/evento-na-conversa-marca";
import type { Note } from "@/lib/types/messaging";

interface EventoDeFollowup {
  id: string;
  created_at: string;
  event_type: string;
  fluxo: string;
  titulo: string;
  detalhe: string | null;
}

/**
 * Os acontecimentos de follow-up deste contato, já no formato de nota-evento da conversa: o ChatThread os mistura à linha do tempo
 * e eles aparecem como cápsulas ("Follow-up «X»: …"), como assumiu/transferiu/fechou.
 */
export function useFollowupDaConversa(conversationId: string | null): Note[] {
  const query = useQuery({
    queryKey: ["followup-eventos", conversationId] as const,
    enabled: Boolean(conversationId),
    refetchInterval: 30_000,
    staleTime: 15_000,
    queryFn: async () => {
      const r = await apiClient.get<{ data: EventoDeFollowup[] }>(`/api/v1/conversations/${conversationId}/followup-eventos`);
      return r.data;
    },
  });
  return useMemo(
    () =>
      (query.data ?? []).map(
        (e): Note => ({
          id: `followup-${e.id}`,
          conversation_id: conversationId ?? "",
          body: `${MARCA_DE_EVENTO}Follow-up${e.fluxo ? ` «${e.fluxo}»` : ""}: ${e.titulo}${e.detalhe ? ` — ${e.detalhe}` : ""}`,
          created_by_user_id: null,
          created_by_name: "Follow-up",
          created_at: e.created_at,
          media_storage_path: null,
          media_mime: null,
          media_size_bytes: null,
          media_expired_at: null,
          media_retention_days: null,
        }),
      ),
    [query.data, conversationId],
  );
}
