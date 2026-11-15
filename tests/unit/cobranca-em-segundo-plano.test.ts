import { describe, expect, it, vi } from "vitest";

import { AVISO_DO_PIX, enviarPixInteiro, rodar } from "@/lib/sales/cobranca-em-segundo-plano";

const base = { orgId: "org-1", contato: "c1", conversationId: "conv-1", slug: "alfa", telefone: "5513974045973", lancamentoId: 5 };
const completa = { lancamento_id: 5, descricao: "H", valor_centavos: 5000, vencimento: "2026-11-14", link: "https://x", linha_digitavel: "1", pix: "000201PIX", boleto_pdf_base64: Buffer.from("%PDF-").toString("base64"), boleto_pdf_nome: "Boleto.pdf", boleto_pdf_motivo: null, pix_motivo: null, pendente: false, outras_em_aberto: 0 };
const semNada = { ...completa, pix: "", boleto_pdf_base64: null, boleto_pdf_nome: null, boleto_pdf_motivo: "o Asaas demorou", pix_motivo: "sem resposta em 40 s", pendente: true };

function deps(respostas: Array<unknown>) {
  const esperas: number[] = [];
  const pedir = vi.fn(async () => { const r = respostas.shift(); if (r instanceof Error) throw r; return r as never; });
  const texto = vi.fn(async () => true);
  const pdf = vi.fn(async () => ({ ok: true }) as { ok: true } | { ok: false; motivo: string });
  const capsula = vi.fn(async () => undefined);
  return { esperas, pedir, texto, pdf, capsula, d: { esperar: async (ms: number) => { esperas.push(ms); }, esperas: [10, 40, 90, 150], pedir: pedir as never, texto: texto as never, pdf: pdf as never, capsula: capsula as never } };
}

describe("cobrança em segundo plano — o PIX e o PDF que chegam depois", () => {
  it("tenta de novo até o Asaas liberar e manda cada peça UMA vez, na mesma conversa", async () => {
    const x = deps([semNada, { ...semNada, pix: "000201PIX", pix_motivo: null }, completa]);
    const r = await rodar({ ...base, jaEnviou: { pix: false, pdf: false } }, x.d);
    expect(r).toEqual({ pix: true, pdf: true, tentativas: 3 });
    // aviso + código SOZINHO, nessa ordem
    expect(x.texto).toHaveBeenCalledTimes(2);
    expect(x.texto).toHaveBeenNthCalledWith(1, "org-1", "conv-1", AVISO_DO_PIX);
    expect(x.texto).toHaveBeenNthCalledWith(2, "org-1", "conv-1", "000201PIX");
    expect(x.pdf).toHaveBeenCalledTimes(1);
    expect(x.esperas).toEqual([10, 40, 90]);
    expect(x.capsula).toHaveBeenCalledWith("org-1", "c1", expect.stringContaining("que estavam pendentes"));
  });
  it("o que já saiu na primeira resposta não é reenviado", async () => {
    const x = deps([completa]);
    await rodar({ ...base, jaEnviou: { pix: true, pdf: false } }, x.d);
    expect(x.texto).not.toHaveBeenCalled();
    expect(x.pdf).toHaveBeenCalledTimes(1);
  });
  it("sem nada pendente não chama o Sales nem escreve cápsula", async () => {
    const x = deps([]);
    const r = await rodar({ ...base, jaEnviou: { pix: true, pdf: true } }, x.d);
    expect(r.tentativas).toBe(0);
    expect(x.pedir).not.toHaveBeenCalled();
    expect(x.capsula).not.toHaveBeenCalled();
  });
  it("se esgotar as tentativas, a equipe lê o MOTIVO real de cada peça; o link já está com o cliente", async () => {
    const x = deps([semNada, semNada, new Error("O painel recusou o pedido (504)."), semNada]);
    const r = await rodar({ ...base, jaEnviou: { pix: false, pdf: false } }, x.d);
    expect(r).toEqual({ pix: false, pdf: false, tentativas: 4 });
    const frase = (x.capsula.mock.calls[0] as unknown as [string, string, string])[2];
    expect(frase).toContain("4 tentativa(s)");
    expect(frase).toContain("PDF do boleto (o Asaas demorou)");
    expect(frase).toContain("PIX copia e cola (sem resposta em 40 s)");
    expect(frase).toContain("já tem o link de pagamento");
    // o cliente, que ouviu "chegam em seguida", é avisado com honestidade e levado ao link
    expect(x.texto).toHaveBeenCalledTimes(1);
    expect((x.texto.mock.calls[0] as unknown as [string, string, string])[2]).toMatch(/Não consegui enviar o PDF do boleto e o PIX copia e cola.*use o link/);
  });
  it("o motivo EXATO do envio do arquivo aparece na cápsula final", async () => {
    const x = deps([completa, completa, completa, completa]);
    x.pdf.mockResolvedValue({ ok: false, motivo: "falhou ao guardar o arquivo no armazenamento: Bucket not found" });
    const r = await rodar({ ...base, jaEnviou: { pix: true, pdf: false } }, x.d);
    expect(r.pdf).toBe(false);
    expect((x.capsula.mock.calls[0] as unknown as [string, string, string])[2]).toContain("PDF do boleto (falhou ao guardar o arquivo no armazenamento: Bucket not found)");
    expect((x.texto.mock.calls[0] as unknown as [string, string, string])[2]).toMatch(/Não consegui enviar o PDF do boleto por aqui/);
  });
  it("falha ao enviar o arquivo ao cliente conta como pendente e tenta de novo", async () => {
    const x = deps([completa, completa]);
    x.pdf.mockResolvedValueOnce({ ok: false, motivo: "falhou ao enviar ao cliente: timeout" });
    const r = await rodar({ ...base, jaEnviou: { pix: true, pdf: false } }, x.d);
    expect(r.pdf).toBe(true);
    expect(x.pdf).toHaveBeenCalledTimes(2);
  });
  it("o código PIX vai em mensagem própria (só o código), e o resultado é o do CÓDIGO", async () => {
    const enviadas: string[] = [];
    const envia = (async (_o: string, _c: string, t: string) => { enviadas.push(t); return t === "000201PIX"; }) as never;
    expect(await enviarPixInteiro("org-1", "conv-1", "000201PIX", envia)).toBe(true);
    expect(enviadas).toEqual([AVISO_DO_PIX, "000201PIX"]);
    expect(enviadas[1]).not.toContain("PIX copia e cola");
  });
});
