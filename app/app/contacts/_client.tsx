"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useT } from "@/hooks/i18n/useT";
import { CaretDown, Plus, DownloadSimple, DotsThree, MagnifyingGlass, UploadSimple, UsersThree, ArrowsClockwise } from "@/lib/ui/icons";
import { CabecalhoDaPagina } from "@/components/ui/cabecalho-da-pagina";
import { PainelDeNumeros } from "@/components/ui/painel-de-numeros";
import { useContactResumo } from "@/hooks/contacts/useContactResumo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useContactList } from "@/hooks/contacts/useContactList";
import { useBulkContacts, type AcaoEmLoteDeContatos } from "@/hooks/contacts/useBulkContacts";
import { useSelecaoEmLote } from "@/hooks/contacts/useSelecaoEmLote";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { BarraDeContatosEmLote } from "@/components/contacts/BarraDeContatosEmLote";
import { PontoDaEtiqueta } from "@/components/tags/PontoDaEtiqueta";
import { NewContactDialog } from "@/components/contacts/NewContactDialog";
import { ImportContactsDialog } from "@/components/contacts/ImportContactsDialog";
import { SyncPhoneContactsDialog } from "@/components/contacts/SyncPhoneContactsDialog";
import { TAG_DE_CLIENTE } from "@/lib/contacts/cliente";
import { queryDaExportacao, type FormatoDeExport } from "@/lib/contacts/exportar";
import { roleAtLeast } from "@/lib/auth/types";
import { type ModoDeEtiqueta } from "@/lib/inbox/marcador-da-conversa";
import { useActiveOrg, usePermission } from "@/hooks/auth/AuthProvider";
import { MergeDialog } from "@/components/contacts/MergeDialog";
import { EmptyContacts } from "@/components/empty";
import type { ContactOrderBy } from "@/lib/schemas/contacts";

const ROTULO_DA_ORDEM: Partial<Record<ContactOrderBy, string>> = {
  last_activity_at: "Última atividade",
  display_name: "Nome",
  email: "Email",
  phone_number: "Telefone",
};

