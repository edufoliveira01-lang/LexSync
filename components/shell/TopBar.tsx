"use client";
import { AlertsBell } from "./AlertsBell";
import { AvisoDePropostaEmDestaque } from "./AvisoDePropostaEmDestaque";
import { MobileSidebar } from "./MobileSidebar";
import { RelogioCalendario } from "./RelogioCalendario";
import { SearchTrigger } from "./SearchTrigger";
import { TenantSwitcher } from "./TenantSwitcher";
import { UserMenu } from "./UserMenu";

/** Barra do topo no desenho do Sales: busca larga à esquerda; notificações e menu da pessoa à direita. Em todas as larguras. */
export function TopBar() {
  return (
    <header data-casca="topo" className="dz-topbar sticky top-[var(--faixas-de-cima,0px)] z-20 flex items-center justify-between gap-3 px-3 md:px-6 xl:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="md:hidden">
          <MobileSidebar />
        </div>
        <div className="md:hidden">
          <TenantSwitcher />
        </div>
        <div className="hidden w-full max-w-xl md:block">
          <SearchTrigger noMenu />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <div className="md:hidden">
          <SearchTrigger />
        </div>
        <AlertsBell />
        <AvisoDePropostaEmDestaque />
        <UserMenu />
        <span aria-hidden className="mx-1 h-6 w-px bg-border" />
        <RelogioCalendario />
      </div>
    </header>
  );
}
