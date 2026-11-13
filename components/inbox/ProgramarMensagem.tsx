"use client";

import Link from "next/link";
import { QueryClientContext } from "@tanstack/react-query";
import { useContext, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useMensagensProgramadas } from "@/hooks/inbox/useMensagensProgramadas";
import { useT } from "@/hooks/i18n/useT";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { problemaDoHorario, TAMANHO_MAXIMO_DO_TEXTO } from "@/lib/mensagens-programadas/regras";
import { CampoDeData } from "@/components/ui/campo-de-data";
import { Clock, Trash } from "@/lib/ui/icons";

/** `datetime-local` quer "yyyy-MM-ddTHH:mm" na hora LOCAL. */
function paraCampo(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function amanhaAs(hora: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hora, 0, 0, 0);
  return d;
}

/**
 * "Programar mensagem": o atendente escolhe quando um texto sai sozinho. Por mensagem, decide se ela é CANCELADA caso o cliente
 * responda antes do horário (o padrão) ou se sai mesmo assim (envio permanente). As programadas ficam listadas, com cancelar.
 */
export function ProgramarMensagem({ conversationId }: { conversationId: string }) {
  // Sem provedor de consultas (testes de unidade, telas isoladas) o botão simplesmente não existe, em vez de derrubar a caixa de resposta.
  const provedor = useContext(QueryClientContext);
  if (!provedor) return null;
  return <ProgramarMensagemComDados conversationId={conversationId} />;
}

function ProgramarMensagemComDados({ conversationId }: { conversationId: string }) {
  const t = useT();
  const tag = useTagDeIdioma();
  const [aberto, setAberto] = useState(false);
  // A lista só é buscada quando o painel abre (e fica atualizando enquanto aberto): a caixa de resposta não ganha uma consulta a cada conversa.
  const { lista, criar, cancelar } = useMensagensProgramadas(conversationId, aberto);
  const [texto, setTexto] = useState("");
  const [quando, setQuando] = useState("");
  const [cancelaSeResponder, setCancelaSeResponder] = useState(true);

  const programadas = (lista.data ?? []).filter((m) => m.status === "pending" || m.status === "sending");
  const falhas = (lista.data ?? []).filter((m) => m.status === "failed");
  const horario = quando ? new Date(quando) : null;
  const problema = horario ? problemaDoHorario(horario) : "invalido";
  const podeSalvar = texto.trim().length > 0 && texto.length <= TAMANHO_MAXIMO_DO_TEXTO && problema === null && !criar.isPending;

  const programar = () => {
    if (!horario || !podeSalvar) return;
    criar.mutate(
      { body: texto.trim(), send_at: horario.toISOString(), cancel_on_reply: cancelaSeResponder },
      {
        onSuccess: () => {
          setTexto("");
          setQuando("");
          setCancelaSeResponder(true);
        },
      },
    );
  };

  const atalhos: { rotulo: string; valor: () => Date }[] = [
    { rotulo: t("Daqui a 1 hora"), valor: () => new Date(Date.now() + 60 * 60 * 1000) },
    { rotulo: t("Amanhã, 9h"), valor: () => amanhaAs(9) },
    { rotulo: t("Amanhã, 14h"), valor: () => amanhaAs(14) },
  ];

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="programar-mensagem"
          className="inline-flex h-[26px] items-center gap-1 rounded-full border border-border bg-surface px-2.5 text-[11.5px] font-semibold transition hover:border-accent-300"
          title={t("Programar uma mensagem para ser enviada sozinha")}
        >
          <Clock size={13} aria-hidden />
          {t("Programar")}
          {programadas.length > 0 && (
            <span className="ml-0.5 rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-accent-foreground">{programadas.length}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[22rem] space-y-3 p-4">
        <div>
          <p className="text-sm font-semibold">{t("Programar mensagem")}</p>
          <p className="text-xs text-muted-foreground">{t("O sistema envia sozinho, na data e hora escolhidas.")}</p>
        </div>

        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          maxLength={TAMANHO_MAXIMO_DO_TEXTO}
          placeholder={t("Escreva a mensagem que será enviada")}
          aria-label={t("Texto da mensagem programada")}
        />

        <div className="space-y-1.5">
          <label htmlFor="programar-quando" className="text-xs font-medium">
            {t("Enviar em")}
          </label>
          <CampoDeData
            id="programar-quando"
            type="datetime-local"
            value={quando}
            min={paraCampo(new Date(Date.now() + 60_000))}
            onChange={(e) => setQuando(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {atalhos.map((a) => (
              <button
                key={a.rotulo}
                type="button"
                onClick={() => setQuando(paraCampo(a.valor()))}
                className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:border-accent-300"
              >
                {a.rotulo}
              </button>
            ))}
          </div>
          {quando && problema === "muito_cedo" && <p className="text-xs text-error-fg">{t("Escolha um horário pelo menos um minuto à frente.")}</p>}
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border bg-surface p-3">
          <Switch checked={cancelaSeResponder} onCheckedChange={setCancelaSeResponder} aria-label={t("Cancelar se o cliente responder antes")} />
          <div className="min-w-0 text-xs">
            <p className="font-semibold">{t("Cancelar se o cliente responder antes")}</p>
            <p className="text-muted-foreground">
              {cancelaSeResponder
                ? t("Se o cliente escrever antes do horário, esta mensagem não é enviada.")
                : t("Envio permanente: sai no horário mesmo que o cliente responda.")}
            </p>
          </div>
        </div>

        <Button className="w-full" disabled={!podeSalvar} onClick={programar}>
          {criar.isPending ? t("Programando…") : t("Programar mensagem")}
        </Button>

        <Link href="/app/mensagens-programadas" className="block text-center text-xs font-semibold text-accent underline-offset-4 hover:underline">
          {t("Ver o controle de mensagens programadas")}
        </Link>

        {(programadas.length > 0 || falhas.length > 0) && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("Programadas nesta conversa")}</p>
            <ul className="max-h-40 space-y-1.5 overflow-y-auto">
              {programadas.map((m) => (
                <li key={m.id} className="flex items-start gap-2 rounded-md border border-border bg-surface p-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold tabular-nums">
                      {new Date(m.send_at).toLocaleString(tag, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      <span className="ml-2 font-normal text-muted-foreground">{m.cancel_on_reply ? t("cancela se responder") : t("envio permanente")}</span>
                    </p>
                    <p className="truncate text-muted-foreground">{m.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => cancelar.mutate(m.id)}
                    disabled={cancelar.isPending || m.status === "sending"}
                    aria-label={t("Cancelar mensagem programada")}
                    title={t("Cancelar")}
                    className="rounded-md p-1 text-muted-foreground transition hover:text-error-fg disabled:opacity-40"
                  >
                    <Trash size={14} aria-hidden />
                  </button>
                </li>
              ))}
              {falhas.map((m) => (
                <li key={m.id} className="rounded-md border border-error bg-error-bg p-2 text-xs text-error-fg">
                  <p className="font-semibold">{t("Não foi enviada")}</p>
                  <p className="truncate">{m.body}</p>
                  {m.error && <p className="opacity-80">{m.error}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
