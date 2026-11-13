import { NAV_CATALOG, NAV_GROUPS } from "./catalogo";

/**
 * O rótulo da ÁREA da tela (o texto pequeno em maiúsculas acima do título, como no Sales): sai do grupo do menu a que a rota pertence.
 * Configurações e tudo que mora no grupo "Organização" viram "Configurações". Rota fora do catálogo não ganha rótulo.
 */
export function areaDaRota(caminho: string): string | null {
  // Preview de desenvolvimento: /dev-preview/<tela> vale como /app/<tela>.
  const pathname = caminho.startsWith("/dev-preview/") ? caminho.replace("/dev-preview/", "/app/") : caminho;
  let melhor: { href: string; group: string } | null = null;
  for (const item of NAV_CATALOG) {
    const href = item.href as string;
    if (pathname === href || pathname.startsWith(href + "/")) {
      if (!melhor || href.length > melhor.href.length) melhor = { href, group: item.group };
    }
  }
  if (pathname === "/app/settings" || pathname.startsWith("/app/settings/")) return "Configurações";
  if (!melhor) return null;
  if (melhor.group === "organizacao") return "Configurações";
  return NAV_GROUPS.find((g) => g.id === melhor!.group)?.label ?? null;
}
