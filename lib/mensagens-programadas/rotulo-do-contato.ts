/** O nome do cliente como a equipe o lê: o nome, ou o telefone quando não há nome. */
export function rotuloDoContatoParaEquipe(nome: string | null, telefone: string | null): string {
  const n = nome?.trim();
  if (n) return n;
  const t = telefone?.trim();
  return t || "Cliente";
}
