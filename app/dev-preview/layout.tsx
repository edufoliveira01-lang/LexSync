import { notFound } from "next/navigation";

import { AuthProvider } from "@/hooks/auth/AuthProvider";
import { ProvedorDeCoresDasEtiquetas } from "@/components/tags/CoresDasEtiquetas";
import { VoiceCallProvider } from "@/components/voice/VoiceCallContext";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import { ProvedorDaOcupacaoDoRodape } from "@/lib/ui/rodape-ocupado";
import type { ActiveOrg, AuthUser } from "@/lib/auth/types";
import { AppShell } from "@/app/app/_components/AppShell";

/**
 * PREVIEW DE DESENVOLVIMENTO — monta a casca do produto (menu, barra do topo) com uma pessoa e uma organização de mentira,
 * para conferir o visual no computador sem banco nenhum. Os dados das telas vêm de um mock de rede (Playwright).
 *
 * Nunca existe em produção: o servidor de produção responde 404 a tudo aqui.
 */
const USUARIO: AuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "eduardo@escritorio.com.br",
  full_name: "Eduardo Oliveira",
  avatar_url: null,
  is_platform_admin: false,
  idioma: "pt-BR",
  organizations: [],
} as unknown as AuthUser;

const ORGANIZACAO = {
  orgId: "00000000-0000-4000-8000-0000000000aa",
  name: "Sales & Associados",
  role: "admin",
  cliente_pela_agenda: true,
  modulos_ligados: [],
  capacidades_ligadas: [],
} as unknown as ActiveOrg;

export default function DevPreviewLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <IdiomaProvider locale="pt-BR">
      <AuthProvider user={USUARIO} activeOrg={ORGANIZACAO}>
        <ProvedorDeCoresDasEtiquetas>
          <ProvedorDaOcupacaoDoRodape>
            <VoiceCallProvider>
              <AppShell sidebarCollapsed={false} podeAtender={false}>
                {children}
              </AppShell>
            </VoiceCallProvider>
          </ProvedorDaOcupacaoDoRodape>
        </ProvedorDeCoresDasEtiquetas>
      </AuthProvider>
    </IdiomaProvider>
  );
}
