import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErroContratoSales } from "@/lib/sales/contratos";

const criar = vi.fn();
const pendente = vi.fn();
const enviar = vi.fn();
const gravados = vi.fn();
const gravar = vi.fn();
vi.mock("@/lib/sales/dados-do-cliente", async (original) => ({ ...(await original<typeof import("@/lib/sales/dados-do-cliente")>()), lerDadosGravados: (...a: unknown[]) => gravados(...a), gravarDadosDoCliente: (...a: unknown[]) => gravar(...a) }));
vi.mock("@/lib/sales/acompanhar-contratos", () => ({ enviarTexto: (...a: unknown[]) => enviar(...a) }));
vi.mock("@/lib/sales/contrato-na-conversa", () => ({
  criarContratoNaConversa: (...a: unknown[]) => criar(...a),
  contratoPendenteDaConversa: (...a: unknown[]) => pendente(...a),
  slugDaOrg: async () => "alfa",
}));

import { crmEnviarContrato, crmRegistrarDadosDoCliente } from "@/lib/mcp/tools/contratos-sales";
import { ALVO_DE_FUNIL, podeChamarFerramenta } from "@/lib/leads/escopo-de-funil";

const dados = { confirmou_com_o_cliente: true as const, nome: "Ana Maria Souza", cpf: "52998224725", logradouro: "Rua das Flores" };
const ctx = (contatoDoTurno?: string, conversa: string | null = "conv-1") => ({
  organizationId: "org-1", contatoDoTurno,
  supabase: { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: conversa ? { id: conversa } : null }) }) }) }) }) }) }) },
}) as never;

