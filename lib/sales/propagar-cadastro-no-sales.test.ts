import { beforeEach, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => ({ ligado: true, buscar: vi.fn(), atualizar: vi.fn(), anotar: vi.fn(), slug: "escritorio" as string | null }));
vi.mock("@/lib/sales/contratos", () => ({
  configDosContratos: () => (cfg.ligado ? { url: "https://painel", segredo: "x".repeat(32) } : null),
  buscarClienteParaAnotar: (...a: unknown[]) => cfg.buscar(...a),
  atualizarCadastroNoSales: (...a: unknown[]) => cfg.atualizar(...a),
  anotarNoSales: (...a: unknown[]) => cfg.anotar(...a),
}));
vi.mock("@/lib/sales/contrato-na-conversa", () => ({ slugDaOrg: async () => cfg.slug }));

import { propagarCadastroParaOSales } from "./propagar-cadastro-no-sales";

const base = { organizationId: "org", telefone: "5513999991111" };
const cliente = (extra: Record<string, unknown> = {}) => ({ encontrado: true, pessoa: { id: 7, nome: "Maria Souza" }, processos: [], recentes: [], ...extra });

describe("o dado do cliente chega também ao Sales", () => {
  beforeEach(() => {
    cfg.ligado = true; cfg.slug = "escritorio";
    cfg.buscar.mockReset().mockResolvedValue(cliente());
    cfg.atualizar.mockReset().mockResolvedValue({ ok: true, pessoa_id: 7, alterados: ["logradouro"], iguais: [], ignorados: [] });
    cfg.anotar.mockReset().mockResolvedValue({ ok: true, destino: "cadastro" });
  });

  it("endereço de quem já é cliente: o Sales atualiza (sem pedido para a equipe)", async () => {
    const r = await propagarCadastroParaOSales({ ...base, novos: { logradouro: "Rua Nova" } });
    expect(cfg.atualizar).toHaveBeenCalledWith("escritorio", { pessoa_id: 7, campos: { logradouro: "Rua Nova" }, autor_nome: "Assistente virtual" }, expect.anything());
    expect(r).toEqual({ situacao: "atualizado", atualizados: ["logradouro"], pedido_registrado: [] });
    expect(cfg.anotar).not.toHaveBeenCalled();
  });

  it("CPF, RG, nome diferente, data de nascimento: NÃO vão ao cadastro; viram pedido anotado para a equipe", async () => {
    const r = await propagarCadastroParaOSales({ ...base, novos: { cpf: "111.222.333-44", rg: "12.345", nome: "Outra Pessoa" } });
    expect(cfg.atualizar).not.toHaveBeenCalled();
    expect(cfg.anotar).toHaveBeenCalledTimes(1);
    const texto = (cfg.anotar.mock.calls[0] as unknown as [string, { texto: string; pessoa_id: number }])[1].texto;
    expect(texto).toContain("CPF: 111.222.333-44");
    expect(texto).toContain("nome: Outra Pessoa");
    expect(texto).toContain("Aguarda a confirmação da identidade");
    expect(r.situacao).toBe("pedido_registrado");
    expect(r.pedido_registrado.sort()).toEqual(["CPF", "RG", "nome"]);
  });

  it("o primeiro nome do mesmo cliente não é pedido de troca de nome", async () => {
    const r = await propagarCadastroParaOSales({ ...base, novos: { nome: "Maria" } });
    expect(r.situacao).toBe("nada_a_fazer");
    expect(cfg.anotar).not.toHaveBeenCalled();
  });

  it("misto: o que é direto é atualizado e o que é identidade vira pedido", async () => {
    const r = await propagarCadastroParaOSales({ ...base, novos: { email: "a@b.com", cpf: "999" } });
    expect(cfg.atualizar).toHaveBeenCalledWith("escritorio", expect.objectContaining({ campos: { email: "a@b.com" } }), expect.anything());
    expect(r.situacao).toBe("atualizado_e_pedido_registrado");
  });

  it("não repete o pedido que já está nas anotações recentes", async () => {
    cfg.buscar.mockResolvedValue(cliente({ recentes: [{ autor: "x", texto: "Pedido do cliente pelo atendimento virtual: alterar CPF: 999. Aguarda…", criado_em: "", onde: "Cadastro" }] }));
    const r = await propagarCadastroParaOSales({ ...base, novos: { cpf: "999" } });
    expect(cfg.anotar).not.toHaveBeenCalled();
    expect(r.situacao).toBe("nada_a_fazer");
  });

  it("valor que o Sales recusou volta como pedido para a equipe, não some", async () => {
    cfg.atualizar.mockResolvedValue({ ok: true, pessoa_id: 7, alterados: [], iguais: [], ignorados: ["email"] });
    const r = await propagarCadastroParaOSales({ ...base, novos: { email: "sem-arroba" } });
    expect(cfg.anotar).toHaveBeenCalledTimes(1);
    expect(r.situacao).toBe("pedido_registrado");
  });

  it("Sales sem a rota nova (ou fora do ar): a equipe recebe o pedido inteiro como anotação", async () => {
    cfg.atualizar.mockRejectedValue(new Error("404"));
    const r = await propagarCadastroParaOSales({ ...base, novos: { logradouro: "Rua Nova", cidade: "Santos" } });
    const texto = (cfg.anotar.mock.calls[0] as unknown as [string, { texto: string }])[1].texto;
    expect(texto).toContain("rua: Rua Nova");
    expect(texto).toContain("cidade: Santos");
    expect(r.situacao).toBe("pedido_registrado");
  });

  it("lead novo (telefone fora do cadastro do Sales): nada acontece lá", async () => {
    cfg.buscar.mockResolvedValue({ encontrado: false });
    const r = await propagarCadastroParaOSales({ ...base, novos: { nome: "Eduardo", logradouro: "Rua X" } });
    expect(r.situacao).toBe("nao_e_cliente");
    expect(cfg.atualizar).not.toHaveBeenCalled();
    expect(cfg.anotar).not.toHaveBeenCalled();
  });

  it("integração não ligada, escritório sem slug, sem telefone ou sem dado: não chama o Sales", async () => {
    cfg.ligado = false;
    expect((await propagarCadastroParaOSales({ ...base, novos: { email: "a@b.com" } })).situacao).toBe("indisponivel");
    cfg.ligado = true; cfg.slug = null;
    expect((await propagarCadastroParaOSales({ ...base, novos: { email: "a@b.com" } })).situacao).toBe("indisponivel");
    cfg.slug = "escritorio";
    expect((await propagarCadastroParaOSales({ ...base, telefone: null, novos: { email: "a@b.com" } })).situacao).toBe("nada_a_fazer");
    expect((await propagarCadastroParaOSales({ ...base, novos: { email: "  " } })).situacao).toBe("nada_a_fazer");
    expect(cfg.buscar).not.toHaveBeenCalled();
  });

  it("erro inesperado ao buscar o cliente: indisponível, sem lançar", async () => {
    cfg.buscar.mockRejectedValue(new Error("rede"));
    await expect(propagarCadastroParaOSales({ ...base, novos: { email: "a@b.com" } })).resolves.toMatchObject({ situacao: "indisponivel" });
  });
});
