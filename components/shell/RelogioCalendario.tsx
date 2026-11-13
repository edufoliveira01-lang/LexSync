"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Calendario } from "@/components/ui/calendario";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Relógio da barra do topo; ao clicar abre o calendário do mês. */
export function RelogioCalendario() {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    setAgora(new Date());
    const id = setInterval(() => setAgora(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Abrir calendário" data-testid="relogio-topo"
          className="flex h-9 items-center rounded-md border border-transparent px-2 text-sm font-semibold tabular-nums text-foreground transition hover:border-border">
          {agora ? format(agora, "HH:mm") : "--:--"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
        <p className="mb-2 px-1 text-xs capitalize text-muted-foreground">{agora ? format(agora, "EEEE, d 'de' MMMM", { locale: ptBR }) : ""}</p>
        <Calendario value={agora} />
      </PopoverContent>
    </Popover>
  );
}
