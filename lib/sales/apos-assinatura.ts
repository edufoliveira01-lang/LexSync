/**
 * Fork Sales — o que acontece quando o cliente assina o contrato.
 *
 * Escolha do escritório, em duas camadas: o PADRÃO fica em `organizations.settings.sales.apos_assinatura` e, ao gerar o contrato,
 * o atendente pode trocar o destino só daquele contrato. O que vale para o contrato viaja escondido na própria linha
 * "Contrato enviado…" da conversa (depois de `SEPARADOR_DA_ESCOLHA`) e é aplicado quando a assinatura é detectada.
 */
import { z } from "zod";

export const SEPARADOR_DA_ESCOLHA = "⁣cfg:";

export const aposAssinaturaSchema = z.object({
  pipeline_id: z.string().uuid().optional(),
  stage_id: z.string().uuid().optional(),
  tag: z.string().trim().min(1).max(40).optional(),
  fechar_conversa: z.boolean().optional(),
});
export type AposAssinatura = z.infer<typeof aposAssinaturaSchema>;

export function limparEscolha(bruto: unknown): AposAssinatura {
  const p = aposAssinaturaSchema.safeParse(bruto);
  if (!p.success) return {};
  const e = p.data;
  return {
    ...(e.stage_id && e.pipeline_id ? { pipeline_id: e.pipeline_id, stage_id: e.stage_id } : {}),
    ...(e.tag ? { tag: e.tag } : {}),
    ...(e.fechar_conversa ? { fechar_conversa: true } : {}),
  };
}

/** A escolha que vale: a do contrato, campo a campo, por cima do padrão da empresa. */
export function escolhaEfetiva(padrao: AposAssinatura, doContrato: AposAssinatura | null): AposAssinatura {
  return limparEscolha({ ...padrao, ...(doContrato ?? {}) });
}

export const embutirEscolha = (visivel: string, escolha: AposAssinatura): string =>
  Object.keys(escolha).length === 0 ? visivel : `${visivel}${SEPARADOR_DA_ESCOLHA}${Buffer.from(JSON.stringify(escolha)).toString("base64")}`;

export function lerEscolhaEmbutida(corpo: string): AposAssinatura | null {
  const i = corpo.indexOf(SEPARADOR_DA_ESCOLHA);
  if (i < 0) return null;
  try { return limparEscolha(JSON.parse(Buffer.from(corpo.slice(i + SEPARADOR_DA_ESCOLHA.length), "base64").toString("utf8"))); } catch { return null; }
}

export function padraoDaEmpresa(settings: unknown): AposAssinatura {
  const s = (settings ?? {}) as { sales?: { apos_assinatura?: unknown } };
  return limparEscolha(s.sales?.apos_assinatura);
}

/** Mensagem enviada ao cliente quando todos os documentos estão assinados. `{{nome}}` vira o primeiro nome do cliente. */
export const MENSAGEM_PADRAO_APOS_ASSINATURA =
  "Olá, {{nome}}! Recebemos todos os seus documentos assinados. Obrigado pela confiança! Nossa equipe já vai dar andamento e entra em contato com os próximos passos.";

/** `undefined` (nunca configurada) usa o texto padrão; texto vazio significa "não enviar mensagem". */
export function mensagemAposAssinatura(settings: unknown, nomeCompleto: string | null): string | null {
  const s = (settings ?? {}) as { sales?: { mensagem_apos_assinatura?: unknown } };
  const bruto = s.sales?.mensagem_apos_assinatura;
  const modelo = typeof bruto === "string" ? bruto : MENSAGEM_PADRAO_APOS_ASSINATURA;
  if (!modelo.trim()) return null;
  const primeiro = (nomeCompleto ?? "").trim().split(/\s+/)[0] ?? "";
  return modelo.replace(/\{\{\s*nome\s*\}\}/gi, primeiro || "").replace(/\s+([!,.?])/g, "$1").trim();
}

/** Frase para o histórico: o que foi feito (ou não) ao assinar. */
export function resumoDoQueFoiFeito(r: { moveu: string | null; criou?: string | null; semNegocio: boolean; tag: string | null; fechou: boolean; mensagem?: boolean }): string {
  const partes = [
    r.moveu ? `negócio movido para "${r.moveu}"` : r.criou ? `negócio criado na etapa "${r.criou}"` : r.semNegocio ? "sem negócio aberto para mover" : null,
    r.tag ? `etiqueta "${r.tag}" adicionada` : null,
    r.fechou ? "conversa fechada" : null,
    r.mensagem ? "mensagem enviada ao cliente" : null,
  ].filter(Boolean);
  return partes.join(" · ");
}
