"use client";
import Link from "next/link";
import { useT } from "@/hooks/i18n/useT";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { ArrowRight, BookOpen, Gear, SidebarSimple } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { toggleSidebar } from "@/app/actions/shell/toggleSidebar";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { ConnectionHealthDot } from "@/components/connections/ConnectionHealthDot";
import { ContadorDeCasos } from "@/components/shell/ContadorDeCasos";
import { ContadorDaFila } from "@/components/shell/ContadorDaFila";
import { ContadorDeTarefas } from "@/components/shell/ContadorDeTarefas";
import { useSystemVersion } from "@/hooks/system/useSystemVersion";
import { AlternadorDeSistema } from "./AlternadorDeSistema";
import { TenantSwitcher } from "./TenantSwitcher";
import { SimboloDoProduto } from "@/components/branding/MarcaDoProduto";
import { marcaEhADoProduto } from "@/lib/branding";
import { useMarcaDaInstalacao } from "@/lib/branding/contexto";
import { GRUPO_NO_RODAPE, sidebarGroups } from "@/lib/navigation/registry";
import { ehTelaDeConfiguracoes } from "@/lib/navigation/configuracoes";
import { usePrefetchPorIntencao } from "@/hooks/navigation/prefetchPorIntencao";

/** Item do menu no desenho do Sales: ícone de 18px, texto de 13px, ativo com tinta suave e barra de 3px. */
function Item({
  href,
  label,
  ativo,
  icone,
  intencao,
  onNavigate,
  children,
}: {
  href: string;
  label: string;
  ativo: boolean;
  icone: React.ReactNode;
  intencao: ReturnType<typeof usePrefetchPorIntencao>;
  onNavigate?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      {...intencao(href)}
      title={label}
      aria-current={ativo ? "page" : undefined}
      onClick={onNavigate}
      className={cn("dz-link", ativo && "is-active")}
    >
      {icone}
      <span className="dz-copy min-w-0 flex-1 truncate">{label}</span>
      <span className="dz-short">{label}</span>
      {children}
    </Link>
  );
}

interface SidebarContentProps {
  collapsed: boolean;
  showCollapseControl?: boolean;
  onNavigate?: () => void;
}

/**
 * Navegação principal, agrupada por objetivo.
 *
 * Não decide nada: `sidebarGroups()` (lib/navigation/registry.ts) resolve quais
 * grupos e destinos este papel vê, e este componente desenha. Antes, a lista de
 * itens e sete `usePermission()` viviam aqui — e divergiam do hub de
 * Configurações e das abas de IA, que mantinham suas próprias listas.
 */
