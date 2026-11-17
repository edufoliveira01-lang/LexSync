"use client";

import Link from "next/link";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { CaretRight, MagnifyingGlass } from "@/lib/ui/icons";

import { useAuth } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { blocosVisiveis } from "@/lib/ajuda/hub";
import { destinosDaInterface } from "@/lib/navigation/interface";
import { BlocoDoPapel } from "./_papel";

export function AjudaConteudo() {
  const t = useT();
  const [busca, setBusca] = useState("");
  const { user, activeOrg } = useAuth();
  // O mesmo contexto enriquecido pelo layout e a mesma régua do Sidebar.
  // Arrays vazios são intencionais: undefined desligaria esses filtros.
  const destinos = destinosDaInterface(
    activeOrg?.interface_settings,
    user.is_platform_admin && !user.support,
    activeOrg?.role ?? null,
    activeOrg?.modulos_ligados ?? [],
    activeOrg?.capacidades_ligadas ?? [],
  );
  // A leitura de Atualização aceita plataforma também em suporte; não é o
  // bypass de papel dos atalhos regulares (settings/atualizacao/page.tsx).
  const blocos = blocosVisiveis(user.is_platform_admin, destinos);

  const termo = busca.trim().toLowerCase();
  const filtrados = blocos
    .map((b) => ({
      ...b,
      itens: termo
        ? b.itens.filter((i) => `${t(i.texto)} ${t(i.detalhe)}`.toLowerCase().includes(termo))
        : b.itens,
    }))
    .filter((b) => b.itens.length > 0);

  return (
    <div className="flex h-full flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Ajuda")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "O caminho para cada tarefa, e onde ir quando algo não sai como esperado.",
          )}
        </p>
      </header>

      <div className="relative max-w-md">
        <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={t("O que você quer fazer?")}
          aria-label={t("Buscar na ajuda")}
          className="rounded-full pl-9"
        />
      </div>

      {/* O alcance do papel vem ANTES do índice: "posso" antes de "onde". */}
      <BlocoDoPapel papel={activeOrg?.role ?? null} destinos={destinos} />

      <div className="grid gap-5 md:grid-cols-2">
        {filtrados.map((bloco) => (
          <section key={bloco.titulo} className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t(bloco.titulo)}
            </h2>
            <ul className="flex flex-col gap-2">
              {bloco.itens.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    data-testid={`ajuda-${item.href.replace(/\//g, "-")}`}
                    className="group flex min-h-11 items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 transition hover:border-accent-300"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm font-semibold">{t(item.texto)}</span>
                      <span className="text-xs text-muted-foreground">{t(item.detalhe)}</span>
                    </span>
                    <CaretRight size={14} className="shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {filtrados.length === 0 && <p className="text-sm text-muted-foreground">{t("Nada encontrado para essa busca.")}</p>}
      </div>
    </div>
  );
}
