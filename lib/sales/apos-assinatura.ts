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

/** Frase para o histórico: o que foi feito (ou não) ao assinar. */
export function resumoDoQueFoiFeito(r: { moveu: string | null; semNegocio: boolean; tag: string | null; fechou: boolean }): string {
  const partes = [
    r.moveu ? `negócio movido para "${r.moveu}"` : r.semNegocio ? "sem negócio aberto para mover" : null,
    r.tag ? `etiqueta "${r.tag}" adicionada` : null,
    r.fechou ? "conversa fechada" : null,
  ].filter(Boolean);
  return partes.join(" · ");
}
