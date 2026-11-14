/**
 * Fork Sales — o boleto que CHEGA DEPOIS.
 *
 * O link de pagamento e a linha digitável saem na hora. O PIX copia e cola e o PDF do boleto dependem de consultas ao Asaas que, no ambiente de testes
 * (e às vezes em produção), demoram mais do que a resposta do chat pode esperar. Em vez de fazer o cliente esperar (ou de desistir), este módulo
 * continua buscando em SEGUNDO PLANO, com paciência, e manda cada peça NA MESMA CONVERSA assim que ela fica pronta. Ao fim das tentativas, se ainda
 * faltar algo, a equipe lê na conversa o MOTIVO real (não um "deu erro" genérico).
 *
 * Uma só rodada por (conversa, parcela) por vez; o que já saiu nunca é reenviado.
 */
import { enviarPdf, enviarTexto } from "@/lib/sales/acompanhar-contratos";
import { complementoDaCobrancaNoSales, type CobrancaDoCliente } from "@/lib/sales/contratos";
import { anotarNaConversaDoContato } from "@/lib/inbox/acao-do-agente";
import { logger } from "@/lib/logger";

/** Esperas ANTES de cada tentativa (cada tentativa ainda leva até ~45 s no Sales): ~10 s, ~40 s, ~1,5 min, ~2,5 min depois. */
export const ESPERAS_DO_COMPLEMENTO_MS: readonly number[] = [10_000, 40_000, 90_000, 150_000];

const emAndamento = new Set<string>();

export interface EntradaDoComplemento {
  orgId: string; contato: string; conversationId: string; slug: string; telefone: string; lancamentoId: number;
  /** O que JÁ foi entregue na primeira resposta. */
  jaEnviou: { pix: boolean; pdf: boolean };
  /** Último motivo conhecido de cada peça que faltou (para o caso de nenhuma tentativa melhorar). */
  motivos?: { pix?: string | null; pdf?: string | null };
}

export interface DepsDoComplemento {
  esperar?: (ms: number) => Promise<void>;
  esperas?: readonly number[];
  pedir?: typeof complementoDaCobrancaNoSales;
  texto?: typeof enviarTexto;
  pdf?: typeof enviarPdf;
  capsula?: typeof anotarNaConversaDoContato;
}

export const textoDoPix = (pix: string) => `PIX copia e cola (copie a mensagem abaixo e cole no app do banco):\n\n${pix}`;

/** Dispara a rodada em segundo plano (não bloqueia quem chama). `false` quando já há uma rodada igual em andamento. */
export function completarCobrancaEmSegundoPlano(e: EntradaDoComplemento, deps: DepsDoComplemento = {}): boolean {
  const chave = `${e.conversationId}:${e.lancamentoId}`;
  if (emAndamento.has(chave)) return false;
  emAndamento.add(chave);
  void rodar(e, deps).catch((err) => logger.warn("[sales.cobranca] rodada em segundo plano falhou", { conversation_id: e.conversationId, erro: err instanceof Error ? err.message : String(err) })).finally(() => emAndamento.delete(chave));
  return true;
}

export async function rodar(e: EntradaDoComplemento, deps: DepsDoComplemento = {}): Promise<{ pix: boolean; pdf: boolean; tentativas: number }> {
  const esperar = deps.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const pedir = deps.pedir ?? complementoDaCobrancaNoSales;
  const texto = deps.texto ?? enviarTexto;
  const pdf = deps.pdf ?? enviarPdf;
  const capsula = deps.capsula ?? anotarNaConversaDoContato;
  const estado = { ...e.jaEnviou };
  const motivos = { pix: e.motivos?.pix ?? null, pdf: e.motivos?.pdf ?? null };
  let tentativas = 0;
  for (const espera of deps.esperas ?? ESPERAS_DO_COMPLEMENTO_MS) {
    if (estado.pix && estado.pdf) break;
    await esperar(espera);
    tentativas++;
    let c: CobrancaDoCliente;
    try { c = await pedir(e.slug, { telefone: e.telefone, lancamento_id: e.lancamentoId }); }
    catch (err) { motivos.pix = motivos.pdf = err instanceof Error ? err.message : "o Sales não respondeu"; continue; }
    if (!estado.pix) {
      if (c.pix) { if (await texto(e.orgId, e.conversationId, textoDoPix(c.pix))) { estado.pix = true; motivos.pix = null; } }
      else motivos.pix = c.pix_motivo ?? motivos.pix;
    }
    if (!estado.pdf) {
      if (c.boleto_pdf_base64) {
        if (await pdf(e.orgId, e.conversationId, c.boleto_pdf_nome ?? "Boleto.pdf", Buffer.from(c.boleto_pdf_base64, "base64"), "Boleto em PDF")) { estado.pdf = true; motivos.pdf = null; }
        else motivos.pdf = "o envio do arquivo ao cliente falhou";
      } else motivos.pdf = c.boleto_pdf_motivo ?? motivos.pdf;
    }
  }
  if (estado.pix && estado.pdf) {
    if (tentativas > 0) await capsula(e.orgId, e.contato, "enviou ao cliente o PIX e o boleto em PDF que estavam pendentes");
  } else {
    const faltou = [!estado.pdf ? `PDF do boleto (${motivos.pdf ?? "indisponível"})` : null, !estado.pix ? `PIX copia e cola (${motivos.pix ?? "indisponível"})` : null].filter(Boolean).join("; ");
    await capsula(e.orgId, e.contato, `não conseguiu enviar depois de ${tentativas} tentativa(s): ${faltou}. O cliente já tem o link de pagamento.`);
  }
  return { ...estado, tentativas };
}
