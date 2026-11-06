"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/i18n/useT";
import type { AposAssinatura } from "@/lib/sales/apos-assinatura";

export interface FunilComEtapas { id: string; name: string; stages: { id: string; name: string }[] }

const campo = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

/** Fork Sales — "o que acontece quando o cliente assinar": etapa do funil, etiqueta e fechar a conversa. Usado no formulário e em Configurações. */
export function EscolhaAposAssinatura({ valor, onChange, funis, idPrefixo }: { valor: AposAssinatura; onChange: (v: AposAssinatura) => void; funis: FunilComEtapas[]; idPrefixo: string }) {
  const t = useT();
  const funil = funis.find((f) => f.id === valor.pipeline_id);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefixo}-funil`}>{t("Mover o negócio no funil")}</Label>
        <select id={`${idPrefixo}-funil`} className={campo} value={valor.pipeline_id ?? ""}
          onChange={(e) => onChange({ ...valor, pipeline_id: e.target.value || undefined, stage_id: undefined })}>
          <option value="">{t("Não mover")}</option>
          {funis.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefixo}-etapa`}>{t("Para a etapa")}</Label>
        <select id={`${idPrefixo}-etapa`} className={campo} value={valor.stage_id ?? ""} disabled={!funil}
          onChange={(e) => onChange({ ...valor, stage_id: e.target.value || undefined })}>
          <option value="">—</option>
          {(funil?.stages ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefixo}-tag`}>{t("Adicionar a etiqueta ao contato")}</Label>
        <Input id={`${idPrefixo}-tag`} value={valor.tag ?? ""} maxLength={40} placeholder={t("ex.: Cliente com contrato")}
          onChange={(e) => onChange({ ...valor, tag: e.target.value.trim() ? e.target.value : undefined })} />
      </div>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" checked={Boolean(valor.fechar_conversa)} onChange={(e) => onChange({ ...valor, fechar_conversa: e.target.checked || undefined })} />
        {t("Fechar a conversa")}
      </label>
    </div>
  );
}