export function ContactsListClient() {
  const t = useT();
  const orgAtiva = useActiveOrg();
  const clientesLigado = orgAtiva?.cliente_pela_agenda === true;
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  // VÁRIAS etiquetas com E/OU (#1274). O estado é a LISTA, e uma etiqueta só é
  // a lista de um — o que faz "nenhuma escolha" e "vip escolhida" passarem pelo
  // mesmo caminho, e impede a segunda forma de nascer daqui.
  const [tags, setTags] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<ModoDeEtiqueta | undefined>(undefined);
  const [source, setSource] = useState<string | undefined>(undefined);
  // Só pessoais (spec 21, etapa 15 — filtro "Pessoais"): ligado lista SÓ
  // pessoais (`?pessoais=true`, etapa 13); desligado é o padrão que exclui.
  const [soPessoais, setSoPessoais] = useState(false);
  const [orderBy, setOrderBy] = useState<ContactOrderBy>("last_activity_at");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc");
  const limit = 25;
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [duplicadosOpen, setDuplicadosOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters = useMemo(
    () => ({
      search,
      tag: tags.length > 0 ? tags : undefined,
      tagMode,
      source,
      pessoais: soPessoais || undefined,
      order_by: orderBy,
      order_dir: orderDir,
      limit,
    }),
    [search, tags, tagMode, source, soPessoais, orderBy, orderDir, limit],
  );
  const q = useContactList(filters);
  const resumo = useContactResumo();

  // LOTE (#2484, fatia F3): a seleção múltipla e a barra de ações dos contatos.
  // O portão de tela é o MESMO piso da edição individual (`contact.update` —
  // agent+); quem só lê nem vê a barra. (A rota ainda valida por conta própria:
  // este portão é de tela, a fonte da regra é a API.)
  const podeAgirEmLote = usePermission("contact.update");
  const podeMudarResponsavel = usePermission("contact.carteira");
  const selecao = useSelecaoEmLote();
  const lote = useBulkContacts();

  const rodarLote = useCallback(
    (args: AcaoEmLoteDeContatos) => {
      const ids = Array.from(selecao.selecionados);
      if (ids.length === 0) return;
      lote.mutate(
        { ids, ...args },
        {
          // A seleção é limpa depois do lote, aconteça o que acontecer: manter
          // marcados os contatos recusados (de outra organização, inexistentes)
          // deixaria a barra no lugar mensageando um lote que não existe mais.
          onSuccess: () => selecao.limpar(),
        },
      );
    },
    [lote, selecao],
  );

  const allContacts = useMemo(
    () => q.data?.pages.flatMap((p) => p.data) ?? [],
    [q.data],
  );

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of allContacts) for (const tag of c.tags) set.add(tag);
    // `cliente` na lista mesmo que nenhum contato da página carregada a tenha —
    // COM A REGRA LIGADA. As demais opções saem do que já foi paginado — o que
    // basta para etiqueta que a equipe criou e usa em bloco, e falha justamente
    // para esta, que o sistema escreve sozinho e cujo primeiro uso é "filtrar
    // quem já é cliente" numa base grande, onde a primeira página pode não ter
    // nenhum. Desligada, a opção fixa ofereceria um filtro de uma regra que não
    // roda; quem já tem a etiqueta continua aparecendo pela linha de cima.
    if (clientesLigado) set.add(TAG_DE_CLIENTE);
    return Array.from(set).sort();
  }, [allContacts, clientesLigado]);

  const handleSort = useCallback(
    (column: ContactOrderBy) => {
      if (column === orderBy) {
        setOrderDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setOrderBy(column);
        setOrderDir(column === "display_name" ? "asc" : "desc");
      }
    },
    [orderBy],
  );

  // O MESMO gate da rota (`requireRole("manager")`): um botão que só devolve
  // 403 é armadilha — quem tem papel de leitura nem vê a porta.
  const podeExportar = roleAtLeast(orgAtiva?.role, "manager");

  /**
   * Exportar é exportar o QUE A TELA ESTÁ MOSTRANDO: os mesmos filtros da lista
   * viajam na query (busca, etiquetas em E/OU, origem, pessoais), sem `cursor`
   * nem `limit` — o arquivo é o conjunto filtrado inteiro, não a página que a
   * pessoa rolou até aqui.
   */
  const exportar = useCallback(
    (formato: FormatoDeExport) => {
      const qs = queryDaExportacao(formato, {
        search,
        tags,
        tagMode,
        source,
        pessoais: soPessoais,
        order_by: orderBy,
        order_dir: orderDir,
      });
      // `Content-Disposition: attachment` na resposta faz o navegador baixar,
      // não navegar — o mesmo gesto do "Exportar CSV" da tela de auditoria.
      window.location.href = `/api/v1/contacts/export?${qs}`;
    },
    [search, tags, tagMode, source, soPessoais, orderBy, orderDir],
  );

  return (
    <div className="space-y-5">
      <CabecalhoDaPagina
        area={t("CRM")}
        titulo={t("Contatos")}
        descricao={t("A lista única de pessoas que falaram com o escritório: telefone, etiquetas, conversas e histórico. Os atendimentos e avisos usam estes cadastros.")}
        acoes={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <UploadSimple size={16} weight="bold" aria-hidden />
              <span>{t("Importar CSV")}</span>
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={16} weight="bold" aria-hidden />
              <span>{t("Novo contato")}</span>
            </Button>
            {/* Duplicados, Sincronizar agenda e Exportar moram no "⋯", como no Sales: trabalho de vez em quando, não de todo dia. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t("Mais ações")} title={t("Mais ações")}>
                  <DotsThree size={20} weight="bold" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px] rounded-md p-1.5">
                <DropdownMenuItem onClick={() => setDuplicadosOpen(true)} className="gap-3 rounded-lg px-3 py-2 text-[13px]">
                  <UsersThree size={16} aria-hidden /> {t("Duplicados")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSyncOpen(true)} className="gap-3 rounded-lg px-3 py-2 text-[13px]">
                  <ArrowsClockwise size={16} aria-hidden /> {t("Sincronizar agenda")}
                </DropdownMenuItem>
                {podeExportar && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => exportar("csv")} className="gap-3 rounded-lg px-3 py-2 text-[13px]">
                      <DownloadSimple size={16} aria-hidden /> {t("Exportar CSV")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportar("vcf")} className="gap-3 rounded-lg px-3 py-2 text-[13px]">
                      <DownloadSimple size={16} aria-hidden /> {t("Exportar vCard")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div role="tablist" aria-label={t("Contatos")} className="inline-flex rounded-xl bg-surface-elevated p-1 text-sm font-semibold">
        {[
          { chave: "ativos", rotulo: t("Contatos"), ativo: !soPessoais },
          { chave: "pessoais", rotulo: t("Pessoais"), ativo: soPessoais },
        ].map((aba) => (
          <button
            key={aba.chave}
            type="button"
            role="tab"
            aria-selected={aba.ativo}
            data-testid={aba.chave === "pessoais" ? "filtro-pessoais" : undefined}
            aria-pressed={aba.chave === "pessoais" ? aba.ativo : undefined}
            onClick={() => setSoPessoais(aba.chave === "pessoais")}
            className={`rounded-lg px-5 py-2.5 transition-colors ${aba.ativo ? "bg-surface text-accent shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {aba.rotulo}
          </button>
        ))}
      </div>

      <PainelDeNumeros
        itens={[
          {
            chave: "todos",
            rotulo: t("Todos"),
            valor: resumo.data?.total,
            ativo: !soPessoais && tags.length === 0 && !source && !search,
            aoClicar: () => {
              setSoPessoais(false);
              setTags([]);
              setTagMode(undefined);
              setSource(undefined);
              setSearchInput("");
              setSearch("");
            },
          },
          clientesLigado
            ? {
                chave: "clientes",
                rotulo: t("Clientes"),
                valor: resumo.data?.clientes,
                ativo: !soPessoais && tags.length === 1 && tags[0] === TAG_DE_CLIENTE,
                aoClicar: () => {
                  setSoPessoais(false);
                  setTagMode(undefined);
                  setTags(tags.length === 1 && tags[0] === TAG_DE_CLIENTE ? [] : [TAG_DE_CLIENTE]);
                },
              }
            : { chave: "clientes", rotulo: t("Clientes"), valor: resumo.data?.clientes },
          { chave: "novos", rotulo: t("Novos nos últimos 7 dias"), valor: resumo.data?.novos_7_dias },
          { chave: "pessoais", rotulo: t("Pessoais"), valor: resumo.data?.pessoais },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-[1fr_190px_190px]">
        <div className="relative min-w-0">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder={t("Buscar por nome, email ou telefone…")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between font-normal sm:w-[190px]" disabled={tagOptions.length === 0}>
              {tags[0] ? <PontoDaEtiqueta tag={tags[0]} className="mr-2" /> : null}
              {/* Resumo, e não a lista inteira: o gatilho tem a largura do filtro de
                  origem ao lado. Uma etiqueta mostra o nome; duas mostram a
                  primeira e o resto em contagem. */}
              <span className="truncate">{tags.length === 0
                ? `${t("Tag")}: ${t("todas")}`
                : tags.length === 1
                  ? `${t("Tag")}: ${tags[0]}`
                  : `${t("Tag")}: ${tags[0]} +${tags.length - 1}`}</span>
              <CaretDown size={16} aria-hidden className="shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>{t("Tag")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setTags([]);
                setTagMode(undefined);
              }}
            >
              {t("Todas")}
            </DropdownMenuItem>
            {/* O E/OU so aparece com DUAS etiquetas: com uma so o parametro nao
                muda o resultado, e um controle que nao muda nada e pior do que
                nenhum. */}
            {tags.length > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={tagMode === "ou" ? "ou" : "e"}
                  onValueChange={(modo) => setTagMode(modo === "ou" ? "ou" : undefined)}
                >
                  <DropdownMenuRadioItem value="e">{t("Todas (E)")}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="ou">{t("Qualquer uma (OU)")}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </>
            )}
            <DropdownMenuSeparator />
            {/* `DropdownMenuCheckboxItem` marca e NAO fecha o menu — e o
                `onSelect` com `preventDefault` trava esse comportamento, porque
                o item de checkbox fecha por padrao. Sem isso, escolher a segunda
                etiqueta exigiria reabrir o menu. */}
            {tagOptions.map((tagOption) => (
              <DropdownMenuCheckboxItem
                key={tagOption}
                checked={tags.includes(tagOption)}
                onCheckedChange={() => {
                  const escolhida = tags.includes(tagOption);
                  const proximas = escolhida
                    ? tags.filter((et) => et !== tagOption)
                    : [...tags, tagOption];
                  setTags(proximas);
                  // O modo so faz sentido com DUAS: com uma so ele nao muda o
                  // resultado, e o `&modo=ou` na URL seria ruido.
                  setTagMode(proximas.length > 1 ? tagMode : undefined);
                }}
                onSelect={(e) => e.preventDefault()}
              >
                <PontoDaEtiqueta tag={tagOption} className="mr-2" />
                {tagOption}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between font-normal sm:w-[190px]">
              <span className="truncate">{t("Ordenar")}: {t(ROTULO_DA_ORDEM[orderBy] ?? "Última atividade")}</span>
              <CaretDown size={16} aria-hidden className="shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={orderBy} onValueChange={(v) => handleSort(v as ContactOrderBy)}>
              {(Object.keys(ROTULO_DA_ORDEM) as ContactOrderBy[]).map((k) => (
                <DropdownMenuRadioItem key={k} value={k}>
                  {t(ROTULO_DA_ORDEM[k] ?? k)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {(search || tags.length > 0 || source) && (
        <div className="-mt-2">
        {(search || tags.length > 0 || source) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setTags([]);
              setTagMode(undefined);
              setSource(undefined);
              setSoPessoais(false);
            }}
          >
            {t("Limpar filtros")}
          </Button>
        )}
        </div>
      )}

      {podeAgirEmLote && (
        <BarraDeContatosEmLote
          quantidade={selecao.quantidade}
          pendente={lote.isPending}
          onAdicionarEtiqueta={(tag) => rodarLote({ action: "tag", op: "add", tag })}
          onRemoverEtiqueta={(tag) => rodarLote({ action: "tag", op: "remove", tag })}
          onMudarResponsavel={
            podeMudarResponsavel
              ? (donoUserId) =>
                  rodarLote({ action: "carteira", dono_user_id: donoUserId, origem: "manual" })
              : undefined
          }
          onPreencherCampo={(chave, valor) => rodarLote({ action: "custom-field", chave, valor })}
          onLimpar={selecao.limpar}
        />
      )}

      {q.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : q.isError ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-error-fg">{t("Erro ao carregar contatos.")}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => q.refetch()}
          >
            {t("Tentar novamente")}
          </Button>
        </Card>
      ) : allContacts.length === 0 ? (
        <Card className="p-2">
          <EmptyContacts />
        </Card>
      ) : (
        <>
          {/* Abaixo de `md` a tabela vira cartão e o cabeçalho some, levando a
              caixa "selecionar todas": este botão é a porta que a substitui. */}
          {podeAgirEmLote && (
            <Button
              size="sm"
              variant="outline"
              className="md:hidden"
              onClick={() => selecao.selecionarTodos(allContacts.map((c) => c.id))}
            >
              {t("Selecionar todos os contatos visíveis")}
            </Button>
          )}
            <ContactsTable
              contacts={allContacts}
              orderBy={orderBy}
              orderDir={orderDir}
              onSort={handleSort}
              // Sem `contact.update` não há barra, então as caixas seriam um
              // controle que marca e não leva a nada: a tabela só as desenha
              // quando recebe `onAlternarSelecao`.
              selecionados={podeAgirEmLote ? selecao.selecionados : undefined}
              onAlternarSelecao={podeAgirEmLote ? selecao.alternar : undefined}
              onSelecionarTodosVisiveis={
                podeAgirEmLote
                  ? () => selecao.selecionarTodos(allContacts.map((c) => c.id))
                  : undefined
              }
            />
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {allContacts.length} {allContacts.length === 1 ? t("contato") : t("contatos")}
              {q.hasNextPage ? ` ${t("carregados — há mais resultados")}` : ""}
            </p>
            {q.hasNextPage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => q.fetchNextPage()}
                disabled={q.isFetchingNextPage}
              >
                {q.isFetchingNextPage ? t("Carregando…") : t("Carregar mais")}
              </Button>
            )}
          </div>
        </>
      )}

      <NewContactDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ImportContactsDialog open={importOpen} onOpenChange={setImportOpen} />
      <SyncPhoneContactsDialog open={syncOpen} onOpenChange={setSyncOpen} />
      <MergeDialog open={duplicadosOpen} onOpenChange={setDuplicadosOpen} />
    </div>
  );
}
