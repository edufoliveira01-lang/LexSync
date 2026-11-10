"use client";
/**
 * Fork Sales — os campos em MODO LEITURA, como uma ficha: rótulo pequeno em cima, valor embaixo, em duas colunas.
 *
 * Os campos personalizados eram sempre um formulário (um input embaixo do outro), mesmo quando a pessoa só queria LER ("qual é o benefício? e o
 * CPF?"). Aqui a leitura vem primeiro, compacta e escaneável; o formulário só abre em "Editar". Campo vazio aparece como "—" (esmaecido): sumir
 * esconderia "dado faltando" como se o campo não existisse. Campo escondido por `mostrar_quando` continua escondido, como no formulário.
 */
import { useT } from "@/hooks/i18n/useT";
import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { valorDoCampoDeMoeda } from "@/lib/leads/campo-de-moeda";
import { valorParaOCard } from "@/lib/leads/campos-no-card";
import { MOEDA_PADRAO } from "@/lib/money";
import { camposVisiveis } from "@/lib/schemas/mostrar-quando";
import type { CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";

/** O texto que a ficha mostra para um valor, ou `null` quando o campo está vazio. */
export function textoDoCampo(def: CustomFieldDef, valor: unknown, moeda: string): string | null {
  if (def.type === "currency") {
    const n = typeof valor === "number" ? valor : typeof valor === "string" && valor.trim() ? Number(valor) : null;
    return n !== null && Number.isFinite(n) ? valorDoCampoDeMoeda(n, moeda) : null;
  }
  // `valorParaOCard` entende lista (rótulo da opção), várias escolhas, data e sim/não.
  return valorParaOCard(def as never, valor);
}

export function FichaDeCampos({ campos, valores, className }: { campos: readonly CustomFieldDef[]; valores: Record<string, unknown>; className?: string }) {
  const t = useT();
  const org = useActiveOrg();
  const moeda = org?.currency ?? MOEDA_PADRAO;
  const visiveis = camposVisiveis([...campos], valores);
  if (visiveis.length === 0) return null;
  return (
    <dl className={className ?? "grid grid-cols-2 gap-x-6 gap-y-4"} data-testid="ficha-de-campos">
      {visiveis.map((c) => {
        const texto = textoDoCampo(c, valores[c.key], moeda);
        const largo = c.type === "textarea" || (texto?.length ?? 0) > 40;
        const ehLink = c.type === "url" && texto !== null && /^https?:\/\//i.test(texto);
        return (
          <div key={c.key} className={largo ? "col-span-2" : undefined} data-testid={`ficha-campo-${c.key}`}>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</dt>
            <dd className={texto === null ? "mt-0.5 text-sm text-muted-foreground/60" : "mt-0.5 whitespace-pre-wrap break-words text-sm"}>
              {texto === null ? "—" : ehLink ? <a href={texto} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{texto}</a> : texto}
            </dd>
          </div>
        );
      })}
      <span className="sr-only">{t("Campos preenchidos e vazios")}</span>
    </dl>
  );
}
