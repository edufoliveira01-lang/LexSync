"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export interface ItemDeConfiguracao {
  href: string;
  label: string;
}
export interface GrupoDeConfiguracao {
  titulo: string;
  itens: ItemDeConfiguracao[];
}

/**
 * Menu das Configurações: todos os assuntos sempre à vista (no computador, uma coluna à esquerda; no celular, um seletor),
 * com busca. É o mesmo desenho do menu de Configurações do sistema Sales.
 */
export function SettingsNav({
  grupos,
  rotuloVisaoGeral,
  rotuloBuscar,
  rotuloIrPara,
  rotuloNada,
}: {
  grupos: GrupoDeConfiguracao[];
  rotuloVisaoGeral: string;
  rotuloBuscar: string;
  rotuloIrPara: string;
  rotuloNada: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtrados = useMemo(
    () =>
      grupos
        .map((g) => ({ ...g, itens: g.itens.filter((i) => !termo || i.label.toLowerCase().includes(termo)) }))
        .filter((g) => g.itens.length > 0),
    [grupos, termo],
  );

  const casam = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const maisEspecifico = grupos.flatMap((g) => g.itens.map((i) => i.href)).filter(casam).sort((a, b) => b.length - a.length)[0];
  const ativo = (href: string) => href === maisEspecifico;
  const emVisaoGeral = pathname === "/app/settings";
  const valorAtual = emVisaoGeral
    ? "/app/settings"
    : (grupos.flatMap((g) => g.itens).find((i) => ativo(i.href))?.href ?? "/app/settings");

  return (
    <>
      {/* Celular e tablet: seletor único */}
      <div className="lg:hidden">
        <label htmlFor="settings-ir-para" className="mb-1 block text-xs font-medium text-muted-foreground">
          {rotuloIrPara}
        </label>
        <select
          id="settings-ir-para"
          value={valorAtual}
          onChange={(e) => router.push(e.target.value)}
          className="h-11 w-full rounded-md border border-border bg-bg px-3 text-base text-text"
        >
          <option value="/app/settings">{rotuloVisaoGeral}</option>
          {grupos.map((g) => (
            <optgroup key={g.titulo} label={g.titulo}>
              {g.itens.map((i) => (
                <option key={i.href} value={i.href}>
                  {i.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Computador: menu lateral */}
      <nav aria-label={rotuloVisaoGeral} className="hidden lg:block">
        <div className="sticky top-6 max-h-[calc(100dvh-3rem)] space-y-4 overflow-y-auto rounded-lg border border-border bg-surface p-3">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={rotuloBuscar}
            aria-label={rotuloBuscar}
            className="h-9 w-full rounded-md border border-border bg-bg px-3 text-sm text-text placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:outline-hidden"
          />
          {!termo && (
            <Link
              href="/app/settings"
              aria-current={emVisaoGeral ? "page" : undefined}
              className={cn(
                "flex items-center rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                emVisaoGeral ? "dz-ativo-suave" : "text-text hover:bg-surface-elevated",
              )}
            >
              {rotuloVisaoGeral}
            </Link>
          )}
          {filtrados.length === 0 ? (
            <p className="px-3 text-xs text-muted-foreground">{rotuloNada}</p>
          ) : (
            filtrados.map((g) => (
              <div key={g.titulo}>
                <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{g.titulo}</p>
                <ul className="space-y-0.5">
                  {g.itens.map((i) => (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        aria-current={ativo(i.href) ? "page" : undefined}
                        className={cn(
                          "block truncate rounded-md px-3 py-1.5 text-sm transition-colors",
                          ativo(i.href)
                            ? "dz-ativo-suave font-semibold"
                            : "text-muted-foreground hover:bg-surface-elevated hover:text-text",
                        )}
                      >
                        {i.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </nav>
    </>
  );
}
