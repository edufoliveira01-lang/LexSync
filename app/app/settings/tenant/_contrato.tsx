"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EscolhaAposAssinatura } from "@/components/inbox/EscolhaAposAssinatura";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (opcoes.data) { setValor(opcoes.data.padrao); setMensagem(opcoes.data.mensagem); } }, [opcoes.data]);
  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-sm font-medium">{t("Contratos: depois da assinatura")}</h2>
      <p className="text-xs text-muted-foreground">
        {t("O que acontece, por padrão, quando o cliente assina o contrato gerado no atendimento. Ao gerar um contrato, o atendente pode trocar isso só para aquele contrato.")}
      </p>
      <EscolhaAposAssinatura valor={valor} onChange={setValor} funis={opcoes.data?.pipelines ?? []} idPrefixo="cfg-apos" />
      <div className="space-y-1.5">
        <Label htmlFor="cfg-mensagem">{t("Mensagem ao cliente depois que ele assinar tudo")}</Label>
        <Textarea id="cfg-mensagem" rows={4} maxLength={1000} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
        <p className="text-xs text-muted-foreground">
          {t("Enviada pelo WhatsApp da conversa. Use {{nome}} para o primeiro nome do cliente. Deixe em branco para não enviar nada.")}
        </p>
        {opcoes.data && mensagem !== opcoes.data.mensagem_padrao && (
          <button type="button" className="text-xs underline" onClick={() => setMensagem(opcoes.data!.mensagem_padrao)}>{t("Usar o texto padrão")}</button>
        )}
      </div>
      <Button
        size="sm"
        disabled={salvando}
        onClick={async () => {
          setSalvando(true);
          try {
            await apiClient.put("/api/v1/sales/contrato-opcoes", { ...valor, mensagem });
            toast.success(t("Padrão salvo."));
          } catch (e) { showApiError(e); } finally { setSalvando(false); }
        }}
      >
        {salvando ? t("Salvando…") : t("Salvar")}
      </Button>
    </Card>
  );
}
