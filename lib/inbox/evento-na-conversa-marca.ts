/**
 * Fork Sales — parte PURA (segura para o navegador) do registro de eventos na conversa.
 * Nada de servidor aqui: `ChatThread` (client) importa este arquivo.
 */
export const MARCA_DE_EVENTO = "\u2063[evento]\u2063 ";

export function ehEventoDaConversa(corpo: string | null | undefined): boolean {
  return typeof corpo === "string" && corpo.startsWith(MARCA_DE_EVENTO);
}

export function textoDoEvento(corpo: string): string {
  return corpo.slice(MARCA_DE_EVENTO.length);
}
