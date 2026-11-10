"use client";

import type { CustomFieldDef } from "@/lib/schemas/settings";
import { etiquetasDoCard } from "@/lib/leads/campos-no-card";
import type { Lead } from "@/lib/types/leads";

/**
 * Os campos que o funil escolheu mostrar NO CARD (fork Sales): "Benefício: BPC", "Ação: Aposentadoria"… — o que se lê de relance para saber do que se
 * trata o negócio sem abri-lo. Some por inteiro quando o funil não marca campo nenhum ou o negócio não tem valor neles: o card de quem não usa o
 * recurso não muda em nada.
 */
export function CamposNoCard({ lead, defs }: { lead: Pick<Lead, "custom_fields">; defs?: readonly CustomFieldDef[] }) {
  const etiquetas = etiquetasDoCard(defs ?? [], lead.custom_fields);
  if (etiquetas.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1" data-testid="campos-no-card">
      {etiquetas.map((e) => (
        <span
          key={e.chave}
          title={`${e.rotulo}: ${e.valor}`}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] leading-4"
        >
          <span className="shrink-0 text-text-muted">{e.rotulo}:</span>
          <span className="truncate font-medium text-text">{e.valor}</span>
        </span>
      ))}
    </div>
  );
}
