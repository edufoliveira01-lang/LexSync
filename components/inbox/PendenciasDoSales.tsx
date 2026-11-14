"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Warning } from "@phosphor-icons/react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

/** Evento que a anotação rápida dispara depois de salvar: a faixa relê as pendências na hora (uma anotação importante nova aparece sem recarregar). */
export const EVENTO_PENDENCIAS_ATUALIZAR = "pendencias-sales:atualizar";

interface Pendencia { id: number; origem: "cadastro" | "processo"; autor: string; texto: string; criado_em: string; onde: string }
const quando = (iso: string) => { const d = new Date(`${iso.replace(" ", "T")}Z`); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); };

/**
 * Fork Sales — as pendências do cliente, no chat.
 *
 * Anotação marcada como IMPORTANTE no Sales (ex.: "preciso do documento deste cliente") fica aqui, numa faixa logo abaixo do
 * cabeçalho da conversa, até alguém dar como cumprida. Quem atende vê o que falta sem sair da conversa; "Cumprido" some o aviso
 * nos dois sistemas. Sem Sales ligado, sem cliente ou sem pendência: a faixa não aparece.
 */
export function PendenciasDoSales({ conversationId }: { conversationId: string }) {
  const t = useT();
  const [itens, setItens] = useState<Pendencia[]>([]);
  const [aberta, setAberta] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const r = await apiClient.get<{ data: { pendencias: Pendencia[] } }>(`/api/v1/conversations/${conversationId}/pendencias-sales`);
      setItens(r.data.pendencias ?? []);
    } catch { /* o aviso é um extra: o chat segue sem ele */ }
  }, [conversationId]);

  useEffect(() => {
    setItens([]);
    void carregar();
    const aoAtualizar = () => void carregar();
    window.addEventListener(EVENTO_PENDENCIAS_ATUALIZAR, aoAtualizar);
    const timer = window.setInterval(() => void carregar(), 120_000);
    return () => { window.removeEventListener(EVENTO_PENDENCIAS_ATUALIZAR, aoAtualizar); window.clearInterval(timer); };
  }, [carregar]);

  async function cumprir(p: Pendencia) {
    try {
      await apiClient.post(`/api/v1/conversations/${conversationId}/pendencias-sales`, { origem: p.origem, id: p.id });
      setItens((a) => a.filter((x) => !(x.id === p.id && x.origem === p.origem)));
      toast.success(t("Pendência cumprida."));
    } catch (e) {
      showApiError(e);
    }
  }

  if (itens.length === 0) return null;
  return (
    <section role="alert" aria-label={t("Pendências do cliente")} data-testid="pendencias-do-sales" className="border-b border-warning/40 bg-warning-bg px-4 py-2.5">
      <button type="button" onClick={() => setAberta((v) => !v)} aria-expanded={aberta} className="flex w-full items-center gap-2 text-left text-sm font-semibold text-text">
        <Warning size={16} weight="fill" className="shrink-0 text-warning" aria-hidden />
        <span className="flex-1">{itens.length === 1 ? t("Há 1 pendência neste cliente") : `${t("Há")} ${itens.length} ${t("pendências neste cliente")}`}</span>
        <span className="text-xs font-normal text-text-muted">{aberta ? t("Recolher") : t("Ver")}</span>
      </button>
      {aberta && (
        <ul className="mt-2 space-y-1.5">
          {itens.map((p) => (
            <li key={`${p.origem}-${p.id}`} className="flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-sm font-medium text-text">{p.texto}</p>
                <p className="mt-0.5 text-xs text-text-muted">{p.autor || "—"} · {quando(p.criado_em)} · {p.onde}</p>
              </div>
              <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => void cumprir(p)}>
                <Check size={14} weight="bold" aria-hidden />{t("Cumprido")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
