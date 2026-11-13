import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Cabeçalho de página no desenho do Sales: rótulo da área em maiúsculas (azul), título grande, descrição de 13px e as ações
 * (botão principal, secundários e o "⋯") alinhadas à direita.
 */
export function CabecalhoDaPagina({
  area,
  titulo,
  descricao,
  acoes,
  className,
}: {
  area?: string;
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 pb-1 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        {area ? (
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{area}</p>
        ) : null}
        <h1 className="text-[26px] font-semibold leading-[1.25] tracking-[-0.9px] text-foreground md:text-[30px]">{titulo}</h1>
        {descricao ? (
          <div className="mt-2 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">{descricao}</div>
        ) : null}
      </div>
      {acoes ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{acoes}</div> : null}
    </header>
  );
}
