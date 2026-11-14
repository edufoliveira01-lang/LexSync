"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { useT } from "@/hooks/i18n/useT";
import { useDeleteContact, mensagemDeBloqueioPorVinculo, mensagemDeNegociosJuntos } from "@/hooks/contacts/useDeleteContact";
import { rotuloParaAEquipe } from "@/lib/contacts/rotulo-do-contato";
import type { Contact } from "@/lib/types/contacts";

/**
 * "Excluir contato?" — o diálogo único, usado pela lista e pela ficha. Avisa ANTES do clique o que impede ou acompanha a
 * exclusão (compromissos da Agenda, negócios do funil), com a mesma contagem do 409 da rota (`contacts/[id]/vinculos`).
 * Consulta só quando há contato: uma contagem por linha da lista seriam N requisições para ver a tabela.
 */
export function ExcluirContatoDialog({
  contato,
  onClose,
  aoExcluir,
}: {
  contato: Contact | null;
  onClose: () => void;
  aoExcluir?: () => void;
}) {
  const t = useT();
  const del = useDeleteContact();
  const [apagarCompromissos, setApagarCompromissos] = useState(false);
  const alvo = contato;
  const alvoId = alvo?.id ?? null;
  useEffect(() => { setApagarCompromissos(false); }, [alvoId]);
  const vinculos = useQuery({
    queryKey: ["contato-vinculos-para-excluir", alvoId],
    enabled: alvoId !== null,
    retry: false,
    queryFn: async () => {
      if (!alvoId) return { vinculos: [], por_tabela: {} };
      const corpo = await apiClient.get<{
        data?: {
          vinculos: string[];
          por_tabela: Record<string, number>;
          negocios?: { total: number; abertos: number; ganhos: number; perdidos: number };
          compromissos?: Array<{ id: string; starts_at: string; status: string }>;
        };
      }>(`/api/v1/contacts/${alvoId}/vinculos`);
      return corpo.data ?? { vinculos: [], por_tabela: {} };
    },
  });
  const avisoDeVinculo = alvo ? mensagemDeBloqueioPorVinculo(vinculos.data, t) : null;
  const compromissos = (vinculos.data as { compromissos?: Array<{ id: string; starts_at: string; status: string }> } | undefined)?.compromissos ?? [];
  const barradoPelaAgenda = avisoDeVinculo !== null;
  const avisoDeNegocios = alvo
    ? mensagemDeNegociosJuntos((vinculos.data as { negocios?: { total: number; abertos: number; ganhos: number; perdidos: number } } | undefined)?.negocios, t)
    : null;

  async function confirmarExclusao() {
    if (!alvo) return;
    try {
      await del.mutateAsync({ id: alvo.id, apagarCompromissos });
      toast.success(t("Contato excluído."));
      onClose();
      aoExcluir?.();
    } catch {
      // o hook já mostra o aviso
    }
  }

  return (
    <AlertDialog open={alvo !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Excluir contato?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {alvo
              ? `${t("Isso remove")} ${rotuloParaAEquipe(alvo, t)} ${t("e a conversa associada, se houver. Esta ação não pode ser desfeita.")}`
              : null}
            {/*
              O aviso ANTES do clique (issue #1925): a recusa já nomeava o
              vínculo, mas só depois que a pessoa tentava. Mesma frase do 409
              (plural e chave vindos do servidor), e o link vai direto para a
              Agenda — é lá que o compromisso é cancelado.
            */}
            {avisoDeNegocios ? (
              <span data-testid="aviso-negocios-juntos" className="mt-2 block text-sm font-medium text-warning-fg">
                {avisoDeNegocios}
              </span>
            ) : null}
            {avisoDeVinculo ? (
              <span className="mt-2 block text-sm font-medium text-warning-fg">
                {avisoDeVinculo}{" "}
                <Link href="/app/agenda" className="underline">
                  {t("Abrir Agenda")}
                </Link>
              </span>
            ) : null}
            {compromissos.length > 0 ? (
              <span data-testid="lista-de-compromissos" className="mt-2 block text-sm text-muted-foreground">
                {compromissos.map((c) => (
                  <span key={c.id} className="block">
                    {new Date(c.starts_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {c.status === "pending" ? t("aguardando confirmação") : t("confirmado")}
                  </span>
                ))}
              </span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {barradoPelaAgenda ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={apagarCompromissos}
              onChange={(e) => setApagarCompromissos(e.target.checked)}
              data-testid="apagar-compromissos"
            />
            <span>{t("Apagar também os compromissos futuros deste contato")}</span>
          </label>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>{t("Cancelar")}</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => void confirmarExclusao()}
            disabled={del.isPending || (barradoPelaAgenda && !apagarCompromissos)}
          >
            {del.isPending ? t("Excluindo…") : t("Excluir")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
