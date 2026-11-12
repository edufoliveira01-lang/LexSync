"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { lembrarSistema, origemDoSistema } from "@/lib/auth/enderecoDoSistema";
import { safeNext } from "@/lib/auth/safe-next";

/**
 * Parada de um instante na entrada vinda do sistema do escritório: o endereço do sistema chega assinado pela ponte, é guardado
 * (para o botão "Sistema" do menu voltar para lá) e a pessoa segue para o destino de sempre.
 */
export default function SistemaOrigem() {
  const params = useSearchParams();
  useEffect(() => {
    const origem = origemDoSistema(params.get("de") ?? "");
    if (origem) lembrarSistema(origem);
    window.location.replace(safeNext(params.get("para"), "/app"));
  }, [params]);
  return null;
}
