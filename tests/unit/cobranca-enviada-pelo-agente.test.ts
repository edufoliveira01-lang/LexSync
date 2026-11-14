import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErroContratoSales } from "@/lib/sales/contratos";

const pedir = vi.fn();
const texto = vi.fn();
const pdf = vi.fn();
vi.mock("@/lib/sales/contratos", async (original) => ({ ...(await original<typeof import("@/lib/sales/contratos")>()), cobrancaDoClienteNoSales: (...a: unknown[]) => pedir(...a) }));
vi.mock("@/lib/sales/acompanhar-contratos", () => ({ enviarTexto: (...a: unknown[]) => texto(...a), enviarPdf: (...a: unknown[]) => pdf(...a) }));
const gravados = vi.fn();
vi.mock("@/lib/sales/dados-do-cliente", async (original) => ({ ...(await original<typeof import("@/lib/sales/dados-do-cliente")>()), lerDadosGravados: (...a: unknown[]) => gravados(...a) }));
const capsula = vi.fn();
vi.mock("@/lib/inbox/acao-do-agente", async (original) => ({ ...(await original<typeof import("@/lib/inbox/acao-do-agente")>()), anotarNaConversaDoContato: (...a: unknown[]) => capsula(...a) }));
const segundoPlano = vi.fn();
vi.mock("@/lib/sales/cobranca-em-segundo-plano", async (original) => ({ ...(await original<typeof import("@/lib/sales/cobranca-em-segundo-plano")>()), completarCobrancaEmSegundoPlano: (...a: unknown[]) => segundoPlano(...a) }));
vi.mock("@/lib/sales/contrato-na-conversa", () => ({ slugDaOrg: async () => "alfa", criarContratoNaConversa: vi.fn(), contratoPendenteDaConversa: vi.fn() }));

import { crmEnviarCobranca } from "@/lib/mcp/tools/contratos-sales";
import { ALVO_DE_FUNIL } from "@/lib/leads/escopo-de-funil";

/** `from("conversations")` → a conversa; `from("contacts")` → o telefone. */
const ctx = (contatoDoTurno?: string, telefone: string | null = "5513974045973") => ({
  organizationId: "org-1", contatoDoTurno,
  supabase: {
    from: (tabela: string) => tabela === "contacts"
      ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { phone_number: telefone } }) }) }) }) }
      : { select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: "conv-1" } }) }) }) }) }) }) },
  },
}) as never;

const cobranca = { lancamento_id: 5, descricao: "Honorários 1/3", valor_centavos: 5000, vencimento: "2026-11-14", link: "https://asaas.com/i/1", linha_digitavel: "23793.38128 60000", pix: "000201PIX", boleto_pdf_base64: Buffer.from("%PDF-").toString("base64"), boleto_pdf_nome: "Boleto - venc 14-11-2026.pdf", outras_em_aberto: 0 };

