"use client";

import { useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

/**
 * Fork Sales — "Atualizar agente do escritório".
 *
 * O texto do agente não é escrito à mão: o Sales o monta do cadastro do escritório (Atendimento com IA + dados do escritório).
 * Este botão busca o texto pronto e grava uma NOVA VERSÃO RASCUNHO do agente escolhido (o resto da configuração é copiado).
 * Nada é publicado: quem publica é a pessoa, na tela do agente, depois de revisar.
 */
type Estado = { agentes: { id: string; name: string }[]; pendencias: string[]; nome_agente: string; erro_sales: string | null };

export function AtualizarAgenteDoEscritorio() {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [agenteId, setAgenteId] = useState("");
  const [gravando, setGravando] = useState(false);

  const abrir = async () => {
    setAberto(true);
    setCarregando(true);
    try {
      const r = await apiClient.get<{ data: Estado }>("/api/v1/sales/agente-do-escritorio");
      setEstado(r.data);
      setAgenteId(r.data.agentes[0]?.id ?? "");
    } catch (e) {
      showApiError(e);
      setAberto(false);
    } finally {
      setCarregando(false);
    }
  };

  const atualizar = async () => {
    if (!agenteId) return;
    setGravando(true);
    try {
      const r = await apiClient.post<{ data: { version_number: number; agent_id: string } }>("/api/v1/sales/agente-do-escritorio", { agent_id: agenteId });
      toast.success(`${t("Rascunho criado (versão")} ${r.data.version_number}). ${t("Abra o agente para revisar e publicar.")}`);
      setAberto(false);
      window.location.href = `/app/ai/agents/${r.data.agent_id}`;
    } catch (e) {
      showApiError(e);
    } finally {
      setGravando(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => void abrir()} data-testid="atualizar-agente-do-escritorio">
        {t("Atualizar agente do escritório")}
      </Button>
      {aberto && (
        <Dialog open onOpenChange={(v) => !v && !gravando && setAberto(false)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("Atualizar agente do escritório")}</DialogTitle>
              <DialogDescription>
                {t("Traz o texto do agente montado no Sales (cadastro do escritório + Atendimento com IA) e grava como um RASCUNHO do agente escolhido. A versão publicada continua atendendo até você publicar o rascunho.")}
              </DialogDescription>
            </DialogHeader>
            {carregando || !estado ? (
              <p className="text-sm text-muted-foreground" role="status">{t("Carregando…")}</p>
            ) : estado.erro_sales ? (
              <p className="rounded-md border border-destructive/40 p-3 text-sm text-destructive" role="alert">{estado.erro_sales}</p>
            ) : estado.agentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("Você ainda não tem um agente. Crie o agente primeiro e depois volte aqui para trazer o texto do escritório.")}</p>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="agente-do-escritorio">{t("Agente que será atualizado")}</Label>
                  <select id="agente-do-escritorio" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={agenteId} onChange={(e) => setAgenteId(e.target.value)}>
                    {estado.agentes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                {estado.pendencias.length > 0 && (
                  <div className="rounded-md border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-medium">{t("Falta preencher no Sales (Configurações › Atendimento com IA):")}</p>
                    <ul className="mt-1 list-disc pl-5">{estado.pendencias.map((p) => <li key={p}>{p}</li>)}</ul>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{t("O texto do rascunho SUBSTITUI o prompt da versão atual do agente. O modelo, as ferramentas e os funis são mantidos.")}</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAberto(false)} disabled={gravando}>{t("Cancelar")}</Button>
              <Button onClick={() => void atualizar()} disabled={gravando || carregando || !estado || !!estado.erro_sales || !agenteId}>
                {gravando ? t("Gravando…") : t("Criar rascunho")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
