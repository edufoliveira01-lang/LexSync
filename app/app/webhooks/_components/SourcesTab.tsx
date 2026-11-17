"use client";

import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";

import type { Locale } from "date-fns";
import * as React from "react";
import { formatDistanceToNowStrict } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MagnifyingGlass, PlugsConnected, Plus } from "@/lib/ui/icons";
import { SeloDeAutoria } from "@/components/operacao/SeloDeAutoria";
import { useWebhookSources, type WebhookSourceRow } from "@/hooks/webhooks/useWebhookSources";
import { CreateSourceDialog } from "./CreateSourceDialog";
import { SourceDetail } from "./SourceDetail";
import { useT } from "@/hooks/i18n/useT";

function lastReceivedLabel(iso: string | null, t: (texto: string) => string, locale: Locale): string {
  if (!iso) return t("nunca recebeu");
  return `${t("último recebimento")} ${formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: locale })}`;
}

export function SourcesTab() {
  const localeDaData = useLocaleDeData();
  const t = useT();
  const { data, isLoading } = useWebhookSources();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<WebhookSourceRow | null>(null);
  const [busca, setBusca] = React.useState("");

  const sources = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="grid gap-3 pt-4 sm:grid-cols-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const vazio = sources.length === 0;
  const termo = busca.trim().toLowerCase();
  const visiveis = termo ? sources.filter((s) => s.name.toLowerCase().includes(termo)) : sources;
  const ativas = sources.filter((s) => s.is_active).length;

  return (
    <div className="space-y-5 pt-4">
      {vazio ? (
        <section className="rounded-md border border-border bg-surface p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-accent">
              <PlugsConnected className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{t("Conecte o site ou o formulário do escritório em 2 minutos")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("Cada pessoa que preencher o formulário vira um contato no funil, já com a origem registrada.")}
              </p>
            </div>
          </div>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              t("Crie uma fonte e diga em qual funil o contato entra."),
              t("Copie o endereço ou o formulário pronto."),
              t("Cole no site do escritório — cada envio vira um contato aqui dentro."),
            ].map((texto, i) => (
              <li key={i} className="flex gap-3 rounded-md border border-border bg-surface p-4 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-50 text-xs font-semibold text-accent-700">{i + 1}</span>
                <span className="text-muted-foreground">{texto}</span>
              </li>
            ))}
          </ol>
          <Button className="mt-5" onClick={() => setCreateOpen(true)}>
            <Plus /> {t("Criar primeira fonte")}
          </Button>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-64 sm:max-w-sm">
              <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={t("Buscar fonte")}
                aria-label={t("Buscar fonte")}
                className="rounded-full pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {ativas} {ativas === 1 ? t("ativa") : t("ativas")} · {sources.length} {sources.length === 1 ? t("no total") : t("no total")}
            </p>
            <Button onClick={() => setCreateOpen(true)} className="ml-auto w-full sm:w-auto">
              <Plus /> {t("Nova fonte")}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visiveis.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected(s)}
                className="flex flex-col rounded-md border border-border bg-surface text-left shadow-xs transition hover:border-accent-300 hover:shadow-sm"
              >
                <span className="flex items-start gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-accent">
                    <PlugsConnected className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{lastReceivedLabel(s.last_received_at, t, localeDaData)}</span>
                  </span>
                  <Badge variant={s.is_active ? "success" : "neutral"}>{s.is_active ? t("Ativa") : t("Pausada")}</Badge>
                </span>
                {/* Desligada, ela para de receber contatos e ninguém do outro lado é avisado — quem a desligou entra na leitura do card. */}
                <span className="border-t border-border px-4 py-2.5">
                  <SeloDeAutoria kind={s.last_change_actor_kind} em={s.last_change_at} />
                </span>
              </button>
            ))}
            {visiveis.length === 0 && <p className="text-sm text-muted-foreground">{t("Nenhuma fonte encontrada para essa busca.")}</p>}
          </div>
        </>
      )}

      <CreateSourceDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={setSelected} />
      {selected ? (
        <SourceDetail source={selected} open={!!selected} onOpenChange={() => setSelected(null)} />
      ) : null}
    </div>
  );
}
