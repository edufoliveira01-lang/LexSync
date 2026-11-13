"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";
import { rotuloDoStatus, tomDoStatus } from "@/lib/followup/eventos-legiveis";
import { CircleNotch, Play } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

type Inscricao = { id: string; pointer_id: string; contact_id: string; status: string };
type Fluxo = { id: string; name: string; status: string; active_version_id: string | null };

const OCUPAM_A_VAGA = ["active", "waiting_reply", "paused_handoff", "paused_manual", "dormente"];
const lista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * "Follow-up" ao lado de Programar: o atendente escolhe um fluxo da lista e ativa na conversa — dali em diante o sistema envia as
 * mensagens do roteiro sozinho, nos tempos do fluxo. Com um follow-up já rodando, o painel mostra qual é e deixa parar.
 * Usa as mesmas rotas do painel do contato (o servidor decide quem pode inscrever e quem pode parar).
 */
export function AtivarFollowup({
  conversationId,
  contactId,
  somenteLeitura = false,
  podeParar = false,
}: {
  conversationId: string;
  contactId: string | null;
  somenteLeitura?: boolean;
  podeParar?: boolean;
}) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [inscricoes, setInscricoes] = useState<Inscricao[] | null>(null);
  const [fluxos, setFluxos] = useState<Fluxo[] | null>(null);
  const [podeInscrever, setPodeInscrever] = useState(false);
  const [escolhido, setEscolhido] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!contactId || !aberto) return;
    let cancelado = false;
    setErro(false);
    void (async () => {
      try {
        const [rIns, rFluxos] = await Promise.all([
          apiClient.get<{ data: Inscricao[]; meta?: { pode_inscrever?: boolean } }>(`/api/v1/ai/followups/enrollments?contact_id=${encodeURIComponent(contactId)}`),
          apiClient.get<{ data: Fluxo[] }>("/api/v1/ai/followup-flows"),
        ]);
        if (cancelado) return;
        setInscricoes(lista<Inscricao>(rIns.data).filter((e) => e.contact_id === contactId));
        setPodeInscrever(rIns.meta?.pode_inscrever === true);
        setFluxos(lista<Fluxo>(rFluxos.data));
      } catch {
        if (!cancelado) setErro(true);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [contactId, aberto, tentativa]);

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);
  if (!contactId) return null;

  const rodando = (inscricoes ?? []).find((e) => OCUPAM_A_VAGA.includes(e.status)) ?? null;
  const ativos = (fluxos ?? []).filter((f) => f.status === "active" && f.active_version_id);
  const nome = (id: string) => (fluxos ?? []).find((f) => f.id === id)?.name ?? t("Fluxo de follow-up");

  const ativar = async () => {
    if (!escolhido) return;
    setSalvando(true);
    try {
      await apiClient.post("/api/v1/ai/followups/enrollments", { pointer_id: escolhido, contact_id: contactId, conversation_id: conversationId });
      toast.success(t("Follow-up ativado nesta conversa."));
      setEscolhido("");
      recarregar();
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === "service_channel_not_found" ? t("Conecte um número de WhatsApp antes de iniciar o follow-up.") : t("Não foi possível iniciar o follow-up."));
    } finally {
      setSalvando(false);
    }
  };

  const parar = async () => {
    if (!rodando) return;
    setSalvando(true);
    try {
      await apiClient.post(`/api/v1/ai/followups/enrollments/${rodando.id}/cancel`, {});
      toast.success(t("Follow-up encerrado."));
      recarregar();
    } catch {
      toast.error(t("Não foi possível encerrar o follow-up."));
    } finally {
      setSalvando(false);
    }
  };

  const carregando = !erro && (inscricoes === null || fluxos === null);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="ativar-followup"
          title={t("Ativar um follow-up: o sistema envia as mensagens do roteiro sozinho")}
          className="inline-flex h-[26px] items-center gap-1 rounded-full border border-border bg-surface px-2.5 text-[11.5px] font-semibold transition hover:border-accent-300"
        >
          <Play size={13} aria-hidden />
          {t("Follow-up")}
          {rodando && <span className="ml-0.5 size-1.5 rounded-full bg-accent" aria-label={t("Em andamento")} />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[22rem] space-y-3 p-4">
        <div>
          <p className="text-sm font-semibold">{t("Follow-up da conversa")}</p>
          <p className="text-xs text-muted-foreground">{t("Escolha o roteiro: o sistema envia as mensagens programadas dele, nos tempos definidos.")}</p>
        </div>

        {carregando ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><CircleNotch size={14} className="animate-spin" aria-hidden />{t("Carregando…")}</p>
        ) : erro ? (
          <p className="text-xs text-muted-foreground">{t("Não foi possível carregar os follow-ups.")}</p>
        ) : (
          <>
            {rodando && (
              <div className="rounded-md border border-border bg-surface p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{nome(rodando.pointer_id)}</span>
                  <Badge variant={tomDoStatus(rodando.status)}>{rotuloDoStatus(rodando.status, t)}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{t("Já está ativo nesta conversa. Para trocar de roteiro, pare este antes.")}</p>
                {podeParar && !somenteLeitura && (
                  <Button variant="outline" size="sm" className="mt-2" disabled={salvando} onClick={parar} data-testid="parar-followup-conversa">
                    {t("Parar follow-up")}
                  </Button>
                )}
              </div>
            )}
            {!rodando && (
              ativos.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("Nenhum follow-up ativo. Crie e publique um em Agente de IA → Follow-ups.")}</p>
              ) : (
                <>
                  <ul className="max-h-48 space-y-1.5 overflow-y-auto" role="radiogroup" aria-label={t("Fluxo de follow-up")}>
                    {ativos.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={escolhido === f.id}
                          onClick={() => setEscolhido(f.id)}
                          className={cn("flex w-full items-center justify-between rounded-md border bg-surface px-3 py-2 text-left text-sm transition", escolhido === f.id ? "border-accent" : "border-border hover:border-accent-300")}
                        >
                          <span className="truncate">{f.name}</span>
                          <span className={cn("size-3.5 shrink-0 rounded-full border", escolhido === f.id ? "border-accent bg-accent" : "border-border")} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {!podeInscrever || somenteLeitura ? (
                    <p className="text-xs text-muted-foreground">{t("Só quem atende esta conversa pode ativar um follow-up.")}</p>
                  ) : (
                    <Button className="w-full" disabled={salvando || !escolhido} onClick={ativar} data-testid="confirmar-followup">
                      {salvando && <CircleNotch size={14} className="animate-spin" aria-hidden />}
                      {t("Ativar follow-up")}
                    </Button>
                  )}
                </>
              )
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
