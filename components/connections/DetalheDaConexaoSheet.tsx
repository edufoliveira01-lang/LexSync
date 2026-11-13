"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { channelLabel, type ChannelSession } from "@/hooks/channels/useChannelSessions";
import { ArrowsClockwise, CircleNotch, Pause, Play, ShieldCheck, Trash, UsersThree } from "@/lib/ui/icons";

import { ChannelAcervo } from "./ChannelAcervo";
import { ChannelAiAccess } from "./ChannelAiAccess";
import { ChannelHistorico } from "./ChannelHistorico";
import { RenomearConexao } from "./RenomearConexao";

/**
 * O painel lateral de UMA conexão: o cartão da lista fica limpo (nome, número, estado) e tudo o que se faz com o número mora aqui,
 * em duas abas — Informações (quem é, detalhes, responsáveis, acesso da IA, histórico) e Gerenciar (reconectar, proteção de envio,
 * pausar, grupos e, no fim, o Excluir em vermelho).
 */
export function DetalheDaConexaoSheet({
  canal,
  tipo,
  estado,
  pausado,
  responsaveis,
  ocupado,
  vivaNoTransporte,
  servicoAtivo,
  podeExcluir,
  temGrupos,
  onFechar,
  onRenomeado,
  onReconectar,
  onProtecao,
  onAlternarPausa,
  onGrupos,
  onExcluir,
}: {
  canal: ChannelSession | null;
  /** "QR Code" ou "API oficial" — já traduzido. */
  tipo: string;
  estado: { label: string; variant: "success" | "warning" | "error" | "neutral" };
  pausado: boolean;
  responsaveis: string;
  ocupado: boolean;
  vivaNoTransporte: boolean;
  servicoAtivo: boolean;
  podeExcluir: boolean;
  temGrupos: boolean;
  onFechar: () => void;
  onRenomeado: () => void;
  onReconectar: () => void;
  onProtecao: () => void;
  onAlternarPausa: () => void;
  onGrupos: () => void;
  onExcluir: () => void;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const quando = (v: string | null | undefined) => (v ? new Date(v).toLocaleString(tag) : "—");
  const nome = canal ? channelLabel(canal, t) : "";

  return (
    <Sheet open={canal !== null} onOpenChange={(v) => (v ? undefined : onFechar())}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 bg-surface p-0 sm:max-w-xl" data-testid="detalhe-da-conexao">
        {canal && (
          <>
            <div className="border-b border-border px-6 pb-4 pt-6">
              <p className="mb-2 inline-flex items-center rounded-full border border-border bg-surface px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                {t("Conexão")}
              </p>
              <SheetTitle className="text-2xl font-semibold tracking-tight">{nome}</SheetTitle>
              <SheetDescription className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant={estado.variant}>{estado.label}</Badge>
                {pausado && <Badge variant="neutral">{t("Pausado")}</Badge>}
                {canal.phone_number && <span className="font-mono text-xs">{canal.phone_number}</span>}
              </SheetDescription>
            </div>

            <Tabs defaultValue="info" className="flex min-h-0 flex-1 flex-col">
              <div className="px-6 pt-4">
                <TabsList>
                  <TabsTrigger value="info">{t("Informações")}</TabsTrigger>
                  <TabsTrigger value="gerenciar">{t("Gerenciar")}</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="info" className="mt-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <section className="space-y-1.5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("Nome da conexão")}</h3>
                  <RenomearConexao channelId={canal.id} currentName={canal.display_name} onSaved={onRenomeado} />
                </section>

                <section className="space-y-1.5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("Detalhes")}</h3>
                  <dl className="divide-y divide-border rounded-md border border-border bg-surface text-sm">
                    <Linha rotulo={t("Tipo")} valor={tipo} />
                    <Linha rotulo={t("Número")} valor={canal.phone_number ?? "—"} mono />
                    <Linha rotulo={t("Criada em")} valor={quando(canal.created_at)} />
                    <Linha rotulo={t("Última verificação")} valor={canal.last_health_check_at ? quando(canal.last_health_check_at) : t("Ainda não verificado")} />
                    <Linha rotulo={t("Quem atende")} valor={responsaveis} />
                  </dl>
                </section>

                <section className="space-y-3">
                  <ChannelAiAccess channelId={canal.id} />
                  {vivaNoTransporte && <ChannelAcervo channelId={canal.id} />}
                  {vivaNoTransporte && <ChannelHistorico channelId={canal.id} />}
                </section>
              </TabsContent>

              <TabsContent value="gerenciar" className="mt-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <section className="space-y-1.5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("Sessão")}</h3>
                  <div className="divide-y divide-border rounded-md border border-border bg-surface">
                    {vivaNoTransporte && (
                      <Acao
                        titulo={t("Corrigir problemas no número")}
                        texto={t("Para quando a conexão fica instável ou as mensagens não saem. Gera um novo QR Code se preciso.")}
                      >
                        <Button variant="outline" size="sm" disabled={ocupado || !servicoAtivo} onClick={onReconectar}>
                          {ocupado ? <CircleNotch size={14} className="animate-spin" aria-hidden /> : <ArrowsClockwise size={14} aria-hidden />}
                          {t("Reconectar")}
                        </Button>
                      </Acao>
                    )}
                    <Acao
                      titulo={pausado ? t("Retomar atendimento") : t("Pausar atendimento")}
                      texto={
                        pausado
                          ? t("O número volta a receber e enviar mensagens.")
                          : t("O número deixa de enviar e receber por aqui. As conversas e os dados continuam todos no sistema.")
                      }
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={ocupado}
                        aria-label={pausado ? `${t("Retomar")} ${nome}` : `${t("Pausar")} ${nome}`}
                        onClick={onAlternarPausa}
                      >
                        {ocupado ? <CircleNotch size={14} className="animate-spin" aria-hidden /> : pausado ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
                        {pausado ? t("Retomar") : t("Pausar")}
                      </Button>
                    </Acao>
                    <Acao titulo={t("Proteção de envio")} texto={t("Limites e intervalos para o número não ser bloqueado pelo WhatsApp.")}>
                      <Button variant="outline" size="sm" onClick={onProtecao}>
                        <ShieldCheck size={14} aria-hidden />
                        {t("Proteção de envio")}
                      </Button>
                    </Acao>
                    {temGrupos && (
                      <Acao titulo={t("Grupos")} texto={t("Os grupos do WhatsApp que este número acompanha.")}>
                        <Button variant="outline" size="sm" onClick={onGrupos}>
                          <UsersThree size={14} aria-hidden />
                          {t("Grupos")}
                        </Button>
                      </Acao>
                    )}
                  </div>
                </section>

                <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                  <p className="max-w-sm text-xs text-muted-foreground">
                    {t("Tira esta conexão da conta agora. Guardamos tudo por 30 dias, para o caso de engano; depois apagamos de vez, sem volta. Conectar este número de novo depois disso cria uma conexão nova.")}
                  </p>
                  <Button
                    variant="destructive"
                    disabled={!podeExcluir}
                    aria-label={
                      podeExcluir
                        ? `${t("Excluir")} ${nome}`
                        : `${t("Excluir")} ${nome} — ${t("indisponível enquanto o serviço do WhatsApp não estiver ativo")}`
                    }
                    onClick={onExcluir}
                  >
                    <Trash size={14} aria-hidden />
                    {t("Excluir conexão")}
                  </Button>
                </section>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Linha({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className={mono ? "text-right font-mono text-xs" : "text-right"}>{valor}</dd>
    </div>
  );
}

function Acao({ titulo, texto, children }: { titulo: string; texto: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{texto}</p>
      </div>
      {children}
    </div>
  );
}
