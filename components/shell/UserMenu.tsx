"use client";
import { useTransition } from "react";
import { useUser, useAuth } from "@/hooks/auth/AuthProvider";
import { useHotkeys } from "react-hotkeys-hook";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type Theme } from "@/lib/theme";
import { useT } from "@/hooks/i18n/useT";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Gear, MonitorPlay, Moon, ShieldCheck, SignOut, Sun, UserCircle } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

function initials(name: string | null, email: string): string {
  if (name && name.trim()) {
    return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

const PAPEIS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gestor",
  agent: "Atendente",
  ai_operator: "Operador de IA",
  viewer: "Consulta",
};

const TEMAS: Array<{ modo: Theme; texto: string; Icone: typeof Sun }> = [
  { modo: "light", texto: "Claro", Icone: Sun },
  { modo: "dark", texto: "Escuro", Icone: Moon },
  { modo: "system", texto: "Automático (segue o computador)", Icone: MonitorPlay },
];

/**
 * O avatar do topo, como no Sales: nome e papel, Minha conta, Configurações, Aparência (claro, escuro, automático), Sair.
 * O parâmetro `noMenuLateral` é mantido só para quem ainda o passa; o menu é o mesmo em todo lugar.
 */
export function UserMenu(_props: { noMenuLateral?: boolean } = {}) {
  const t = useT();
  const user = useUser();
  const { activeOrg, signOut } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { theme, setTheme } = useTheme();
  const nome = user.full_name?.trim() || user.email;
  const papel = activeOrg?.role ? PAPEIS[activeOrg.role] : null;

  // O atalho que antes morava no botão de tema do topo.
  useHotkeys(
    "mod+shift+l",
    () => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light"),
    { preventDefault: true },
    [theme],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${t("Menu do usuário")}: ${initials(user.full_name, user.email)}`}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-100 text-[12px] font-semibold text-accent-700 ring-2 ring-transparent transition hover:ring-accent-300 focus-visible:outline-none focus-visible:ring-accent"
        >
          {initials(user.full_name, user.email)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px] rounded-xl p-1.5">
        <div className="px-3 pb-2 pt-1.5">
          <p className="truncate text-sm font-semibold text-foreground">{nome}</p>
          <p className="truncate text-xs text-muted-foreground">{papel ? t(papel) : user.email}</p>
        </div>
        <DropdownMenuItem asChild>
          <Link href="/app/settings/profile" className="gap-3 rounded-lg px-3 py-2 text-[13px]">
            <UserCircle size={16} aria-hidden /> {t("Minha conta")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/settings" className="gap-3 rounded-lg px-3 py-2 text-[13px]">
            <Gear size={16} aria-hidden /> {t("Configurações")}
          </Link>
        </DropdownMenuItem>
        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-text-subtle">
          {t("Aparência")}
        </p>
        {TEMAS.map(({ modo, texto, Icone }) => (
          <DropdownMenuItem
            key={modo}
            role="menuitemradio"
            aria-checked={theme === modo}
            onSelect={(e) => {
              e.preventDefault();
              setTheme(modo);
            }}
            className={cn("gap-3 rounded-lg px-3 py-2 text-[13px]", theme === modo && "dz-ativo-suave font-semibold")}
          >
            <Icone size={16} aria-hidden />
            <span className="flex-1">{t(texto)}</span>
            {theme === modo && <Check size={16} aria-hidden />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
          {/*
            A PORTA DO MODO ADMINISTRADOR.

            Até aqui só se chegava ao painel da instalação digitando /admin na
            barra de endereços, ou por um item chamado "Gerenciar organizações"
            escondido no seletor de organização — que leva a UMA tela do painel e
            não anuncia que existe um painel.

            Ela não entra em `lib/navigation/registry.ts` de propósito: aquele
            registro descreve a navegação do TENANT (`app/app/**`), e o teste de
            completude varre só aquela raiz — uma entrada para /admin reprovaria
            o CI como link morto. Além disso o registro não sabe expressar "só o
            dono do servidor": o campo `platform` que existe lá é um atalho que
            ABRE tudo para quem é dono, não um cadeado que restringe aos outros.
            Mesmo precedente de `VersionFooter`: porta bespoke, gate próprio.

            O rótulo diz MODO, não "admin": para quem instalou o sistema, o que
            ele quer não é "uma área chamada admin", é "ir para onde eu mexo no
            servidor" — e o subtítulo diz de que servidor se trata.
          */}
          {user.is_platform_admin && (
            <>
              <DropdownMenuItem
                asChild
                /*
                  ⚠️ QUEM NAVEGA É O `onClick` DAQUI, E NÃO O `<Link>`.

                  Medido no CI do #3608 (run 40791878045, job 123178915982): o
                  caso "a porta do modo administrador é achável sem digitar URL"
                  reprovou com a URL em `/app/inbox` — o clique FECHOU o menu
                  (`data-state="closed"` no trace) e **nenhuma** requisição de
                  navegação saiu, nem documento nem `_rsc`. Ou seja: o item foi
                  selecionado e a navegação do `<Link>` se perdeu no meio.

                  O mecanismo é a ORDEM dos handlers: o Next chama o `onClick`
                  que recebe por prop ANTES do `linkClicked` dele (`next/link`
                  16.4.2, `app-dir/link.js`), e esse `onClick` aqui é o do Radix,
                  que termina em `handleSelect` → fecha o menu no meio do MESMO
                  evento. A navegação do `<Link>` é, portanto, a ÚLTIMA coisa a
                  rodar, depois de o menu já ter sido fechado — e foi ela que
                  faltou no CI.

                  Por isso a porta não depende mais dela: não há como provar de
                  fora por que aquele trecho não rodou; há como não depender.
                  `preventDefault` faz o Radix PULAR o `onSelect` (que é quem
                  fecha o menu) e faz o próprio Link desistir no
                  `if (e.defaultPrevented) return` dele; quem leva ao painel é a
                  linha seguinte, uma só vez. O `<a href>` continua ali — clique
                  com ⌘/Ctrl/Shift/Alt ou com o botão do meio não é nosso, e o
                  navegador abre em aba nova como manda o href.
                */
                onClick={(event) => {
                  if (
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey ||
                    event.button !== 0
                  ) {
                    return;
                  }
                  event.preventDefault();
                  router.push("/admin");
                }}
              >
                <Link href="/admin" data-testid="porta-modo-administrador">
                  <ShieldCheck size={16} className="mr-2" aria-hidden />
                  <span className="flex flex-col">
                    <span>{t("Modo administrador")}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("Configurar este servidor")}
                    </span>
                  </span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            disabled={isPending}
            onClick={() => startTransition(async () => { await signOut(); })}
            className="gap-3 rounded-lg px-3 py-2 text-[13px] text-destructive"
          >
            <SignOut size={16} aria-hidden />
            {t("Sair")}
          </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
