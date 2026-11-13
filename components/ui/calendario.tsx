"use client";

import { useMemo, useState } from "react";
import { addDays, addMonths, endOfMonth, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

import { CaretLeft, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];

/**
 * Calendário mensal do sistema: um só desenho para todas as telas (campos de data, programar mensagem, relógio da barra do topo).
 * Semana começa no domingo, hoje em destaque com borda, dia escolhido em cheio; dias fora de [min, max] ficam apagados.
 */
export function Calendario({
  value,
  onSelect,
  min,
  max,
  marcados,
  className,
}: {
  value?: Date | null;
  onSelect?: (d: Date) => void;
  min?: Date;
  max?: Date;
  /** Dias com algo marcado (aparece um pontinho embaixo). */
  marcados?: Date[];
  className?: string;
}) {
  const [mes, setMes] = useState(() => startOfMonth(value ?? new Date()));
  const hoje = new Date();
  const dias = useMemo(() => {
    const ini = startOfWeek(startOfMonth(mes));
    return Array.from({ length: 42 }, (_, i) => addDays(ini, i));
  }, [mes]);
  const fora = (d: Date) => (min && startOfDay(d) < startOfDay(min)) || (max && startOfDay(d) > startOfDay(max));
  const titulo = format(mes, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className={cn("w-[17.5rem] select-none", className)} data-testid="calendario">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Mês anterior" onClick={() => setMes(addMonths(mes, -1))}
          className="flex size-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition hover:border-border hover:text-foreground">
          <CaretLeft size={14} weight="bold" aria-hidden />
        </button>
        <button type="button" onClick={() => setMes(startOfMonth(hoje))} title="Ir para hoje"
          className="rounded-md px-2 py-1 text-sm font-semibold capitalize tracking-tight hover:bg-muted/60">
          {titulo}
        </button>
        <button type="button" aria-label="Próximo mês" onClick={() => setMes(addMonths(mes, 1))}
          className="flex size-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition hover:border-border hover:text-foreground">
          <CaretRight size={14} weight="bold" aria-hidden />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {DIAS.map((d, i) => <span key={i} className="py-1">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {dias.map((d) => {
          const doMes = isSameMonth(d, endOfMonth(mes));
          const escolhido = value ? isSameDay(d, value) : false;
          const ehHoje = isSameDay(d, hoje);
          const marcado = marcados?.some((m) => isSameDay(m, d));
          return (
            <button
              key={d.toISOString()}
              type="button"
              disabled={Boolean(fora(d))}
              aria-label={format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              aria-pressed={escolhido}
              onClick={() => onSelect?.(d)}
              className={cn(
                "relative mx-auto flex size-9 items-center justify-center rounded-full border text-sm transition",
                escolhido ? "border-accent bg-accent font-semibold text-white"
                  : ehHoje ? "border-accent/60 font-semibold text-accent"
                  : "border-transparent hover:border-border",
                !doMes && !escolhido && "text-muted-foreground/50",
                fora(d) && "cursor-not-allowed opacity-30 hover:border-transparent",
              )}
            >
              {d.getDate()}
              {marcado && <span className={cn("absolute bottom-1 size-1 rounded-full", escolhido ? "bg-white" : "bg-accent")} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
