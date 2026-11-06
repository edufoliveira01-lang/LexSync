"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EscolhaAposAssinatura } from "@/components/inbox/EscolhaAposAssinatura";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useOpcoesDoContrato } from "@/hooks/inbox/useOpcoesDoContrato";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import type { AposAssinatura } from "@/lib/sales/apos-assinatura";

/**
 * Fork Sales — Configurações → Empresa → "Contratos: depois da assinatura".
 * O PADRÃO da empresa para quando o cliente assina um contrato gerado no atendimento: etapa do funil, etiqueta e fechar a conversa.
 * No formulário do contrato o atendente pode trocar isso só para aquele contrato.
 */
export function ContratoAposAssinaturaForm() {
  const t = useT();
  const opcoes = useOpcoesDoContrato();
  const [valor, setValor] = useState<AposAssinatura>({});
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (opcoes.data) setValor(opcoes.data.padrao); }, [opcoes.data]);
  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-sm font-medium">{t("Contratos: depois da assinatura")}</h2>
      <p className="text-xs text-muted-foreground">
        {t("O que acontece, por padrão, quando o cliente assina o contrato gerado no atendimento. Ao gerar um contrato, o atendente pode trocar isso só para aquele contrato.")}
      </p>
      <EscolhaAposAssinatura valor={valor} onChange={setValor} funis={opcoes.data?.pipelines ?? []} idPrefixo="cfg-apos" />
      <Button
        size="sm"
        disabled={salvando}
        onClick={async () => {
          setSalvando(true);
          try {
            await apiClient.put("/api/v1/sales/contrato-opcoes", valor);
            toast.success(t("Padrão salvo."));
          } catch (e) { showApiError(e); } finally { setSalvando(false); }
        }}
      >
        {salvando ? t("Salvando…") : t("Salvar")}
      </Button>
    </Card>
  );
}
