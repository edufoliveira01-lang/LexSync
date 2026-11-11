"use client";

import { useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

/**
 * Fork Sales — «Abertura ao receber uma conversa»: o que ESTE agente diz ao cliente assim que outro agente lhe passa a conversa (ação @ «Passar para outro agente»).
 * Salva em `ai_agents.config.mensagem_de_abertura`; aceita {{nome}}. Vazio = o agente só fala na próxima mensagem do cliente.
 */
export function AberturaDaPassagem({ agentId, inicial, disabled }: { agentId: string; inicial: unknown; disabled?: boolean }) {
  const t = useT();
  const [texto, setTexto] = useState(typeof inicial === "string" ? inicial : "");
  const [salvo, setSalvo] = useState(typeof inicial === "string" ? inicial : "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await apiClient.patch(`/api/v1/ai/agents/${agentId}`, { config: { mensagem_de_abertura: texto.trim() } });
      setSalvo(texto.trim());
      toast.success(t("Abertura salva."));
    } catch (err) {
      showApiError(err);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <div>
        <h3 className="text-sm font-medium">{t("Abertura ao receber uma conversa")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("Quando outro agente passar a conversa para este, esta é a primeira mensagem que o cliente recebe. Use {{nome}} para o nome do cliente. Deixe vazio para o agente só falar quando o cliente responder.")}
        </p>
      </div>
      <Textarea rows={3} maxLength={500} value={texto} disabled={disabled || salvando} onChange={(e) => setTexto(e.target.value)} placeholder={t("Olá, {{nome}}! Vi que você já é nosso cliente. Como posso ajudar?")} />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{texto.length}/500</span>
        <Button size="sm" onClick={salvar} disabled={disabled || salvando || texto.trim() === salvo}>{t("Salvar abertura")}</Button>
      </div>
    </Card>
  );
}
