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
  {
    name: "crm_consultar_base_juridica",
    category: "read",
    rotulo: "Consultar a base jurídica",
    explicacao: "Antes de responder uma dúvida de direito, prazo ou benefício, o agente consulta a ficha do tema (requisitos, prazos, fonte e data) em vez de responder de memória.",
    oQueToca: "Nada é alterado: só leitura",
    risco: "seguro",
    pacotes: ["vender"],
  },
  {
    name: "crm_calcular_renda_per_capita",
    category: "read",
    rotulo: "Calcular a renda por pessoa (BPC)",
    explicacao: "Faz a conta da renda por pessoa da família contra 1/4 e 1/2 do salário mínimo vigente, para o agente não errar o número nem usar um salário mínimo antigo.",
    oQueToca: "Nada é alterado: só cálculo",
    risco: "seguro",
    pacotes: ["vender"],
  },
]);