export function SidebarContent({
  collapsed,
  showCollapseControl = true,
  onNavigate,
}: SidebarContentProps) {
  // A barra lateral aparece em TODA tela — traduzi-la aqui é o que faz a
  // escolha de idioma virar algo visível no primeiro clique.
  const t = useT();
  const pathname = usePathname();
  const emConfiguracoes = ehTelaDeConfiguracoes(pathname);
  const [isPending, startTransition] = useTransition();
  const { user, activeOrg } = useAuth();
  /**
   * O menu não prefetcha sozinho (#3170): um render RSC por link do menu (19
   * destinos × as duas instâncias, lateral e móvel), e eles disputam o servidor
   * com o render que o clique pediu. O prefetch passa a ser
   * por intenção (ponteiro/foco) — ver `hooks/navigation/prefetchPorIntencao.ts`.
   */
  const intencao = usePrefetchPorIntencao();
  const todos = sidebarGroups(
    user.is_platform_admin && !user.support,
    activeOrg?.role ?? null,
    activeOrg?.interface_settings,
    activeOrg?.modulos_ligados ?? [],
    activeOrg?.capacidades_ligadas ?? [],
  );
  // Configurações sai da área que rola e vai para o rodapé fixo: medido em
  // 1280x768, ele caía fora da dobra mesmo em telas de 1080px.
  const grupos = todos.filter((g) => g.group.id !== GRUPO_NO_RODAPE);
  const grupoDoRodape = todos.find((g) => g.group.id === GRUPO_NO_RODAPE);
  const rodape = grupoDoRodape?.group.hub;
  /**
   * "Ajuda" é o ÚLTIMO item do rodapé fixo (issue #3567), e chega por `href` em
   * vez de uma segunda lista escrita aqui: a entrada vive no `NAV_CATALOG` com
   * `sidebar: true`, então atravessa o mesmo filtro de papel, de módulo e de
   * área personalizada que todo o resto do menu. Um `Link` de Ajuda escrito à
   * mão aqui faria o link sobreviver a uma empresa que tirou a tela das áreas
   * dela — e a pessoa cairia num 403 saindo do socorro.
   *
   * O comentário NÃO pode citar a tag com os sinais: a cerca
   * `menu-prefetch-so-por-intencao` lê o TEXTO do arquivo, comentário incluído,
   * e uma tag de exemplo aqui é indistinguível de um link de verdade para ela.
   */
  const ajuda = grupoDoRodape?.items.find((d) => d.href === "/app/ajuda");

  const brand = useMarcaDaInstalacao();
  /**
   * O CONSUMIDOR do nome por organização.
   *
   * Sem ele, `settings.branding.app_name` seria campo decorativo: medido, o nome
   * da org não aparece em lugar nenhum da casca para o cliente típico de um
   * revendedor — o único leitor é o `TenantSwitcher`, e ele devolve `null` com
   * uma organização só.
   *
   * A marca da INSTALAÇÃO continua embaixo: a organização que não definiu nome
   * vê exatamente o que via antes. O que mudou é POR ONDE ela chega — era
   * `branding()`, que no navegador lê `window.__PUBLIC_ENV__` e no servidor lê
   * `process.env`, e essas duas fontes passaram a divergir quando o layout raiz
   * começou a injetar a marca do BANCO. Divergência entre SSR e cliente aqui não
   * é detalhe: com logo no banco e `APP_LOGO_URL` vazio, o servidor desenhava o
   * `<span>` de baixo e o cliente desenhava o `<img>` — React #418 em toda tela.
   * Hoje a marca vem por PROP do servidor (`useMarcaDaInstalacao`), pela mesma
   * rota de `activeOrg`, e os dois lados leem o mesmo objeto por construção.
   */
  const nome = activeOrg?.marca?.nome ?? brand.name;
  /**
   * O mesmo desenho para o LOGO — e é este par de linhas que fecha o caminho do
   * `logo_url` gravado até a tela.
   *
   * `||` e não `??`: vazio é AUSÊNCIA de logo, não "logo em branco". É a regra
   * que `resolveBranding` e `primeiroDefinido` já aplicam nas camadas de baixo, e
   * com `??` um `""` vindo de cima apagaria o logo do revendedor em vez de
   * descer para ele — que é o contrário do que a precedência por campo promete.
   */
  const logo = activeOrg?.marca?.logoUrl || brand.logoUrl;
  const logoEscuro =
    activeOrg?.marca?.logoDarkUrl !== undefined
      ? activeOrg.marca.logoDarkUrl
      : activeOrg?.marca?.logoUrl
        ? null
        : brand.logoDarkUrl;
  // Só quando NINGUÉM — nem a instalação, nem a organização — pôs marca própria:
  // é a condição de `lib/branding.ts`, avaliada sobre o que a barra vai mostrar.
  const marcaDoProduto = marcaEhADoProduto({ name: nome, logoUrl: logo ?? null });

  // Só a versão do original (1.101.0); o número do build (-sales.N) não cabe no cartão e quem precisa dele olha em Configurações › Atualização.
  const versao = (useSystemVersion().data?.current_version?.replace(/^v/i, "") ?? "").split("-")[0] ?? "";
  const nomeDaPessoa = user.full_name?.trim() || user.email;
  const iniciais = (user.full_name?.trim()
    ? user.full_name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("")
    : user.email.slice(0, 2)
  ).toUpperCase();
  const rotuloRecolher = collapsed ? t("Expandir sidebar") : t("Recolher sidebar");

  return (
    <>
      <div className="dz-brand">
        <span className={cn("dz-brand-mark", !logo && "is-padrao")}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-full w-full object-contain" />
          ) : (
            <SimboloDoProduto nome={nome} className="h-6 w-6" />
          )}
        </span>
        <div className="dz-copy min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-tight text-foreground">
            DisparaZap <span className="text-accent">2</span>
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={nome}>
            {nome}
          </p>
        </div>
      </div>
      <AlternadorDeSistema recolhido={collapsed} />
      <div className="hidden px-3 pt-1 empty:hidden md:block">
        <TenantSwitcher />
      </div>
      <nav
        className="dz-nav scrollbar-thin"
        aria-label={t("Navegação principal")}
      >
        {grupos.map(({ group, items }) => {
          const tituloId = `nav-grupo-${group.id}`;
          return (
            <div key={group.id} className="mb-3">
              <p id={tituloId} className="dz-group-head">
                {t(group.label)}
              </p>
              <ul aria-labelledby={tituloId} className="mt-0.5 space-y-0.5">
                {items.map((item) => {
                  const ativo =
                    !emConfiguracoes &&
                    (pathname === item.href || pathname.startsWith(item.href + "/"));
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Item
                        intencao={intencao}
                        onNavigate={onNavigate}
                        href={item.href}
                        label={t(item.label)}
                        ativo={ativo}
                        icone={<Icon size={18} aria-hidden className="shrink-0" />}
                      >
                        {item.healthDot && <ConnectionHealthDot className="ml-auto" />}
                        {item.contador === "casos" && <ContadorDeCasos compacto={collapsed} />}
                        {item.contador === "fila" && <ContadorDaFila compacto={collapsed} />}
                        {item.contador === "tarefas" && <ContadorDeTarefas compacto={collapsed} />}
                      </Item>
                    </li>
                  );
                })}
                {group.hub && (
                  <li>
                    <Item
                        intencao={intencao}
                        onNavigate={onNavigate}
                      href={group.hub.href}
                      label={t(group.hub.label)}
                      ativo={pathname === group.hub.href}
                      icone={<ArrowRight size={18} aria-hidden className="shrink-0" />}
                    />
                  </li>
                )}
              </ul>
            </div>
          );
        })}
        {(rodape || ajuda) && (
          <div className="mb-2">
            <p className="dz-group-head">{t("Configurações")}</p>
            <ul className="mt-0.5 space-y-0.5">
              {rodape && (
                <li>
                  <Item
                        intencao={intencao}
                        onNavigate={onNavigate}
                    href={rodape.href}
                    label={t(rodape.label)}
                    ativo={emConfiguracoes || pathname.startsWith(rodape.href)}
                    icone={<Gear size={18} aria-hidden className="shrink-0" />}
                  />
                </li>
              )}
              {ajuda && (
                <li>
                  <Item
                        intencao={intencao}
                        onNavigate={onNavigate}
                    href={ajuda.href}
                    label={t(ajuda.label)}
                    ativo={pathname.startsWith(ajuda.href)}
                    icone={<BookOpen size={18} aria-hidden className="shrink-0" />}
                  />
                </li>
              )}
            </ul>
          </div>
        )}
      </nav>
      <div className="dz-footer">
        <div className="dz-copy flex min-w-0 items-center gap-3">
          <span className="dz-avatar">{iniciais}</span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{nomeDaPessoa}</p>
            <p className="mt-0.5 text-[10px] text-text-subtle">
              DisparaZap{versao ? ` · v${versao}` : ""}
            </p>
          </div>
        </div>
        {showCollapseControl && (
          <button
            type="button"
            onClick={() => startTransition(() => toggleSidebar(collapsed))}
            disabled={isPending}
            className="dz-collapse"
            aria-label={rotuloRecolher}
            aria-expanded={!collapsed}
            title={rotuloRecolher}
          >
            <SidebarSimple size={18} aria-hidden />
          </button>
        )}
      </div>
    </>
  );
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <aside className={cn("dz-sidebar", collapsed && "is-collapsed")}>
      <SidebarContent collapsed={collapsed} />
    </aside>
  );
}
