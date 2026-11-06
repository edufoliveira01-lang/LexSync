import { describe, expect, it } from "vitest";

import { textoDoEvento, MARCA_DE_EVENTO } from "@/lib/inbox/evento-na-conversa-marca";
import { embutirEscolha, escolhaEfetiva, lerEscolhaEmbutida, limparEscolha, padraoDaEmpresa, resumoDoQueFoiFeito } from "@/lib/sales/apos-assinatura";
import { sugerirDados } from "@/lib/sales/sugerir-dados";

const FUNIL = "11111111-1111-4111-8111-111111111111", ETAPA = "22222222-2222-4222-8222-222222222222";

describe("depois da assinatura — escolha do escritório e do contrato", () => {
  it("a etapa só vale com o funil; lixo vira nada", () => {
    expect(limparEscolha({ stage_id: ETAPA })).toEqual({});
    expect(limparEscolha({ pipeline_id: FUNIL, stage_id: ETAPA, tag: " ok ", fechar_conversa: true })).toEqual({ pipeline_id: FUNIL, stage_id: ETAPA, tag: "ok", fechar_conversa: true });
    expect(limparEscolha("qualquer coisa")).toEqual({});
  });
  it("a escolha do contrato vale por cima do padrão, campo a campo", () => {
    const padrao = { pipeline_id: FUNIL, stage_id: ETAPA, tag: "Cliente" };
    expect(escolhaEfetiva(padrao, null)).toEqual(padrao);
    expect(escolhaEfetiva(padrao, { tag: "Outra", fechar_conversa: true })).toEqual({ pipeline_id: FUNIL, stage_id: ETAPA, tag: "Outra", fechar_conversa: true });
  });
  it("viaja escondida na linha da conversa e não aparece na tela", () => {
    const escolha = { pipeline_id: FUNIL, stage_id: ETAPA, fechar_conversa: true };
    const corpo = `${MARCA_DE_EVENTO}Contrato enviado para assinatura — Ana · nº 3${embutirEscolha("", escolha)}`;
    expect(lerEscolhaEmbutida(corpo)).toEqual(escolha);
    expect(textoDoEvento(corpo)).toBe("Contrato enviado para assinatura — Ana · nº 3");
    expect(lerEscolhaEmbutida(`${MARCA_DE_EVENTO}Contrato enviado — Ana · nº 4`)).toBeNull();
  });
  it("o padrão da empresa vem de settings.sales.apos_assinatura", () => {
    expect(padraoDaEmpresa({ sales: { apos_assinatura: { tag: "X" } } })).toEqual({ tag: "X" });
    expect(padraoDaEmpresa(null)).toEqual({});
  });
  it("o resumo diz o que foi feito e o que não deu", () => {
    expect(resumoDoQueFoiFeito({ moveu: "Contrato assinado", semNegocio: false, tag: "Cliente", fechou: true })).toBe('negócio movido para "Contrato assinado" · etiqueta "Cliente" adicionada · conversa fechada');
    expect(resumoDoQueFoiFeito({ moveu: null, semNegocio: true, tag: null, fechou: false })).toBe("sem negócio aberto para mover");
    expect(resumoDoQueFoiFeito({ moveu: null, semNegocio: false, tag: null, fechou: false })).toBe("");
  });
});

describe("formulário do contrato — sugestões a partir do contato", () => {
  it("reconhece os campos pelo nome, sem acento nem caixa", () => {
    const s = sugerirDados({
      contato: { display_name: "Maria", phone_number: "5513999", email: "m@x.com" },
      campos: [
        { rotulo: "CPF", valor: "529.982.247-25" }, { rotulo: "Endereço", valor: "Rua A" }, { rotulo: "Número", valor: "10" }, { rotulo: "Bairro", valor: "Centro" },
        { rotulo: "CEP", valor: "11010-000" }, { rotulo: "Cidade", valor: "Santos" }, { rotulo: "Estado", valor: "sp" }, { rotulo: "Profissão", valor: "costureira" },
        { rotulo: "Sexo", valor: "Feminino" }, { rotulo: "Outro campo", valor: "ignorado" },
      ],
    });
    expect(s).toMatchObject({ nome: "Maria", telefone: "5513999", email: "m@x.com", cpf: "529.982.247-25", logradouro: "Rua A", numero: "10", bairro: "Centro", cep: "11010-000", cidade: "Santos", uf: "SP", profissao: "costureira", sexo: "F" });
    expect(Object.keys(s)).not.toContain("outro_campo");
  });
  it("com o mesmo campo em dois negócios, o primeiro (mais recente) vence", () => {
    expect(sugerirDados({ contato: {}, campos: [{ rotulo: "CPF", valor: "1" }, { rotulo: "CPF", valor: "2" }] }).cpf).toBe("1");
  });
});
