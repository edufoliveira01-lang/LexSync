"use client";

import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";

import type { Locale } from "date-fns";

import { useT } from "@/hooks/i18n/useT";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatRelative, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { CaretDown, CaretUp, ChatCircle, Check, PencilSimple, Trash } from "@/lib/ui/icons";
import { AvatarDoContato } from "@/components/ui/avatar-do-contato";
import { ChipDeEtiqueta } from "@/components/tags/ChipDeEtiqueta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useContactTagVocabulary } from "@/hooks/contacts/useContactTagVocabulary";
import { useDeleteContact, mensagemDeBloqueioPorVinculo, mensagemDeNegociosJuntos } from "@/hooks/contacts/useDeleteContact";
import type { ContactOrderBy } from "@/lib/schemas/contacts";
import type { Contact } from "@/lib/types/contacts";
import { rotuloParaAEquipe } from "@/lib/contacts/rotulo-do-contato";
import { phoneForDisplay } from "@/lib/channels/phone-variants";
import { useConversaNovaComEscolhaDeCanal } from "@/components/channels/SeletorDeCanalParaConversa";
import { EditContactDialog } from "@/components/contacts/EditContactDialog";

interface Props {
  contacts: Contact[];
  orderBy: ContactOrderBy;
  orderDir: "asc" | "desc";
  onSort: (column: ContactOrderBy) => void;
  /**
   * Seleção múltipla (#2484, fatia F3). Quando `onAlternarSelecao` vem, cada
   * linha ganha a caixa de marcação e a tabela oferece o "selecionar todas" —
   * sem ela, a tabela é exatamente a que era. A barra de ações em lote mora
   * FORA (no cliente da página): esta componente só mede a seleção.
   */
  selecionados?: Set<string>;
  onAlternarSelecao?: (id: string) => void;
  onSelecionarTodosVisiveis?: () => void;
}

/** Colunas do cartão de contato (a partir de `md`); a primeira só existe quando há seleção em lote. */
const GRADE_SEM_SELECAO =
  "md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_7rem_6rem_88px] md:items-center md:gap-4";
const GRADE_COM_SELECAO =
  "md:grid md:grid-cols-[1.25rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_7rem_6rem_88px] md:items-center md:gap-4";

function displayName(c: Contact, t: (texto: string) => string = (texto) => texto): string {
  return rotuloParaAEquipe(c, t);
}

/** Hoje/ontem: relativo ("há 2 horas", "ontem"). Mais antigo: data, não dia da semana. */
// `locale` ANTES de `now`, e não depois: `now` tem default, e um parâmetro
// obrigatório atrás de um opcional obriga todo chamador a passar os dois. O
// codemod acrescentou no fim, que é o certo em 22 dos 23 casos e o errado aqui.
function formatUltimaAtividade(iso: string, locale: Locale, now = new Date()): string {
  const d = new Date(iso);
  if (isToday(d) || isYesterday(d)) {
    return formatRelative(d, now, { locale: locale });
  }
  return format(d, "dd/MM/yyyy", { locale: locale });
}

function SortableHead({
  label,
  column,
  orderBy,
  orderDir,
  onSort,
  className,
}: {
  label: string;
  column: ContactOrderBy;
  orderBy: ContactOrderBy;
  orderDir: "asc" | "desc";
  onSort: (column: ContactOrderBy) => void;
  className?: string;
}) {
  const active = orderBy === column;
  const muted = "text-muted-foreground";
  const emphasis = "text-foreground";

  return (
    <div role="columnheader" aria-sort={active ? (orderDir === "asc" ? "ascending" : "descending") : "none"} className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider hover:text-foreground"
      >
        {label}
        <span className="inline-flex flex-col -space-y-1" aria-hidden>
          <CaretUp
            size={12}
            weight="bold"
            className={active && orderDir === "asc" ? emphasis : muted}
          />
          <CaretDown
            size={12}
            weight="bold"
            className={active && orderDir === "desc" ? emphasis : muted}
          />
        </span>
      </button>
    </div>
  );
}

