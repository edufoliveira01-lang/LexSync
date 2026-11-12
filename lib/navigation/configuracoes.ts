import { NAV_CATALOG } from "./catalogo";

const AJUDA = "/app/ajuda";

/** Telas que o menu de Configurações abre: `/app/settings/*` e os assuntos de Configurações que moram em outra rota (avisos da agenda, equipe, LGPD, extensões, dados externos). */
const RAIZES = Array.from(
  new Set([
    "/app/settings",
    ...NAV_CATALOG.filter((i) => i.group === "organizacao" && i.href !== AJUDA).map((i) => i.href as string),
  ]),
);

/** Verdadeiro quando a rota pertence a Configurações, mesmo fora de /app/settings. Faz "Configurações" (e não "Agenda") ficar marcado no menu principal. */
export function ehTelaDeConfiguracoes(pathname: string): boolean {
  return RAIZES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}
