/**
 * Endereço do sistema do escritório (Sales) para o login federado. Aceita "escritorio.com.br" ou "https://escritorio.com.br/qualquer/coisa"
 * e devolve só a origem https; recusa usuário/senha na URL, IP e hosts sem ponto. O destino final é sempre `/atendimento` do próprio sistema.
 */
export function origemDoSistema(entrada: string): string | null {
  const bruto = entrada.trim();
  if (!bruto || bruto.length > 253) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return null;
  return `https://${host}${url.port ? `:${url.port}` : ""}`;
}

export const CHAVE_SISTEMA = "deskcomm:sistema-do-escritorio";

export function lembrarSistema(origem: string): void {
  try {
    window.localStorage.setItem(CHAVE_SISTEMA, origem);
  } catch {
    /* sem armazenamento: pergunta de novo na próxima */
  }
}
export function sistemaLembrado(): string | null {
  try {
    const v = window.localStorage.getItem(CHAVE_SISTEMA);
    return v ? origemDoSistema(v) : null;
  } catch {
    return null;
  }
}
