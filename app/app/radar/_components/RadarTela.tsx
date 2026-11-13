"use client";

import { CabecalhoDaPagina } from "@/components/ui/cabecalho-da-pagina";
import { useT } from "@/hooks/i18n/useT";
import { RiskRadarList } from "./RiskRadarList";

/** A tela do Radar (cabeçalho + lista). Fica num componente só para a página e o preview de desenvolvimento mostrarem o mesmo desenho. */
export function RadarTela() {
  const t = useT();
  return (
    <div className="flex h-full flex-col gap-6">
      <CabecalhoDaPagina
        area={t("Atendimento")}
        titulo={t("Radar de risco")}
        descricao={t(
          "Demandas abertas que esfriaram e precisam de você. Se o assistente já agendou um retorno, aparece como “em voo”; sem próximo passo, é risco de perder o cliente.",
        )}
      />
      <RiskRadarList />
    </div>
  );
}