describe("crm_enviar_cobranca — o agente manda o boleto e o PIX da parcela do cliente", () => {
  beforeEach(() => { segundoPlano.mockReset(); capsula.mockReset(); gravados.mockReset(); gravados.mockResolvedValue({}); pedir.mockReset(); texto.mockReset(); pdf.mockReset(); texto.mockResolvedValue(true); pdf.mockResolvedValue(true); pedir.mockResolvedValue(cobranca); });

  it("é escrita do AGENTE e não recebe id de contato, conversa ou organização: o alvo é o contato do turno", () => {
    expect(crmEnviarCobranca.category).toBe("write");
    expect(crmEnviarCobranca.requiresRole).toBe("ai_operator");
    expect(Object.keys(crmEnviarCobranca.inputSchema).join(",")).not.toMatch(/contact|conversation|lead_id|org|telefone/);
  });
  it("está no escopo de funil (senão o motor a recusa em silêncio)", () => {
    expect(ALVO_DE_FUNIL.crm_enviar_cobranca).toBe("sem_funil");
  });
  it("pede ao Sales pelo TELEFONE do contato e envia texto com link, PIX separado e o PDF", async () => {
    const r = (await crmEnviarCobranca.handler({}, ctx("c1"))) as { ok: boolean; enviado_ao_cliente?: boolean; pdf_enviado?: boolean; proximo_passo: string };
    expect(pedir).toHaveBeenCalledWith("alfa", { telefone: "5513974045973" });
    expect(r).toMatchObject({ ok: true, enviado_ao_cliente: true, pdf_enviado: true });
    expect(texto).toHaveBeenCalledTimes(2);
    expect(texto.mock.calls[0]![2]).toContain("https://asaas.com/i/1");
    expect(texto.mock.calls[0]![2]).toContain("R$");
    expect(texto.mock.calls[1]![2]).toContain("000201PIX");
    expect(pdf).toHaveBeenCalledWith("org-1", "conv-1", expect.stringContaining("Boleto"), expect.any(Buffer), "Boleto em PDF");
    expect(r.proximo_passo).toContain("NÃO repita");
  });
  it("só passa a parcela quando o modelo a informou", async () => {
    await crmEnviarCobranca.handler({ parcela: 5 }, ctx("c1"));
    expect(pedir).toHaveBeenCalledWith("alfa", { telefone: "5513974045973", lancamento_id: 5 });
  });
  it("sem contato no turno ou sem telefone, não pede nada ao Sales", async () => {
    expect(((await crmEnviarCobranca.handler({}, ctx(undefined))) as { ok: boolean }).ok).toBe(false);
    expect(((await crmEnviarCobranca.handler({}, ctx("c1", null))) as { ok: boolean }).ok).toBe(false);
    expect(pedir).not.toHaveBeenCalled();
  });
  it("recusa do Sales (vencida, sem parcela, sem Asaas) vira texto para o agente avisar a equipe, sem inventar boleto", async () => {
    pedir.mockRejectedValue(new ErroContratoSales("A parcela está vencida: a equipe precisa definir uma nova data antes de gerar o boleto.", 422));
    const r = (await crmEnviarCobranca.handler({}, ctx("c1"))) as { ok: boolean; erro: string; proximo_passo: string };
    expect(r).toMatchObject({ ok: false });
    expect(r.erro).toContain("vencida");
    expect(r.proximo_passo).toContain("crm_notificar_equipe");
    expect(texto).not.toHaveBeenCalled();
  });
  it("se nada saiu ao cliente, não diz que enviou", async () => {
    texto.mockResolvedValue(false); pdf.mockResolvedValue(false);
    const r = (await crmEnviarCobranca.handler({}, ctx("c1"))) as { ok: boolean };
    expect(r.ok).toBe(false);
  });
  it("manda junto o CPF que o cliente já informou na conversa", async () => {
    gravados.mockResolvedValue({ cpf: "529.982.247-25" });
    await crmEnviarCobranca.handler({}, ctx("c1"));
    expect(pedir).toHaveBeenCalledWith("alfa", { telefone: "5513974045973", cpf: "52998224725" });
  });
  it("sem CPF no cadastro: devolve `falta_cpf` e manda pedir o CPF, gravar e tentar de novo (sem avisar a equipe ainda)", async () => {
    pedir.mockRejectedValue(new ErroContratoSales("Cadastre o CPF ou CNPJ de Eduardo Freitas (o Asaas exige para emitir a cobrança).", 422));
    const r = (await crmEnviarCobranca.handler({}, ctx("c1"))) as { ok: boolean; falta_cpf?: boolean; proximo_passo: string };
    expect(r).toMatchObject({ ok: false, falta_cpf: true });
    expect(r.proximo_passo).toContain("crm_registrar_dados_do_cliente");
    expect(r.proximo_passo).toContain("de novo");
  });
  it("CPF de outro cadastro NÃO vira pedido de CPF ao cliente: vai para a equipe", async () => {
    pedir.mockRejectedValue(new ErroContratoSales("Esse CPF/CNPJ já está em outro cadastro: a equipe precisa conferir antes de gerar a cobrança.", 409));
    const r = (await crmEnviarCobranca.handler({}, ctx("c1"))) as { falta_cpf?: boolean; proximo_passo: string };
    expect(r.falta_cpf).toBeUndefined();
    expect(r.proximo_passo).toContain("crm_notificar_equipe");
  });
  it("tudo pronto de primeira: nada fica para segundo plano", async () => {
    const r = (await crmEnviarCobranca.handler({}, ctx("c1"))) as { pdf_e_pix_a_caminho: boolean; proximo_passo: string };
    expect(r.pdf_e_pix_a_caminho).toBe(false);
    expect(segundoPlano).not.toHaveBeenCalled();
  });
  it("faltou o PDF e o PIX: o link e a linha saem NA HORA e o resto segue em segundo plano, com o último motivo conhecido", async () => {
    pedir.mockResolvedValue({ ...cobranca, pix: "", boleto_pdf_base64: null, boleto_pdf_nome: null, boleto_pdf_motivo: "o Asaas demorou para liberar o boleto em PDF", pix_motivo: "sem resposta em 8 s" });
    const r = (await crmEnviarCobranca.handler({}, ctx("c1"))) as { ok: boolean; pdf_enviado: boolean; pix_enviado: boolean; pdf_e_pix_a_caminho: boolean; proximo_passo: string };
    expect(r).toMatchObject({ ok: true, pdf_enviado: false, pix_enviado: false, pdf_e_pix_a_caminho: true });
    expect(texto).toHaveBeenCalledTimes(1);
    expect(texto.mock.calls[0]![2]).toContain("https://asaas.com/i/1");
    expect(pdf).not.toHaveBeenCalled();
    expect(r.proximo_passo).toContain("seguem SOZINHOS");
    expect(r.proximo_passo).toContain("NÃO chame esta ferramenta de novo");
    expect(segundoPlano).toHaveBeenCalledWith(expect.objectContaining({
      orgId: "org-1", contato: "c1", conversationId: "conv-1", slug: "alfa", telefone: "5513974045973", lancamentoId: 5,
      jaEnviou: { pix: false, pdf: false },
      motivos: { pix: "sem resposta em 8 s", pdf: "o Asaas demorou para liberar o boleto em PDF" },
    }));
  });
  it("só faltou o PDF: o PIX já saiu e o segundo plano cuida apenas do PDF", async () => {
    pedir.mockResolvedValue({ ...cobranca, boleto_pdf_base64: null, boleto_pdf_nome: null, boleto_pdf_motivo: "o Asaas respondeu HTTP 403 ao baixar o boleto (sandbox.asaas.com)" });
    await crmEnviarCobranca.handler({}, ctx("c1"));
    expect(texto).toHaveBeenCalledTimes(2);
    expect(segundoPlano).toHaveBeenCalledWith(expect.objectContaining({ jaEnviou: { pix: true, pdf: false } }));
  });
});
