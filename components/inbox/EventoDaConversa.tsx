"use client";

import { format } from "date-fns";

import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";
import { textoDoEvento } from "@/lib/inbox/evento-na-conversa-marca";
import { cn } from "@/lib/utils";
import type { Note } from "@/lib/types/messaging";

/**
 * Cada TIPO de acontecimento tem a sua cor, para o olho separar a história da conversa sem ler:
 *   azul = assumiu · roxo = transferiu · âmbar = liberou/devolveu à fila · cinza = fechou/arquivou · verde = reabriu/contrato assinado
 *   índigo = contrato enviado · rosa = automático · verde-água = a IA mexeu no funil (classificou / moveu o negócio) · azul-céu = follow-up (entrou, enviou, respondeu, concluiu).
 */
export type TipoDeEvento = "followup" | "crm" | "assumiu" | "transferiu" | "liberou" | "encerrou" | "reabriu" | "contrato_enviado" | "contrato_assinado" | "automatico" | "outro";

export function tipoDoEvento(texto: string): TipoDeEvento {
  const t = texto.toLowerCase();
  if (/^follow-up/.test(t)) return "followup";
  if (/moveu o neg[óo]cio|marcou o atendimento|atualizou o estado do atendimento/.test(t)) return "crm";
  if (/contrato.*assinad|assinou/.test(t)) return "contrato_assinado";
  if (/contrato/.test(t)) return "contrato_enviado";
  if (/reabriu/.test(t)) return "reabriu";
  if (/transferiu/.test(t)) return "transferiu";
  if (/devolveu|liberou/.test(t)) return "liberou";
  if (/fechou|encerrou|arquivou/.test(t)) return "encerrou";
  if (/assumiu/.test(t)) return "assumiu";
  if (/autom[aá]tico|\bia\b/.test(t)) return "automatico";
  return "outro";
}

const COR: Record<TipoDeEvento, string> = {
  followup: "border-sky-300 bg-sky-50 text-sky-700",
  crm: "border-teal-300 bg-teal-50 text-teal-700",
  assumiu: "border-accent-300 bg-accent-50 text-accent-700",
  transferiu: "border-purple-300 bg-purple-50 text-purple-700",
  liberou: "border-amber-300 bg-amber-50 text-amber-800",
  encerrou: "border-slate-300 bg-slate-100 text-slate-700",
  reabriu: "border-emerald-300 bg-emerald-50 text-emerald-700",
  contrato_enviado: "border-indigo-300 bg-indigo-50 text-indigo-700",
  contrato_assinado: "border-emerald-400 bg-emerald-100 text-emerald-800",
  automatico: "border-pink-300 bg-pink-50 text-pink-700",
  outro: "border-border bg-surface text-text-muted",
};

const PONTO: Record<TipoDeEvento, string> = {
  followup: "bg-sky-500",
  crm: "bg-teal-500",
  assumiu: "bg-accent",
  transferiu: "bg-purple-500",
  liberou: "bg-amber-500",
  encerrou: "bg-slate-500",
  reabriu: "bg-emerald-500",
  contrato_enviado: "bg-indigo-500",
  contrato_assinado: "bg-emerald-600",
  automatico: "bg-pink-500",
  outro: "bg-muted-foreground",
};

/** Fork Sales — linha centralizada: "Fulano assumiu / transferiu / fechou a conversa", com a cor do tipo de acontecimento. */
export function EventoDaConversa({ note }: { note: Note }) {
  useLocaleDeData();
  const texto = textoDoEvento(note.body);
  const tipo = tipoDoEvento(texto);
  return (
    <div data-testid="evento-da-conversa" data-tipo={tipo} className="my-1.5 flex items-center justify-center px-4 text-[11px]">
      <span className={cn("inline-flex max-w-[85%] items-center gap-1.5 truncate rounded-full border px-3 py-1 text-center font-medium", COR[tipo])}>
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PONTO[tipo])} aria-hidden />
        <span className="truncate">
          {texto} · {format(new Date(note.created_at), "dd/MM HH:mm")}
        </span>
      </span>
    </div>
  );
}
