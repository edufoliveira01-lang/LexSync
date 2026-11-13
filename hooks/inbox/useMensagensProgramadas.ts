"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";

export interface MensagemProgramada {
  id: string;
  conversation_id: string;
  body: string;
  send_at: string;
  cancel_on_reply: boolean;
  status: "pending" | "sending" | "sent" | "failed" | "canceled";
  created_at: string;
  error: string | null;
}

/** As mensagens programadas (e as que falharam) de uma conversa, com criar e cancelar. */
export function useMensagensProgramadas(conversationId: string | null, ativa = true) {
  const qc = useQueryClient();
  const chave = ["mensagens-programadas", conversationId] as const;

  const lista = useQuery({
    queryKey: chave,
    enabled: Boolean(conversationId) && ativa,
    refetchInterval: ativa ? 30_000 : false,
    queryFn: async () => (await apiClient.get<{ data: MensagemProgramada[] }>(`/api/v1/conversations/${conversationId}/scheduled-messages`)).data,
  });

  const criar = useMutation({
    mutationFn: (p: { body: string; send_at: string; cancel_on_reply: boolean }) =>
      apiClient.post<{ data: MensagemProgramada }>(`/api/v1/conversations/${conversationId}/scheduled-messages`, p),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chave });
      // o evento "programou uma mensagem" entra nas notas da conversa
      void qc.invalidateQueries({ queryKey: ["conversation-notes", conversationId] });
    },
    onError: (e) => toast.error(e instanceof ApiError && e.message ? e.message : "Não foi possível programar a mensagem."),
  });

  const cancelar = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/conversations/${conversationId}/scheduled-messages/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chave });
      void qc.invalidateQueries({ queryKey: ["conversation-notes", conversationId] });
    },
    onError: (e) => toast.error(e instanceof ApiError && e.message ? e.message : "Não foi possível cancelar."),
  });

  return { lista, criar, cancelar };
}
