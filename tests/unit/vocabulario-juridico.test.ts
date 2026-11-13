import { describe, expect, it } from "vitest";
import { vocabularioJuridico as v } from "@/lib/i18n/vocabulario-juridico";

describe("vocabulário de escritório de advocacia", () => {
  it("troca as frases do menu e dos hubs inteiras", () => {
    expect(v("Produtos")).toBe("Serviços");
    expect(v("Comandas")).toBe("Lançamentos");
    expect(v("Meta de vendas")).toBe("Meta de contratações");
    expect(v("O dia a dia da venda")).toBe("O dia a dia da captação");
    expect(v("Seus funis de venda — clique em um para abrir o quadro de clientes.")).toContain("funis de captação");
  });
  it("palavras soltas, com o gênero certo", () => {
    expect(v("A venda fechou sem valor")).toBe("A contratação fechou sem valor");
    expect(v("Nenhum negócio nesta página.")).toBe("Nenhum caso nesta página.");
    expect(v("Sem negócios.")).toBe("Sem casos.");
    expect(v("Você é um assistente da loja.")).toBe("Você é um assistente do escritório.");
    expect(v("Abrir comanda ao ganhar")).toBe("Abrir lançamento ao ganhar");
    expect(v("Sem vendedor dono")).toBe("Sem responsável dono");
    expect(v("responder sobre o seu negócio")).toBe("responder sobre o seu escritório");
  });
  it("lead, card e custom fields", () => {
    expect(v("cada envio vira um lead aqui dentro")).toBe("cada envio vira um contato aqui dentro");
    expect(v("leva o card em cada passo, custom fields")).toBe("leva o cartão em cada passo, campos personalizados");
  });
  it("jargão técnico vira português do escritório", () => {
    expect(v("Gestão de membros, roles e atendimento do tenant.")).toBe("Gestão de membros, papéis e atendimento do escritório.");
  });
  it("não mexe no que não é do comércio", () => {
    expect(v("Preço por 1 milhão de tokens")).toBe("Preço por 1 milhão de tokens");
    expect(v("Contatos")).toBe("Contatos");
    expect(v("Agenda")).toBe("Agenda");
  });
});
