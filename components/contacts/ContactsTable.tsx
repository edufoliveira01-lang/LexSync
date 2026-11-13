"use client";

import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";

import type { Locale } from "date-fns";

import { useT } from "@/hooks/i18n/useT";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { format, formatRelative, isToday, isYesterday } from "date-fns";
import { ChatCircle, Check, PencilSimple, Trash } from "@/lib/ui/icons";
import { AvatarDoContato } from "@/components/ui/avatar-do-contato";
import { ChipDeEtiqueta } from "@/components/tags/ChipDeEtiqueta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useContactTagVocabulary } from "@/hooks/contacts/useContactTagVocabulary";
import type { ContactOrderBy } from "@/lib/schemas/contacts";
import type { Contact } from "@/lib/types/contacts";
import { rotuloParaAEquipe } from "@/lib/contacts/rotulo-do-contato";
import { phoneForDisplay } from "@/lib/channels/phone-variants";
import { useConversaNovaComEscolhaDeCanal } from "@/components/channels/SeletorDeCanalParaConversa";
import { ExcluirContatoDialog } from "@/components/contacts/ExcluirContatoDialog";
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
  /** Caixas de seleção visíveis? Padrão sim; a tela de Contatos as liga só no modo "Selecionar". */
  modoSelecao?: boolean;
  /** Lápis e lixeira na linha. Padrão sim (uso antigo); a tela de Contatos desliga: editar e excluir ficam na ficha, como no Sales. */
  acoesNaLinha?: boolean;
}


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

