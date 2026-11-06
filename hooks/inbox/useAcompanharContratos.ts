"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useSendMessage } from "@/hooks/inbox/useSendMessage";

import { apiClient } from "@/lib/api/client";
import { MARCA_DE_EVENTO } from "@/lib/inbox/evento-na-conversa-marca";
import type { Note } from "@/lib/types/messaging";

/** Há contrato enviado para assinatura (nota "Contrato enviado … nº X") sem o "Contrato assinado … nº X" correspondente? */
export function temContratoPendente(notas: Pick<Note, "body">[]): boolean {
  const numero = (b: string) => /nº (\d+)/.exec(b)?.[1];
  const doTipo = (rotulo: string) => new Set(notas.filter((n) => n.body.startsWith(`${MARCA_DE_EVENTO}${rotulo}`)).map((n) => numero(n.body)).filter(Boolean));
  const enviados = doTipo("Contrato enviado"), assinados = doTipo("Contrato assinado");
  return [...enviados].some((n) => !assinados.has(n));
}

/**
 * Fork Sales — enquanto houver contrato aguardando assinatura nesta conversa, pergunta ao servidor a cada 20 s.
 * Quando o cliente assina, o servidor grava "Contrato assinado" na conversa e a linha aparece na hora.
 */
export function useAcompanharContratos(conversationId: string | null, notas: Pick<Note, "body">[]) {
  const qc = useQueryClient();
  const enviar = useSendMessage();
  const pendente = temContratoPendente(notas);
  return useQuery({
    queryKey: ["contrato-status", conversationId],
    enabled: Boolean(conversationId) && pendente,
    refetchInterval: 20_000,
    queryFn: async () => {
      const r = await apiClient.get<{ data: { pendentes: number; assinados: number; acoes?: { criarNegocio: { pipeline_id: string; stage_id: string; contact_id: string; title: string } | null; mensagem: string | null } } }>(`/api/v1/conversations/${conversationId}/contrato`);
      void qc.invalidateQueries({ queryKey: ["notes", conversationId] });
      const acoes = r.data.acoes;
      // O servidor devolve essas duas ações UMA vez (na leitura que gravou "Contrato assinado"); quem executa é este navegador, pelas rotas de sempre.
      if (acoes?.criarNegocio) {
        try { await apiClient.post("/api/v1/leads", acoes.criarNegocio); toast.success("Negócio criado na etapa escolhida."); }
        catch (e) { showApiError(e); }
      }
      if (acoes?.mensagem && conversationId) {
        try { await enviar.mutateAsync({ conversation_id: conversationId, body: acoes.mensagem }); } catch { /* o aviso de envio já aparece pelo hook */ }
      }
      return r.data;
    },
  });
}
