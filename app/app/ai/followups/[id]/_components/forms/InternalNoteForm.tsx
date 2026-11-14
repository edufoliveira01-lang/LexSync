"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";

import type { ConfigOf } from "./shared";

/**
 * O nó `internal_note`: o texto da nota que o fluxo deixa na conversa do cliente. Nenhuma mensagem sai para o cliente — a equipe
 * lê a nota no chat. O rascunho aceita o texto vazio (trabalho pela metade salva); quem exige é a publicação.
 */
export function InternalNoteForm({
  config,
  onChange,
}: {
  config: ConfigOf<"internal_note">;
  onChange: (c: ConfigOf<"internal_note">) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-2" data-testid="internal-note-form">
      <p className="text-xs text-text-muted">{t("Este nó deixa uma nota interna na conversa do cliente — só a equipe vê, nenhuma mensagem sai para ele.")}</p>
      <div className="space-y-1">
        <Label htmlFor="internal-note-texto">{t("Texto da nota")}</Label>
        <Textarea
          id="internal-note-texto"
          rows={4}
          maxLength={2000}
          value={config.texto}
          onChange={(e) => onChange({ ...config, texto: e.target.value })}
          placeholder={t("Cliente sumiu depois da proposta de {{lead.title}}. Retomar na próxima semana.")}
        />
        <p className="text-xs text-text-muted">{t("Dá para usar {{contact.name}} (nome do cliente) e {{lead.title}} (título do negócio).")}</p>
      </div>
    </div>
  );
}
