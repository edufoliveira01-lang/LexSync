/** Fork Sales — a mensagem que leva o link de assinatura ao cliente (pura: usada pelo formulário do atendente e pela ferramenta do agente). */
export function mensagemDoContrato(nome: string, documentos: { nome: string; sign_url: string }[], comEmail: boolean): string {
  const primeiro = nome.trim().split(/\s+/)[0] || "";
  const copia = comEmail ? "\n\nEnviamos uma cópia também para o seu e-mail." : "";
  if (documentos.length === 1) {
    // Um único link: uma assinatura vale para todos os documentos do modelo.
    return `Olá${primeiro ? `, ${primeiro}` : ""}! Para darmos andamento, precisamos que você assine os seus documentos, de forma segura, direto pelo celular. É só um link e uma única assinatura vale para todos:\n\n${documentos[0]?.sign_url ?? ""}${copia}`;
  }
  const lista = documentos.map((d, i) => `${i + 1}) ${d.nome}:\n${d.sign_url}`).join("\n\n");
  return `Olá${primeiro ? `, ${primeiro}` : ""}! Para darmos andamento, precisamos que você assine os ${documentos.length} documentos abaixo (cada um leva menos de 1 minuto), de forma segura, direto pelo celular:\n\n${lista}${copia}`;
}
