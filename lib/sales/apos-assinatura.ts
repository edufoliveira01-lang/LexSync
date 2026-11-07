/**
 * Fork Sales — o que acontece quando o cliente assina o contrato.
 *
 * Escolha do escritório, em duas camadas: o PADRÃO fica em `organizations.settings.sales.apos_assinatura` e, ao gerar o contrato,
 * o atendente pode trocar o destino só daquele contrato. O que vale para o contrato viaja escondido na própria linha
 * "Contrato enviado…" da conversa (depois de `SEPARADOR_DA_ESCOLHA`) e é aplicado quando a assinatura é detectada.
 */
import { z } from "zod";

export const SEPARADOR_DA_ESCOLHA = "⁣cfg:";
export const SEPARADOR_DOS_DADOS = "⁣dados:";

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

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");
const deb64 = (t: string): unknown => { try { return JSON.parse(Buffer.from(t, "base64").toString("utf8")); } catch { return null; } };

/** Esconde, no fim da linha da conversa, a escolha do "depois da assinatura" e os dados do cliente (para preencher o negócio na hora de criá-lo). */
export const embutirEscolha = (visivel: string, escolha: AposAssinatura, dados?: Record<string, string>): string =>
  `${visivel}${Object.keys(escolha).length ? `${SEPARADOR_DA_ESCOLHA}${b64(escolha)}` : ""}${dados && Object.keys(dados).length ? `${SEPARADOR_DOS_DADOS}${b64(dados)}` : ""}`;

function trecho(corpo: string, separador: string): string | null {
  const i = corpo.indexOf(separador);
  if (i < 0) return null;
  const resto = corpo.slice(i + separador.length);
  const fim = resto.indexOf(SEPARADOR_DA_ESCOLHA.charAt(0));
  return fim < 0 ? resto : resto.slice(0, fim);
}

export function lerEscolhaEmbutida(corpo: string): AposAssinatura | null {
  const t = trecho(corpo, SEPARADOR_DA_ESCOLHA);
  return t === null ? null : limparEscolha(deb64(t));
}

export function lerDadosEmbutidos(corpo: string): Record<string, string> {
  const t = trecho(corpo, SEPARADOR_DOS_DADOS);
  const o = t === null ? null : deb64(t);
  return o && typeof o === "object" && !Array.isArray(o)
    ? (Object.fromEntries(Object.entries(o as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Record<string, string>)
    : {};
}

export function padraoDaEmpresa(settings: unknown): AposAssinatura {
  const s = (settings ?? {}) as { sales?: { apos_assinatura?: unknown } };
  return limparEscolha(s.sales?.apos_assinatura);
}

/** Mensagem enviada ao cliente quando todos os documentos estão assinados. `{{nome}}` vira o primeiro nome do cliente. */
export const MENSAGEM_PADRAO_APOS_ASSINATURA =
  "Olá, {{nome}}! Recebemos todos os seus documentos assinados. Obrigado pela confiança!";

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
