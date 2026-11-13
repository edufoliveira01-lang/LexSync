"use client";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface ResumoDeContatos {
  total: number;
  clientes: number;
  pessoais: number;
  novos_7_dias: number;
}

/** Os números do alto da tela de Contatos (só contagem). Muda quando a lista muda, então reusa a chave `["contacts"]`. */
export function useContactResumo() {
  return useQuery({
    queryKey: ["contacts", "resumo"],
    staleTime: 30_000,
    queryFn: async () => {
      const corpo = await apiClient.get<{ data?: ResumoDeContatos }>("/api/v1/contacts/resumo");
      return corpo.data ?? null;
    },
  });
}
