import { ConfiguracoesShell } from "@/components/settings/ConfiguracoesShell";

/** Esta tela é um assunto de Configurações: o menu de Configurações fica ao lado e "Configurações" segue marcado no menu principal. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  return <ConfiguracoesShell paginaComMargem>{children}</ConfiguracoesShell>;
}
