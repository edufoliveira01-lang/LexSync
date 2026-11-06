"use client";

import * as React from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

/**
 * Fork Sales — preenche "As instruções dele" com o texto do agente do ESCRITÓRIO, montado pelo Sales
 * (cadastro do escritório + Configurações › Atendimento com IA). Só preenche o campo: quem salva e publica é a pessoa.
 */
export function UsarTextoDoEscritorio({ atual, disabled, onPreencher }: { atual: string; disabled?: boolean; onPreencher: (texto: string, nomeDoAgente: string) => void }) {
  const t = useT();
  const [buscando, setBuscando] = React.useState(false);

  const usar = async () => {
    if (atual.trim().length > 0 && !window.confirm(t("O texto atual das instruções será substituído pelo texto do escritório, e o agente será configurado como agente jurídico (ferramentas, passagem para humano, mensagens curtas e funil). Continuar?"))) return;
    setBuscando(true);
    try {
      const r = await apiClient.get<{ data: { prompt: string; nome_agente: string; pendencias: string[]; erro_sales: string | null } }>("/api/v1/sales/agente-do-escritorio");
      if (r.data.erro_sales || !r.data.prompt) {
        toast.error(r.data.erro_sales ?? t("O Sales não devolveu o texto do agente. Confira Configurações › Atendimento com IA."));
        return;
      }
      onPreencher(r.data.prompt, r.data.nome_agente);
      if (r.data.pendencias.length > 0) toast.warning(`${t("Agente preenchido. Falta no Sales:")} ${r.data.pendencias.join(" ")}`);
      else toast.success(t("Agente jurídico preenchido (texto, ferramentas e opções). Escolha o modelo e a conexão, revise e salve."));
    } catch (e) {
      showApiError(e);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" disabled={disabled || buscando} onClick={() => void usar()} data-testid="usar-texto-do-escritorio">
      {buscando ? t("Buscando…") : t("Usar o texto do escritório")}
    </Button>
  );
}
