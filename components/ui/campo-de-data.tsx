"use client";

import { useState } from "react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Calendario } from "@/components/ui/calendario";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarBlank } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

type Tipo = "date" | "datetime-local";
const FORMATO: Record<Tipo, string> = { date: "yyyy-MM-dd", "datetime-local": "yyyy-MM-dd'T'HH:mm" };

/** Mesma assinatura do <input> nativo (value "yyyy-MM-dd" ou "yyyy-MM-ddTHH:mm", onChange com e.target.value), com o calendário do sistema. */
export function CampoDeData({
  type = "date",
  value,
  onChange,
  min,
  max,
  id,
  disabled,
  className,
  placeholder,
  ...resto
}: {
  type?: Tipo;
  value: string;
  onChange: (e: { target: { value: string }; currentTarget: { value: string } }) => void;
  min?: string;
  max?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
  required?: boolean;
  name?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ler = (v?: string) => {
    if (!v) return undefined;
    const d = parse(v.slice(0, FORMATO[type].replace(/'/g, "").length), FORMATO[type], new Date());
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  const atual = ler(value);
  const emitir = (d: Date) => { const v = format(d, FORMATO[type]); onChange({ target: { value: v }, currentTarget: { value: v } }); };
  const hora = atual ? format(atual, "HH:mm") : "09:00";
  const escolherDia = (d: Date) => {
    const [h = 9, m = 0] = hora.split(":").map(Number);
    const novo = new Date(d); novo.setHours(type === "date" ? 0 : h, type === "date" ? 0 : m, 0, 0);
    emitir(novo);
    if (type === "date") setAberto(false);
  };
  const texto = atual ? format(atual, type === "date" ? "dd/MM/yyyy" : "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : (placeholder ?? "Escolher data");
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button type="button" id={id} disabled={disabled} aria-label={resto["aria-label"]}
          className={cn("flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-left text-sm transition hover:border-accent-300 disabled:opacity-50", !atual && "text-muted-foreground", className)}>
          <span className="truncate">{texto}</span>
          <CalendarBlank size={16} className="shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <Calendario value={atual} onSelect={escolherDia} min={ler(min)} max={ler(max)} />
        {type === "datetime-local" && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
            <label className="text-xs font-medium text-muted-foreground" htmlFor={`${id ?? "campo"}-hora`}>Horário</label>
            <input id={`${id ?? "campo"}-hora`} type="time" value={hora}
              onChange={(e) => { const base = atual ?? new Date(); const [h = 9, m = 0] = (e.target.value || "09:00").split(":").map(Number); const n = new Date(base); n.setHours(h, m, 0, 0); emitir(n); }}
              className="h-8 rounded-md border border-border bg-surface px-2 text-sm" />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
