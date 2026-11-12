import { SettingsNav } from "@/components/settings/SettingsNav";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { modulosLigados } from "@/lib/instalacao/modulos";
import { hubSections } from "@/lib/navigation/registry";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Casca das Configurações (reutilizável): o menu com todos os assuntos fica sempre ao lado da página aberta (no celular vira um seletor),
 * como no sistema Sales. O que aparece vem do mesmo registro do hub, então segue o papel e os módulos da pessoa.
 */
export async function ConfiguracoesShell({
  children,
  paginaComMargem = false,
}: {
  children: React.ReactNode;
  /** Páginas que já trazem a própria margem (fora de /app/settings) não repetem o respiro lateral. */
  paginaComMargem?: boolean;
}) {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  const idioma = user.idioma;
  const secoes = hubSections(
    "organizacao",
    user.is_platform_admin && !user.support,
    activeOrg?.role ?? null,
    activeOrg?.interface_settings,
    await modulosLigados(createAdminClient()),
    activeOrg?.capacidades_ligadas ?? [],
  );
  const grupos = secoes.map(({ section, items }) => ({
    titulo: traduzir(section || "Configurações", idioma),
    itens: items.map((i) => ({ href: i.href, label: traduzir(i.label, idioma) })),
  }));

  return (
    <div className={`grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] ${paginaComMargem ? "pl-6 pt-6 lg:pl-6" : "p-6"}`}>
      <SettingsNav
        grupos={grupos}
        rotuloVisaoGeral={traduzir("Visão geral", idioma)}
        rotuloBuscar={traduzir("Buscar configuração…", idioma)}
        rotuloIrPara={traduzir("Ir para", idioma)}
        rotuloNada={traduzir("Nada encontrado.", idioma)}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
