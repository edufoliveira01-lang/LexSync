import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * O cabeçalho que abre cada aba de canal em Conexões (API oficial, parceiro, telefone, redes sociais, voz): ícone redondo, título,
 * uma frase do que o canal faz para o escritório, o estado à direita e as ações. Antes cada aba começava de um jeito diferente
 * (um título solto, um cartão sem hierarquia, um texto pequeno) e o usuário não sabia onde olhar primeiro.
 */
export function CabecalhoDeCanal({
  icone,
  titulo,
  descricao,
  estado,
  acoes,
  className,
}: {
  icone: ReactNode;
  titulo: string;
  descricao?: ReactNode;
  /** Normalmente um <Badge>: o canal está conectado ou não? */
  estado?: ReactNode;
  acoes?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start gap-3", className)}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-accent">{icone}</span>
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold leading-tight">{titulo}</h2>
          {estado}
        </div>
        {descricao ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
    </header>
  );
}

/** Passo a passo numerado, em cartões brancos lado a lado (como o estado vazio dos Webhooks). */
export function PassosDoCanal({ passos }: { passos: string[] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {passos.map((texto, i) => (
        <li key={i} className="flex gap-3 rounded-md border border-border bg-surface p-4 text-sm">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-50 text-xs font-semibold text-accent-700">{i + 1}</span>
          <span className="text-muted-foreground">{texto}</span>
        </li>
      ))}
    </ol>
  );
}

/** Aviso com ícone e tom (informação, sucesso, atenção, erro) no lugar das caixas de borda simples. */
export function AvisoDoCanal({
  tom = "info",
  children,
  role,
}: {
  tom?: "info" | "success" | "warning" | "error";
  children: ReactNode;
  role?: "alert" | "status";
}) {
  const cores = {
    info: "border-info-border bg-info-bg text-info-fg",
    success: "border-success-border bg-success-bg text-success-fg",
    warning: "border-warning bg-warning-bg text-warning-fg",
    error: "border-error bg-error-bg text-error-fg",
  }[tom];
  return (
    <div role={role} className={cn("rounded-md border p-3 text-sm", cores)}>
      {children}
    </div>
  );
}
