"use client";
/**
 * Fork Sales — os campos do CONTATO no painel da conversa.
 *
 * Um campo do funil marcado "Este campo pertence a: Contato" (issue #2791) sai do card do negócio e passa a morar no cadastro da pessoa
 * (`contacts.custom_fields`). O painel da conversa só mostrava os campos do NEGÓCIO, então o campo "sumia" de quem atende. Este bloco
 * mostra os campos do contato logo no cartão do contato, e grava pelo MESMO caminho da ficha (`PATCH /api/v1/contacts/:id`).
 *
 * As definições vêm do funil padrão (a mesma régua da ficha do contato). Sem nenhum campo do contato, o bloco não aparece.
 */
import * as React from "react";
import { toast } from "sonner";

import { CustomFieldsEditor } from "@/components/contacts/CustomFieldsEditor";
import { Button } from "@/components/ui/button";
import { useContact } from "@/hooks/contacts/useContact";
import { useUpdateContact } from "@/hooks/contacts/useUpdateContact";
import { useT } from "@/hooks/i18n/useT";
import { useDefaultPipeline } from "@/hooks/pipelines/useDefaultPipeline";
import { camposDoFunil, camposPorEscopo } from "@/lib/leads/campos-do-funil";
import { soChavesAlteradas } from "@/lib/leads/custom-fields-so-diff";

export function CamposDoContato({ contactId, somenteLeitura }: { contactId: string; somenteLeitura?: boolean }) {
  const t = useT();
  const funil = useDefaultPipeline(true);
  const contato = useContact(contactId);
  const salvar = useUpdateContact(contactId);

  const defs = React.useMemo(
    () => camposPorEscopo(camposDoFunil(funil.data?.pipeline.settings ?? null), "contato"),
    [funil.data],
  );
  const gravados = (contato.data?.data?.custom_fields ?? {}) as Record<string, unknown>;
  const [valores, setValores] = React.useState<Record<string, unknown>>({});
  const [carregados, setCarregados] = React.useState<Record<string, unknown>>({});
  // O que está gravado vira o ponto de partida quando chega (ou quando outro contato é aberto); o que a pessoa digita não é atropelado.
  const origem = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!contato.data) return;
    const chave = `${contactId}:${JSON.stringify(gravados)}`;
    if (origem.current === chave) return;
    origem.current = chave;
    setValores({ ...gravados });
    setCarregados({ ...gravados });
  }, [contato.data, contactId, gravados]);

  if (defs.length === 0 || !contato.data) return null;

  const mudou = Object.keys(soChavesAlteradas(carregados, valores)).length > 0;

  function gravar() {
    // O PATCH do contato SUBSTITUI o `custom_fields`: manda o mapa inteiro (o que já estava + o que mudou), como a ficha faz.
    salvar.mutate(
      { custom_fields: valores },
      {
        onSuccess: () => {
          setCarregados({ ...valores });
          toast.success(t("Campos do contato atualizados"));
        },
      },
    );
  }

  return (
    <div className="space-y-2 border-t border-border pt-3" data-testid="inbox-campos-do-contato">
      <p className="text-xs font-semibold">{t("Campos do contato")}</p>
      <CustomFieldsEditor
        fields={defs}
        value={valores}
        onChange={setValores}
        mode="contact"
        disabled={somenteLeitura}
        className="gap-3 md:grid-cols-1"
      />
      <Button
        size="sm"
        className="h-11 w-full text-xs lg:h-7"
        disabled={somenteLeitura || salvar.isPending || !mudou}
        onClick={gravar}
      >
        {salvar.isPending ? t("Salvando…") : t("Salvar")}
      </Button>
    </div>
  );
}