export function ContactsTable({
  contacts,
  orderBy,
  orderDir,
  onSort,
  selecionados,
  onAlternarSelecao,
  onSelecionarTodosVisiveis,
}: Props) {
  const localeDaData = useLocaleDeData();
  const t = useT();
  const GRADE = onAlternarSelecao ? GRADE_COM_SELECAO : GRADE_SEM_SELECAO;
  const orgAtiva = useActiveOrg();
  const clientesLigado = orgAtiva?.cliente_pela_agenda === true;
  // O autocompletar de etiquetas do diálogo de edição (issue #2732): o mesmo
  // vocabulário da ficha. O caminho rápido NÃO traz as `canonical_tags` do funil
  // — ele já abre sem os campos do funil (ver o comentário de `contatoEmEdicao`),
  // e o diálogo segue contando com o vocabulário da organização para sugerir o
  // que já existe.
  const vocabularioDeEtiquetas = useContactTagVocabulary(orgAtiva?.orgId ?? null);
  const del = useDeleteContact();
  const [alvo, setAlvo] = useState<Contact | null>(null);
  // Issue #2715 — editar pela linha, sem abrir a ficha. Sem customFieldDefs:
  // o contrato do diálogo some a seção de campos do funil, e o caminho rápido
  // coexiste com o completo (quem precisa dos campos abre a ficha, como hoje).
  const [contatoEmEdicao, setContatoEmEdicao] = useState<Contact | null>(null);
  const router = useRouter();
  const qc = useQueryClient();
  // Issue #2382 — seletor de canal ao INICIAR a conversa. O diálogo é o retorno
  // do hook (nulo quando não há o que escolher), e o que acontece depois de
  // abrir é daqui: invalidar a lista e navegar para o inbox.
  const {
    iniciarConversa: abrirConversa,
    abrindo,
    seletor: seletorDeCanal,
  } = useConversaNovaComEscolhaDeCanal({
    aoAbrir: async (conversationId) => {
      await qc.invalidateQueries({ queryKey: ["contacts"] });
      router.push(`/app/inbox?id=${conversationId}`);
    },
  });

  // Pré-checagem da exclusão (issue #1925): o diálogo "Excluir contato?" avisa
  // que a Agenda vai barrar ANTES do clique, com a MESMA contagem que o 409
  // usa (rota `contacts/[id]/vinculos`). Consulta só quando há alvo — uma
  // contagem por linha da lista seria N requisições para ver a tabela.
  // Se a prévia falhar, nada trava: sem ela o 409 continua barando e a frase
  // do erro já nomeia o vínculo.
  const alvoId = alvo?.id ?? null;
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
        };
      }>(`/api/v1/contacts/${alvoId}/vinculos`);
      // O MESMO formato do `error.details` do 409: a frase da tela é uma só,
      // servida pela mesma função dos dois caminhos.
      return corpo.data ?? { vinculos: [], por_tabela: {} };
    },
  });
  const avisoDeVinculo = alvo ? mensagemDeBloqueioPorVinculo(vinculos.data, t) : null;
  // Os cards do funil saem junto com o contato (abertos, ganhos e perdidos): o diálogo diz quantos, ANTES do clique.
  const avisoDeNegocios = alvo
    ? mensagemDeNegociosJuntos((vinculos.data as { negocios?: { total: number; abertos: number; ganhos: number; perdidos: number } } | undefined)?.negocios, t)
    : null;

  async function iniciarConversa(c: Contact) {
    if (!c.phone_number || abrindo) return;
    // O hook decide se há escolha (issue #2382) e faz o POST; quem decide o
    // destino depois é `aoAbrir`, declarado acima.
    await abrirConversa({ contact_id: c.id, phone_number: c.phone_number });
  }

  async function confirmarExclusao() {
    if (!alvo) return;
    try {
      await del.mutateAsync(alvo.id);
      toast.success(t("Contato excluído."));
      setAlvo(null);
    } catch {
      // hook handles toast
    }
  }

  // Abaixo de `md` cada linha vira um cartão (só CSS, como o Inbox: o DOM é o
  // mesmo nas duas larguras). O telefone e a última atividade alinham sob o
  // nome, que começa depois da caixa de seleção quando ela existe.
  const recuoSobONome = onAlternarSelecao ? "max-md:pl-7.5" : "max-md:pl-0";

  return (
    <>
    <div role="table" aria-label={t("Contatos")} className="space-y-2.5">
      <div role="rowgroup" className="max-md:hidden">
        <div role="row" className={`${GRADE} px-4 text-[11px] text-text-subtle`}>
          {/*
            Cabeça da seleção em lote (#2484, F3): marca de uma vez tudo o que
            está na tela. Só existe quando a tabela recebe as props de seleção
            — quem não liga o lote continua com a tabela de sempre.
          */}
          {onAlternarSelecao && (
            <div role="columnheader" className="w-5">
              <button
                type="button"
                role="checkbox"
                aria-checked={
                  selecionados ? contacts.every((c) => selecionados.has(c.id)) : false
                }
                aria-label={t("Selecionar todos os contatos visíveis")}
                title={t("Selecionar todas")}
                data-testid="selecionar-todos-contatos"
                onClick={onSelecionarTodosVisiveis}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-muted-foreground bg-background transition-colors hover:bg-surface-elevated focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
              >
                {selecionados && contacts.every((c) => selecionados.has(c.id)) && (
                  <Check size={12} weight="bold" aria-hidden />
                )}
              </button>
            </div>
          )}
          <SortableHead
            label={t("Nome")}
            column="display_name"
            orderBy={orderBy}
            orderDir={orderDir}
            onSort={onSort}
          />
          <SortableHead
            label={t("Email")}
            column="email"
            orderBy={orderBy}
            orderDir={orderDir}
            onSort={onSort}
          />
          <SortableHead
            label={t("Telefone")}
            column="phone_number"
            orderBy={orderBy}
            orderDir={orderDir}
            onSort={onSort}
          />
          <div role="columnheader" className="font-semibold uppercase tracking-wider">{t("Tags")}</div>
          <SortableHead
            label={t("Última atividade")}
            column="last_activity_at"
            orderBy={orderBy}
            orderDir={orderDir}
            onSort={onSort}
          />
          <div role="columnheader" className="font-semibold uppercase tracking-wider">{t("Status")}</div>
          <div role="columnheader" className="w-[88px]">
            <span className="sr-only">{t("Ações")}</span>
          </div>
        </div>
      </div>
      <div role="rowgroup" className="space-y-2.5 max-md:block">
        {contacts.map((c) => (
          <div
            role="row"
            key={c.id}
            className={`${GRADE} rounded-xl border border-border bg-surface px-4 py-3 shadow-xs transition hover:border-accent-300 hover:shadow-sm max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-3.5 max-md:py-2`}
          >
            {onAlternarSelecao && (
              <div role="cell" className="max-md:p-0">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selecionados?.has(c.id) ?? false}
                  aria-label={`${t("Selecionar contato")} ${displayName(c, t)}`}
                  data-testid={`selecionar-contato-${c.id}`}
                  onClick={() => onAlternarSelecao(c.id)}
                  className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-muted-foreground bg-background transition-colors hover:bg-surface-elevated focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent pointer-coarse:before:absolute pointer-coarse:before:-inset-3.5"
                >
                  {selecionados?.has(c.id) && <Check size={12} weight="bold" aria-hidden />}
                </button>
              </div>
            )}
            <div role="cell" className="flex min-w-0 items-center gap-3 font-medium max-md:flex-1 max-md:wrap-anywhere">
              <AvatarDoContato id={c.id} nome={displayName(c)} />
              <Link
                href={`/app/contacts/${c.id}`}
                className="min-w-0 truncate text-sm font-semibold text-foreground hover:text-accent max-md:flex max-md:min-h-11 max-md:items-center"
              >
                {displayName(c)}
              </Link>
            </div>
            <div role="cell" className="min-w-0 truncate text-sm text-muted-foreground max-md:hidden">
              {c.email ?? "—"}
            </div>
            <div
              role="cell"
              className={`text-sm text-muted-foreground max-md:order-last max-md:basis-full max-md:py-0 max-md:text-xs ${recuoSobONome}`}
            >
              {c.phone_number ? phoneForDisplay(c.phone_number) : "—"}
            </div>
            <div role="cell" className="max-md:hidden">
              <div className="flex flex-wrap gap-1">
                {c.tags.length === 0
                  ? <span className="text-muted-foreground text-xs">—</span>
                  : c.tags.map((tag) => (
                      <ChipDeEtiqueta key={tag} tag={tag} />
                    ))}
              </div>
            </div>
            <div
              role="cell"
              className={`text-sm text-muted-foreground max-md:py-0 max-md:text-xs ${recuoSobONome}`}
            >
              {c.last_activity_at
                ? formatUltimaAtividade(c.last_activity_at, localeDaData)
                : "—"}
            </div>
            <div role="cell" className="max-md:min-w-0 max-md:flex-1">
              <div className="flex flex-wrap gap-1">
                {c.is_anonymized && <Badge variant="destructive">{t("Anonimizado")}</Badge>}
                {c.is_blocked && <Badge variant="warning">{t("Bloqueado")}</Badge>}
                {/*
                  Selo "Pessoal" lido da COLUNA, nunca da etiqueta (critério 5):
                  mesma regra do aviso acima — etiqueta se edita, coluna não.
                  "Ativo" some junto: pessoal está fora da operação, então
                  chamar de ativo mentiria na mesma linha em que o selo conta.
                */}
                {c.is_personal && <Badge variant="secondary">{t("Pessoal")}</Badge>}
                {/*
                  Lê a COLUNA, nunca a tag, e só com a regra ligada: a tag
                  `cliente` é removível à mão e pelo PATCH (que substitui `tags`
                  por inteiro), e um selo que some porque alguém editou
                  etiquetas mentiria sobre um fato. Desligada, a coluna está
                  congelada e o selo mentiria do outro lado.
                */}
                {clientesLigado && c.first_service_at && (
                  <Badge variant="secondary">{t("Cliente")}</Badge>
                )}
                {!c.is_anonymized && !c.is_blocked && !c.is_personal && (
                  <Badge variant="success">{t("Ativo")}</Badge>
                )}
              </div>
            </div>
            <div role="cell" className="max-md:p-0">
              <div className="flex items-center justify-end gap-0.5">
                {c.conversa ? (
                  <Button variant="ghost" size="icon" className="md:h-8 md:w-8" asChild>
                    <Link
                      href={`/app/inbox?id=${c.conversa.id}`}
                      title={t("Abrir conversa no Inbox")}
                      aria-label={`${t("Abrir conversa com")} ${displayName(c, t)} ${t("no Inbox")}`}
                    >
                      <ChatCircle size={16} weight="regular" aria-hidden />
                      {c.conversa.unread > 0 && (
                        <span className="sr-only">{c.conversa.unread} {t("sem ler")}</span>
                      )}
                    </Link>
                  </Button>
                ) : c.phone_number ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:h-8 md:w-8"
                    title={t("Iniciar conversa no Inbox")}
                    aria-label={`${t("Iniciar conversa com")} ${displayName(c, t)} ${t("no Inbox")}`}
                    disabled={abrindo}
                    onClick={() => void iniciarConversa(c)}
                  >
                    <ChatCircle size={16} weight="regular" aria-hidden />
                  </Button>
                ) : null}
                {/* Issue #2715 — atalho de edição na linha: o MESMO diálogo da ficha (EditContactDialog), sem formulário novo. A lista já é invalidada pelo useUpdateContact (["contacts"]).
                    Anonimizado não ganha lápis, como na ficha: o servidor recusa com lgpd_anonymization_irreversible. */}
                {!c.is_anonymized && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:h-8 md:w-8"
                    title={t("Editar contato")}
                    aria-label={`${t("Editar contato")} ${displayName(c, t)}`}
                    onClick={() => setContatoEmEdicao(c)}
                  >
                    <PencilSimple size={16} weight="regular" aria-hidden />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-error-fg md:h-8 md:w-8"
                  title={t("Excluir contato")}
                  aria-label={`${t("Excluir contato")} ${displayName(c, t)}`}
                  onClick={() => setAlvo(c)}
                >
                  <Trash size={16} weight="regular" aria-hidden />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <AlertDialog open={alvo !== null} onOpenChange={(open) => { if (!open) setAlvo(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Excluir contato?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {alvo
              ? `${t("Isso remove")} ${displayName(alvo, t)} ${t("e a conversa associada, se houver. Esta ação não pode ser desfeita.")}`
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
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>{t("Cancelar")}</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => void confirmarExclusao()}
            disabled={del.isPending}
          >
            {del.isPending ? t("Excluindo…") : t("Excluir")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {/* Issue #2715 — edição pela linha. Montado só com alvo escolhido, no
        mesmo molde do AlertDialog de exclusão: fechar zera o state. */}
    {contatoEmEdicao && (
      <EditContactDialog
        contact={contatoEmEdicao}
        open
        onOpenChange={(v) => { if (!v) setContatoEmEdicao(null); }}
        vocabulario={vocabularioDeEtiquetas.data}
      />
    )}
    {/* Issue #2382 — o seletor de canal, quando há mais de um elegível. */}
    {seletorDeCanal}
    </>
  );
}