export function ContactsTable({
  contacts,
  selecionados,
  onAlternarSelecao,
  onSelecionarTodosVisiveis,
  modoSelecao = true,
  acoesNaLinha = true,
}: Props) {
  const localeDaData = useLocaleDeData();
  const t = useT();
  const orgAtiva = useActiveOrg();
  const clientesLigado = orgAtiva?.cliente_pela_agenda === true;
  // O autocompletar de etiquetas do diálogo de edição (issue #2732): o mesmo
  // vocabulário da ficha. O caminho rápido NÃO traz as `canonical_tags` do funil
  // — ele já abre sem os campos do funil (ver o comentário de `contatoEmEdicao`),
  // e o diálogo segue contando com o vocabulário da organização para sugerir o
  // que já existe.
  const vocabularioDeEtiquetas = useContactTagVocabulary(orgAtiva?.orgId ?? null);
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

  async function iniciarConversa(c: Contact) {
    if (!c.phone_number || abrindo) return;
    // O hook decide se há escolha (issue #2382) e faz o POST; quem decide o
    // destino depois é `aoAbrir`, declarado acima.
    await abrirConversa({ contact_id: c.id, phone_number: c.phone_number });
  }

  return (
    <>
    {onAlternarSelecao && modoSelecao && (
      <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <button
          type="button"
          role="checkbox"
          aria-checked={selecionados ? contacts.length > 0 && contacts.every((c) => selecionados.has(c.id)) : false}
          aria-label={t("Selecionar todos os contatos visíveis")}
          title={t("Selecionar todas")}
          data-testid="selecionar-todos-contatos"
          onClick={onSelecionarTodosVisiveis}
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border border-muted-foreground bg-background transition-colors hover:bg-surface-elevated focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
        >
          {selecionados && contacts.length > 0 && contacts.every((c) => selecionados.has(c.id)) && (
            <Check size={12} weight="bold" aria-hidden />
          )}
        </button>
        <span>{t("Selecionar todas")}</span>
      </div>
    )}
    <ul role="table" aria-label={t("Contatos")} className="space-y-2.5">
      {contacts.map((c) => {
        const nome = displayName(c);
        const marcado = selecionados?.has(c.id) ?? false;
        return (
          <li
            role="row"
            key={c.id}
            className="rounded-md border border-border bg-surface shadow-xs transition hover:border-accent-300 hover:shadow-sm"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              {onAlternarSelecao && modoSelecao && (
                <div role="cell">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={marcado}
                    aria-label={`${t("Selecionar contato")} ${displayName(c, t)}`}
                    data-testid={`selecionar-contato-${c.id}`}
                    onClick={() => onAlternarSelecao(c.id)}
                    className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border border-muted-foreground bg-background transition-colors hover:bg-surface-elevated focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent pointer-coarse:before:absolute pointer-coarse:before:-inset-3.5"
                  >
                    {marcado && <Check size={12} weight="bold" aria-hidden />}
                  </button>
                </div>
              )}
              <Link
                href={`/app/contacts/${c.id}`}
                className="grid min-w-0 flex-1 grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 sm:grid-cols-[40px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-x-4"
              >
                <AvatarDoContato id={c.id} nome={nome} className="row-span-2 sm:row-span-1" />
                <span role="cell" className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{nome}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.last_activity_at ? formatUltimaAtividade(c.last_activity_at, localeDaData) : t("Sem atividade")}
                  </span>
                </span>
                <span role="cell" className="col-start-2 truncate text-xs text-foreground/80 sm:col-start-auto sm:text-sm">
                  {c.phone_number ? phoneForDisplay(c.phone_number) : "—"}
                </span>
                <span role="cell" className="hidden truncate text-sm text-muted-foreground sm:block">
                  {c.email ?? "—"}
                </span>
              </Link>
              <span role="cell" className="hidden w-56 shrink-0 flex-wrap items-center justify-end gap-1.5 md:flex">
                {c.tags.slice(0, 2).map((tag) => (
                  <ChipDeEtiqueta key={tag} tag={tag} />
                ))}
                {c.tags.length > 2 && (
                  <span className="text-xs text-muted-foreground" title={c.tags.slice(2).join(", ")}>
                    +{c.tags.length - 2}
                  </span>
                )}
                {c.is_anonymized && <Badge variant="destructive">{t("Anonimizado")}</Badge>}
                {c.is_blocked && <Badge variant="warning">{t("Bloqueado")}</Badge>}
                {c.is_personal && <Badge variant="secondary">{t("Pessoal")}</Badge>}
                {clientesLigado && c.first_service_at && <Badge variant="secondary">{t("Cliente")}</Badge>}
                {!c.is_anonymized && !c.is_blocked && !c.is_personal && <Badge variant="success">{t("Ativo")}</Badge>}
              </span>
              <span role="cell" className={`flex shrink-0 items-center justify-end gap-0.5 ${acoesNaLinha ? "w-[6.75rem]" : "w-9"}`}>
                {c.conversa ? (
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-emerald-600" asChild>
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
                    className="h-9 w-9 text-emerald-600"
                    title={t("Iniciar conversa no Inbox")}
                    aria-label={`${t("Iniciar conversa com")} ${displayName(c, t)} ${t("no Inbox")}`}
                    disabled={abrindo}
                    onClick={() => void iniciarConversa(c)}
                  >
                    <ChatCircle size={16} weight="regular" aria-hidden />
                  </Button>
                ) : null}
                {/* Editar e excluir só aparecem ao passar o mouse (ou ao focar), como no Sales: a linha em repouso fica limpa.
                    Anonimizado não ganha lápis: o servidor recusa com lgpd_anonymization_irreversible. */}
                {acoesNaLinha && !c.is_anonymized && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground"
                    title={t("Editar contato")}
                    aria-label={`${t("Editar contato")} ${displayName(c, t)}`}
                    onClick={() => setContatoEmEdicao(c)}
                  >
                    <PencilSimple size={16} weight="regular" aria-hidden />
                  </Button>
                )}
                {acoesNaLinha && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-error-fg"
                  title={t("Excluir contato")}
                  aria-label={`${t("Excluir contato")} ${displayName(c, t)}`}
                  onClick={() => setAlvo(c)}
                >
                  <Trash size={16} weight="regular" aria-hidden />
                </Button>
                )}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
    <ExcluirContatoDialog contato={alvo} onClose={() => setAlvo(null)} />
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
