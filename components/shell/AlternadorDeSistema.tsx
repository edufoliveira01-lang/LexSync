"use client";

import { useEffect, useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";
import { Headset, SquaresFour } from "@/lib/ui/icons";
import { lembrarSistema, origemDoSistema, sistemaLembrado } from "@/lib/auth/enderecoDoSistema";

/**
 * "Atendimento | Sistema" no topo do menu, espelho do alternador do Sales. O endereço do sistema é guardado neste navegador na
 * primeira vez (ou no login federado); a ida é por `/atendimento` do Sales, que já está logado ou pede a senha de lá.
 */
export function AlternadorDeSistema({ recolhido }: { recolhido?: boolean }) {
  const t = useT();
  const [origem, setOrigem] = useState<string | null>(null);
  useEffect(() => {
    setOrigem(sistemaLembrado());
    // O servidor sabe o endereço do escritório (o mesmo desenho do painel); vale mais que o que ficou guardado no navegador.
    let vivo = true;
    fetch("/api/v1/sales/sistema-url", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: { url?: string | null } } | null) => {
        const o = origemDoSistema(j?.data?.url ?? "");
        if (vivo && o) {
          lembrarSistema(o);
          setOrigem(o);
        }
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const irParaOSistema = () => {
    let destino = origem;
    if (!destino) {
      const resposta = window.prompt(t("Endereço do sistema do seu escritório (ex.: sistema.seuescritorio.com.br)"));
      destino = resposta ? origemDoSistema(resposta) : null;
      if (!destino) return;
      lembrarSistema(destino);
      setOrigem(destino);
    }
    window.location.assign(`${destino}/`);
  };

  if (recolhido) return null;
  const base =
    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
  return (
    <div className="dz-copy px-3 pb-2 pt-1" role="group" aria-label={t("Ambiente")}>
      <div className="flex rounded-md bg-surface-elevated p-1">
        <button type="button" onClick={irParaOSistema} className={cn(base, "text-muted-foreground hover:text-foreground")}>
          <SquaresFour size={14} aria-hidden /> {t("Sistema")}
        </button>
        <span aria-current="true" className={cn(base, "bg-surface text-accent shadow-sm")}>
          <Headset size={14} aria-hidden /> {t("Atendimento")}
        </span>
      </div>
    </div>
  );
}
