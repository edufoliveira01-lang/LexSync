/** Endereço do sistema do escritório (Sales): `https://<slug>.<domínio do painel sem o 1º rótulo>`, o mesmo desenho que o painel usa ao criar o escritório. */
export function enderecoDoSistemaDoEscritorio(urlDoPainel: string, slug: string): string | null {
  let host: string;
  try {
    host = new URL(urlDoPainel).hostname.toLowerCase();
  } catch {
    return null;
  }
  const partes = host.split(".");
  if (partes.length < 3 || !/^[a-z0-9-]{2,40}$/.test(slug)) return null;
  return `https://${slug}.${partes.slice(1).join(".")}`;
}
