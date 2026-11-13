"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MagnifyingGlass, Robot, Plus, Trash, PencilSimple, FlowArrow } from "@/lib/ui/icons";
import { SeloDeAutoria } from "@/components/operacao/SeloDeAutoria";
import {
  useAutomationRules,
  useUpdateAutomationRule,
  useDeleteAutomationRule,
  type AutomationRuleRow,
} from "@/hooks/webhooks/useAutomationRules";
import { TRIGGER_LABELS, type TriggerEvent } from "./labels";
import { RuleEditor } from "./RuleEditor";
import { useT } from "@/hooks/i18n/useT";

const RULES_QUERY_KEY = ["automation-rules"];
const DESIGNER_NOVA = "/app/webhooks/automacoes/nova";

function triggerLabel(trigger: string, t: (texto: string) => string): string {
  return t(TRIGGER_LABELS[trigger as TriggerEvent] ?? trigger);
}

export function RulesTab() {
  const t = useT();
  const { data, isLoading } = useAutomationRules();
  const update = useUpdateAutomationRule();
  const del = useDeleteAutomationRule();
  const qc = useQueryClient();

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AutomationRuleRow | null>(null);
  const [deleting, setDeleting] = React.useState<AutomationRuleRow | null>(null);
  const [busca, setBusca] = React.useState("");

  const rules = data?.data ?? [];

  const toggleActive = (rule: AutomationRuleRow, checked: boolean) => {
    qc.setQueryData<{ data: AutomationRuleRow[] }>(RULES_QUERY_KEY, (old) =>
      old ? { data: old.data.map((r) => (r.id === rule.id ? { ...r, is_active: checked } : r)) } : old,
    );
    update.mutate(
      { id: rule.id, is_active: checked },
      {
        onSuccess: () => toast.success(checked ? t("Automação ligada.") : t("Automação pausada.")),
        onError: () => qc.invalidateQueries({ queryKey: RULES_QUERY_KEY }),
      },
    );
  };

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (rule: AutomationRuleRow) => {
    setEditing(rule);
    setEditorOpen(true);
  };

  if (isLoading) {
    return (
      <div className="grid gap-3 pt-4 sm:grid-cols-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const termo = busca.trim().toLowerCase();
  const visiveis = termo ? rules.filter((r) => r.name.toLowerCase().includes(termo)) : rules;
  const ligadas = rules.filter((r) => r.is_active).length;

  return (
    <div className="space-y-5 pt-4">
      {rules.length === 0 ? (
        <section className="rounded-md border border-border bg-surface p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-accent">
              <Robot className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{t("Crie sua primeira automação")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("Ex.: quando entrar um contato novo, enviar uma mensagem de boas-vindas.")}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={openCreate}>
              <Plus /> {t("Nova automação")}
            </Button>
            {/* Fase 1 do designer: a mesma automação, montada no canvas. É link
                (não botão) para não colidir com quem procura "Nova automação". */}
            <Button asChild variant="outline">
              <Link href={DESIGNER_NOVA}>
                <FlowArrow /> {t("Montar no designer")}
              </Link>
            </Button>
          </div>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-64 sm:max-w-sm">
              <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={t("Buscar automação")}
                aria-label={t("Buscar automação")}
                className="rounded-full pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {ligadas} {ligadas === 1 ? t("ligada") : t("ligadas")} · {rules.length} {t("no total")}
            </p>
            <div className="ml-auto flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href={DESIGNER_NOVA}>
                  <FlowArrow /> {t("Montar no designer")}
                </Link>
              </Button>
              <Button onClick={openCreate} className="w-full sm:w-auto">
                <Plus /> {t("Nova automação")}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visiveis.map((r) => (
              <div key={r.id} className="flex flex-col rounded-md border border-border bg-surface shadow-xs transition hover:border-accent-300 hover:shadow-sm">
                <div className="flex items-start gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-accent">
                    <Robot className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("Quando")}: {triggerLabel(r.trigger_event, t)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.actions.length} {r.actions.length === 1 ? t("ação") : t("ações")}
                    </p>
                  </div>
                  <Badge variant={r.is_active ? "success" : "neutral"}>{r.is_active ? t("Ativa") : t("Pausada")}</Badge>
                </div>
                {/* Uma regra ligada roda sozinha para sempre: quem a ligou é parte do estado dela, não um detalhe de auditoria. */}
                <div className="px-4 pb-3">
                  <SeloDeAutoria kind={r.last_change_actor_kind} em={r.last_change_at} />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
                  <Switch
                    checked={r.is_active}
                    disabled={update.isPending}
                    onCheckedChange={(checked) => toggleActive(r, checked)}
                    aria-label={`${r.is_active ? t("Pausar") : t("Ligar")} ${r.name}`}
                  />
                  <div className="flex items-center gap-1">
                    <Button asChild variant="ghost" size="icon">
                      <Link href={`/app/webhooks/automacoes/${r.id}`} aria-label={t("Abrir no designer")}>
                        <FlowArrow />
                      </Link>
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label={t("Editar automação")}>
                      <PencilSimple />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setDeleting(r)} aria-label={t("Excluir automação")} className="hover:text-error-fg">
                      <Trash />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {visiveis.length === 0 && <p className="text-sm text-muted-foreground">{t("Nenhuma automação encontrada para essa busca.")}</p>}
          </div>
        </>
      )}

      <RuleEditor open={editorOpen} onOpenChange={setEditorOpen} rule={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Excluir esta automação?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.name} {t("para de rodar imediatamente. Essa ação não pode ser desfeita.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-error text-white hover:brightness-95"
              onClick={async () => {
                if (!deleting) return;
                await del.mutateAsync(deleting.id);
                toast.success(t("Automação excluída."));
                setDeleting(null);
              }}
            >
              {t("Excluir")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
