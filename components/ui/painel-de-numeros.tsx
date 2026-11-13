import { cn } from "@/lib/utils";

export interface NumeroDoPainel {
  chave: string;
  rotulo: string;
  valor: number | undefined;
  /** Com `aoClicar` o cartão é um filtro (botão); sem, é só um número. */
  aoClicar?: () => void;
  ativo?: boolean;
  testId?: string;
}

/** Os cartões de número do alto das listas do Sales: o número grande, o rótulo embaixo, e o ativo com contorno azul. */
export function PainelDeNumeros({ itens, className }: { itens: NumeroDoPainel[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-4", className)}>
      {itens.map((i) => {
        const miolo = (
          <>
            <span className="block text-2xl font-semibold leading-none text-foreground">{i.valor ?? "—"}</span>
            <span className="mt-1.5 block text-xs text-muted-foreground">{i.rotulo}</span>
          </>
        );
        const base = "rounded-xl border p-4 text-left transition";
        return i.aoClicar ? (
          <button
            key={i.chave}
            type="button"
            onClick={i.aoClicar}
            aria-pressed={i.ativo ?? false}
            data-testid={i.testId}
            className={cn(
              base,
              i.ativo ? "border-accent bg-accent-50" : "border-border bg-surface hover:border-accent-400",
            )}
          >
            {miolo}
          </button>
        ) : (
          <div key={i.chave} className={cn(base, "border-border bg-surface")}>
            {miolo}
          </div>
        );
      })}
    </div>
  );
}
