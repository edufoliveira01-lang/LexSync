/**
 * Fork Sales — parte PURA (segura para o navegador) do registro de eventos na conversa.
 * Nada de servidor aqui: `ChatThread` (client) importa este arquivo.
 */
export const MARCA_DE_EVENTO = "\u2063[evento]\u2063 ";

export function ehEventoDaConversa(corpo: string | null | undefined): boolean {
  return typeof corpo === "string" && corpo.startsWith(MARCA_DE_EVENTO);
}

/** O texto visível: o que vem depois de "\u2063cfg:" (dados escondidos do evento) não aparece na tela. */
export function textoDoEvento(corpo: string): string {
  const texto = corpo.slice(MARCA_DE_EVENTO.length);
  const i = texto.indexOf("\u2063cfg:");
  return i < 0 ? texto : texto.slice(0, i);
}
