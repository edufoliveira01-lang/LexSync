/**
 * As abas de seção que viviam aqui foram removidas: só apareciam para quem já
 * estava dentro de `/app/ai/*`, o que deixava Conhecimento, Credenciais, Uso,
 * Casos e Alertas invisíveis do resto do sistema. Quem faz esse trabalho agora
 * é o hub em `/app/ai`, alcançável pelo sidebar.
 */
export default function AiLayout({ children }: { children: React.ReactNode }) {
  // Sem div em volta: o filho direto do <main> é a própria página, e a margem de página (28/40px) vem só da casca.
  return <>{children}</>;
}
