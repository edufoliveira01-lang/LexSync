"use client";

import { useQuery } from "@tanstack/react-query";

import type { FunilComEtapas } from "@/components/inbox/EscolhaAposAssinatura";
import { apiClient } from "@/lib/api/client";
import type { AposAssinatura } from "@/lib/sales/apos-assinatura";
import type { Sugestoes } from "@/lib/sales/sugerir-dados";

export function useOpcoesDoContrato(ativo = true) {
  return useQuery({
    queryKey: ["contrato-opcoes"],
    enabled: ativo,
    staleTime: 60_000,
    queryFn: async () => (await apiClient.get<{ data: { padrao: AposAssinatura; pipelines: FunilComEtapas[] } }>("/api/v1/sales/contrato-opcoes")).data,
  });
}

export function useSugestoesDoContrato(conversationId: string) {
  return useQuery({
    queryKey: ["contrato-sugestoes", conversationId],
    staleTime: 30_000,
    queryFn: async () => (await apiClient.get<{ data: { sugestoes: Sugestoes } }>(`/api/v1/conversations/${conversationId}/contrato/dados`)).data.sugestoes,
  });
}