describe("crm_enviar_contrato — o agente envia o contrato do escritório", () => {
  beforeEach(() => { criar.mockReset(); pendente.mockReset(); pendente.mockResolvedValue(null); enviar.mockReset(); enviar.mockResolvedValue(true); gravados.mockReset(); gravados.mockResolvedValue({}); gravar.mockReset(); });

  it("é uma escrita do AGENTE (ai_operator), sem nenhum id no esquema: o alvo é sempre o contato do turno", () => {
    expect(crmEnviarContrato.category).toBe("write");
    expect(crmEnviarContrato.requiresRole).toBe("ai_operator");
    expect(Object.keys(crmEnviarContrato.inputSchema).join(",")).not.toMatch(/contact|conversation|lead_id|org/);
  });
  it("só envia com a confirmação do cliente declarada", () => {
    expect(crmEnviarContrato.inputSchema.confirmou_com_o_cliente.safeParse(false).success).toBe(false);
    expect(crmEnviarContrato.inputSchema.confirmou_com_o_cliente.safeParse(true).success).toBe(true);
  });
  it("sem contato no turno não envia nada", async () => {
    const r = (await crmEnviarContrato.handler(dados, ctx(undefined))) as { ok: boolean };
    expect(r.ok).toBe(false);
    expect(criar).not.toHaveBeenCalled();
  });
  it("com contrato já aguardando assinatura, NÃO gera outro", async () => {
    pendente.mockResolvedValue({ numero: 7 });
    const r = (await crmEnviarContrato.handler(dados, ctx("c1"))) as { ja_enviado?: boolean; contrato_id: number };
    expect(r).toMatchObject({ ja_enviado: true, contrato_id: 7 });
    expect(criar).not.toHaveBeenCalled();
  });
  it("gera o contrato e o SISTEMA manda o link ao cliente (não depende de o modelo chamar send_message)", async () => {
    criar.mockResolvedValue({ contrato: { id: 9, email_enviado: true }, mensagem: "Olá, Ana! ... https://app.zapsign.com.br/verificar/x" });
    const r = (await crmEnviarContrato.handler(dados, ctx("c1"))) as { ok: boolean; link_enviado_ao_cliente?: boolean; mensagem_para_enviar?: string; contrato_id: number; proximo_passo: string };
    expect(r).toMatchObject({ ok: true, contrato_id: 9, link_enviado_ao_cliente: true });
    expect(r.mensagem_para_enviar).toBeUndefined();
    expect(r.proximo_passo).toContain("NÃO envie o link de novo");
    expect(enviar).toHaveBeenCalledWith("org-1", "conv-1", expect.stringContaining("zapsign"));
    const chamada = criar.mock.calls[0]![0] as { userId: unknown; nomeDeQuemPediu: string; conversationId: string; dados: Record<string, unknown> };
    expect(chamada).toMatchObject({ userId: null, nomeDeQuemPediu: "Assistente virtual", conversationId: "conv-1" });
    expect(chamada.dados).not.toHaveProperty("confirmou_com_o_cliente");
  });
  it("se o envio automático falhar, a mensagem volta para o agente mandar (o contrato já existe)", async () => {
    enviar.mockResolvedValue(false);
    criar.mockResolvedValue({ contrato: { id: 9, email_enviado: true }, mensagem: "Olá! https://app.zapsign.com.br/verificar/x" });
    const r = (await crmEnviarContrato.handler(dados, ctx("c1"))) as { ok: boolean; link_enviado_ao_cliente?: boolean; mensagem_para_enviar?: string };
    expect(r).toMatchObject({ ok: true });
    expect(r.link_enviado_ao_cliente).toBeUndefined();
    expect(r.mensagem_para_enviar).toContain("zapsign");
  });
  it("erro do Sales volta como texto para o agente (falta de dado ou passar para a equipe), sem estourar o turno", async () => {
    criar.mockRejectedValue(new ErroContratoSales("Informe o endereço do cliente.", 422));
    const r = (await crmEnviarContrato.handler(dados, ctx("c1"))) as { ok: boolean; erro: string; proximo_passo: string };
    expect(r).toMatchObject({ ok: false, erro: "Informe o endereço do cliente." });
    expect(r.proximo_passo).toContain("atendente");
  });
  it("está classificada no escopo de funil: sem isso o motor RECUSA a ferramenta em silêncio (regra de vacuidade) e o agente promete um contrato que não sai", async () => {
    expect(ALVO_DE_FUNIL.crm_enviar_contrato).toBe("sem_funil");
    const v = await podeChamarFerramenta({
      ferramenta: "crm_enviar_contrato", argumentos: dados, escopo: ["funil-juridico"], ehEscrita: true,
      resolvePipelineDoLead: async () => null, resolveLeadDoContato: async () => ({ kind: "nenhum" }) as never,
    } as never);
    expect(v).toMatchObject({ permitido: true });
  });
  it("o contrato sai dos dados JÁ GRAVADOS: o agente só confirma, sem repassar tudo", async () => {
    gravados.mockResolvedValue({ nome: "Ana Maria Souza", cpf: "52998224725", logradouro: "Rua das Flores", cidade: "Santos" });
    criar.mockResolvedValue({ contrato: { id: 11, email_enviado: false }, mensagem: "Olá! https://app.zapsign.com.br/verificar/y" });
    const r = (await crmEnviarContrato.handler({ confirmou_com_o_cliente: true as const }, ctx("c1"))) as { ok: boolean };
    expect(r.ok).toBe(true);
    expect(criar.mock.calls[0]![0].dados).toMatchObject({ nome: "Ana Maria Souza", cpf: "52998224725", logradouro: "Rua das Flores", cidade: "Santos" });
  });
  it("o que veio na chamada vale por cima do gravado", async () => {
    gravados.mockResolvedValue({ nome: "Ana Maria Souza", cpf: "52998224725", logradouro: "Rua A" });
    criar.mockResolvedValue({ contrato: { id: 12, email_enviado: false }, mensagem: "x https://zapsign" });
    await crmEnviarContrato.handler({ confirmou_com_o_cliente: true as const, logradouro: "Rua B" }, ctx("c1"));
    expect(criar.mock.calls[0]![0].dados.logradouro).toBe("Rua B");
  });
  it("sem o nome completo (só o primeiro) ou sem CPF/endereço, NÃO gera o contrato e diz o que perguntar", async () => {
    gravados.mockResolvedValue({ nome: "Ana", cpf: "529" });
    const r = (await crmEnviarContrato.handler({ confirmou_com_o_cliente: true as const }, ctx("c1"))) as { ok: boolean; erro: string };
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/nome completo/);
    expect(r.erro).toMatch(/CPF/);
    expect(r.erro).toMatch(/endereço/);
    expect(criar).not.toHaveBeenCalled();
  });
  it("crm_registrar_dados_do_cliente: é escrita do agente, sem id no esquema, e grava só o que o cliente informou", async () => {
    expect(crmRegistrarDadosDoCliente.category).toBe("write");
    expect(crmRegistrarDadosDoCliente.requiresRole).toBe("ai_operator");
    expect(Object.keys(crmRegistrarDadosDoCliente.inputSchema).join(",")).not.toMatch(/contact|conversation|lead_id|org/);
    gravar.mockResolvedValue({ nome: "Ana", cpf: "52998224725" });
    const r = (await crmRegistrarDadosDoCliente.handler({ cpf: "52998224725" }, ctx("c1"))) as { ok: boolean; falta_obrigatorios_para_o_contrato: string[] };
    expect(gravar).toHaveBeenCalledWith("org-1", "c1", { cpf: "52998224725" });
    expect(r.ok).toBe(true);
    expect(r.falta_obrigatorios_para_o_contrato.join(" ")).toMatch(/nome completo/);
  });
  it("sem campos, só consulta o que já está gravado (para não perguntar de novo)", async () => {
    gravados.mockResolvedValue({ nome: "Ana Maria Souza" });
    await crmRegistrarDadosDoCliente.handler({}, ctx("c1"));
    expect(gravar).not.toHaveBeenCalled();
    expect(gravados).toHaveBeenCalled();
  });
  it("sem contato no turno, não grava nada", async () => {
    const r = (await crmRegistrarDadosDoCliente.handler({ cpf: "1" }, ctx(undefined))) as { ok: boolean };
    expect(r.ok).toBe(false);
    expect(gravar).not.toHaveBeenCalled();
  });
});
