"use client";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { MagnifyingGlass } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/i18n/useT";
import { CommandPalette } from "@/components/shell/CommandPalette";

export function SearchTrigger({ noMenu = false, recolhido = false }: { noMenu?: boolean; recolhido?: boolean } = {}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  // `enableOnFormTags`: o atalho precisa funcionar com o cursor dentro do
  // composer do inbox, que é onde o operador passa o dia.
  useHotkeys("mod+k", () => setOpen(true), { preventDefault: true, enableOnFormTags: true });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        // Fork Sales: no menu lateral a busca ocupa a largura toda (ou vira só o ícone com o menu recolhido).
        className={noMenu ? "busca-do-menu w-full justify-start gap-2 text-muted-foreground" : "gap-2 text-muted-foreground"}
        onClick={() => setOpen(true)}
        aria-label={recolhido ? t("Buscar...") : undefined}
      >
        <MagnifyingGlass size={14} aria-hidden />
        <span className={recolhido ? "sr-only" : "max-md:sr-only"}>{t("Buscar...")}</span>
        <kbd className={recolhido ? "sr-only" : "ml-auto hidden md:inline rounded-md border bg-muted px-1.5 py-0.5 text-[10px]"}>⌘K</kbd>
      </Button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
