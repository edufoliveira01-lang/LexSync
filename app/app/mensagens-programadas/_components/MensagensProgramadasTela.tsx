"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PainelDeNumeros } from "@/components/ui/painel-de-numeros";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { MagnifyingGlass, Trash } from "@/lib/ui/icons";
import type { LinhaDoControle, SituacaoDaProgramada } from "@/app/api/v1/scheduled-messages/route";

type Filtro = "todas" | SituacaoDaProgramada;

const ROTULO: Record<SituacaoDaProgramada, string> = {
  aguardando: "Aguardando",
  enviando: "Enviando",
  enviada: "Enviada",
  respondida: "Respondida",
  cancelada: "Cancelada",
  falhou: "Falhou",
};

const VARIANTE: Record<SituacaoDaProgramada, "success" | "warning" | "error" | "neutral" | "default"> = {
  aguardando: "warning",
  enviando: "warning",
  enviada: "default",
  respondida: "success",
  cancelada: "neutral",
  falhou: "error",
};

/** O controle das mensagens programadas: quem, para quem, quando, e o que aconteceu (enviada, respondida, cancelada, falhou). */
export function MensagensProgramadasTela() {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");

  const consulta = useQuery({
    queryKey: ["controle-de-mensagens-programadas"],
    refetchInterval: 30_000,
    queryFn: async () => (await apiClient.get<{ data: { linhas: LinhaDoControle[]; tabela_ausente: boolean } }>("/api/v1/scheduled-messages")).data,
  });
  const linhas = useMemo(() => consulta.data?.linhas ?? [], [consulta.data]);

  const contagem = (s: SituacaoDaProgramada) => linhas.filter((l) => l.situacao === s).length;
  const enviadasNoTotal = contagem("enviada") + contagem("respondida");

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (filtro !== "todas" && l.situacao !== filtro) return false;
      if (!termo) return true;
      return `${l.cliente} ${l.telefone ?? ""} ${l.body}`.toLowerCase().includes(termo);
    });
  }, [linhas, filtro, busca]);

  const cancelar = async (l: LinhaDoControle) => {
    try {
      await apiClient.delete(`/api/v1/conversations/${l.conversation_id}/scheduled-messages/${l.id}`);
      toast.success(t("Mensagem programada cancelada."));
      void qc.invalidateQueries({ queryKey: ["controle-de-mensagens-programadas"] });
    } catch {
      toast.error(t("Não foi possível cancelar."));
    }
  };

  const quando = (iso: string) => new Date(iso).toLocaleString(tag, { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

  const filtros: { v: Filtro; r: string; n: number }[] = [
    { v: "todas", r: t("Todas"), n: linhas.length },
    { v: "aguardando", r: t("Aguardando"), n: contagem("aguardando") },
    { v: "enviada", r: t("Enviadas"), n: contagem("enviada") },
    { v: "respondida", r: t("Respondidas"), n: contagem("respondida") },
    { v: "cancelada", r: t("Canceladas"), n: contagem("cancelada") },
    { v: "falhou", r: t("Falharam"), n: contagem("falhou") },
  ];

  return (
    <div className="flex flex-col gap-5" data-testid="controle-de-mensagens-programadas">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Mensagens programadas")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("O que a equipe programou para os clientes: quando sai, se foi enviada, se o cliente respondeu e o que foi cancelado.")}
        </p>
      </header>

      <PainelDeNumeros
        itens={[
          { chave: "aguardando", rotulo: t("Aguardando envio"), valor: consulta.isLoading ? undefined : contagem("aguardando") },
          { chave: "enviadas", rotulo: t("Enviadas"), valor: consulta.isLoading ? undefined : enviadasNoTotal },
          { chave: "respondidas", rotulo: t("Cliente respondeu depois"), valor: consulta.isLoading ? undefined : contagem("respondida") },
          { chave: "problemas", rotulo: t("Canceladas ou falhas"), valor: consulta.isLoading ? undefined : contagem("cancelada") + contagem("falhou") },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-64 sm:max-w-sm">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("Buscar cliente ou mensagem")} aria-label={t("Buscar cliente ou mensagem")} className="rounded-full pl-9" />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("Filtrar por situação")}>
          {filtros.map((f) => (
            <button
              key={f.v}
              type="button"
              aria-pressed={filtro === f.v}
              onClick={() => setFiltro(f.v)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition",
                filtro === f.v ? "border-accent bg-accent-50 font-semibold text-accent-700" : "border-border bg-surface font-medium text-muted-foreground hover:border-accent-300",
              )}
            >
              {f.r} <span className="tabular-nums opacity-70">{f.n}</span>
            </button>
          ))}
        </div>
      </div>

      {consulta.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : consulta.data?.tabela_ausente ? (
        <section className="rounded-md border border-warning bg-warning-bg p-5 text-sm text-warning-fg">
          <p className="font-semibold">{t("O controle ainda não está ativo nesta instalação.")}</p>
          <p className="mt-1">{t("Falta aplicar o SQL das mensagens programadas no banco (Supabase → SQL Editor).")}</p>
        </section>
      ) : linhas.length === 0 ? (
        <section className="rounded-md border border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium">{t("Nenhuma mensagem programada ainda.")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("Na conversa, use o botão Programar, ao lado de Nota interna.")}</p>
        </section>
      ) : visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("Nenhuma mensagem com esse filtro.")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((l) => (
            <li key={l.id} className="flex flex-wrap items-start gap-3 rounded-md border border-border bg-surface p-4 shadow-xs transition hover:border-accent-300">
              <div className="min-w-0 flex-1 basis-72">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/app/inbox/${l.conversation_id}`} className="truncate text-sm font-semibold hover:underline">
                    {l.cliente}
                  </Link>
                  {l.telefone && <span className="font-mono text-xs text-muted-foreground">{l.telefone}</span>}
                  <Badge variant={VARIANTE[l.situacao]}>{t(ROTULO[l.situacao])}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{l.body}</p>
                {l.motivo && <p className="mt-1 text-xs text-muted-foreground">{t(l.motivo)}</p>}
              </div>
              <dl className="grid shrink-0 grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-xs">
                <dt className="text-muted-foreground">{t("Programada para")}</dt>
                <dd className="font-semibold tabular-nums">{quando(l.send_at)}</dd>
                {l.enviada_em && (
                  <>
                    <dt className="text-muted-foreground">{t("Enviada em")}</dt>
                    <dd className="tabular-nums">{quando(l.enviada_em)}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">{t("Programada por")}</dt>
                <dd>{l.programada_por ?? "—"}</dd>
                <dt className="text-muted-foreground">{t("Se o cliente responder")}</dt>
                <dd>{l.cancel_on_reply ? t("cancela") : t("envia mesmo assim")}</dd>
              </dl>
              {l.situacao === "aguardando" && (
                <button
                  type="button"
                  onClick={() => void cancelar(l)}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface px-3 text-xs font-semibold transition hover:border-error hover:text-error-fg"
                  aria-label={t("Cancelar mensagem programada")}
                >
                  <Trash size={13} aria-hidden />
                  {t("Cancelar")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
