import { ConfiguracoesShell } from "@/components/settings/ConfiguracoesShell";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <ConfiguracoesShell>{children}</ConfiguracoesShell>;
}
