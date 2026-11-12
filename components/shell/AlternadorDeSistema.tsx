"use client";

import { useEffect, useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";
import { lembrarSistema, origemDoSistema, sistemaLembrado } from "@/lib/auth/enderecoDoSistema";

/**
 * "Atendimento | Sistema" no topo do menu, espelho do alternador do Sales. O endereço do sistema é guardado neste navegador na
 * primeira vez (ou no login federado); a ida é por `/atendimento` do Sales, que já está logado ou pede a senha de lá.
 */
export function AlternadorDeSistema({ recolhido }: { recolhido?: boolean }) {
  const t = useT();
  const [origem, setOrigem] = useState<string | null>(null);
  useEffect(() => setOrigem(sistemaLembrado()), []);

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
  return (
    <div className="px-3 pt-3">
      <div role="group" aria-label={t("Ambiente")} className="grid grid-cols-2 rounded-lg bg-surface-elevated p-0.5 text-xs font-semibold">
        <span aria-current="true" className="rounded-md bg-surface py-1.5 text-center text-accent shadow-sm">
          {t("Atendimento")}
        </span>
        <button
          type="button"
          onClick={irParaOSistema}
          className={cn("rounded-md py-1.5 text-center text-muted-foreground transition-colors hover:text-foreground")}
        >
          {t("Sistema")}
        </button>
      </div>
    </div>
  );
}
