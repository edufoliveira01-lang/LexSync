/**
 * Fork Sales — capacidade de CONTRATO do agente. Arquivo próprio para não colidir com os domínios do original.
 * `rotulo`/`explicacao`/`oQueToca` falam com o humano que configura o agente; o texto do MODELO é a `description` do handler.
 */
import { declararTools } from "./tipos";

export const TOOLS_CONTRATOS_SALES = declararTools([
  {
    name: "crm_enviar_contrato",
    category: "write",
    rotulo: "Enviar o contrato para o cliente assinar",
    explicacao:
      "Quando o cliente confirma os dados e quer contratar, o agente gera a procuração, as declarações e o contrato do escritório e manda o link de assinatura pelo WhatsApp. Só envia um contrato por vez enquanto o anterior não for assinado.",
    oQueToca: "Contratos e assinaturas",
    risco: "critico",
    pacotes: ["vender"],
  },
  {
    name: "crm_registrar_dados_do_cliente",
    category: "write",
    rotulo: "Gravar os dados do cliente na conversa",
    explicacao:
      "A cada dado que o cliente informa (nome, CPF, RG, estado civil, profissão, e-mail, endereço), o agente grava no cadastro na hora e não pergunta de novo. Na hora do contrato, ele só confirma o que já está gravado.",
    oQueToca: "Cadastro do contato e campos do negócio",
    risco: "atencao",
    pacotes: ["vender"],
  },
]);
