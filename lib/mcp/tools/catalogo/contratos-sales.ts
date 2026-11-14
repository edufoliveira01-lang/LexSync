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
    name: "crm_salvar_documento_do_cliente",
    category: "write",
    rotulo: "Salvar os documentos do cliente no drive",
    explicacao:
      "Quando o cliente manda um documento pela conversa (CNIS, laudo, comprovante, RG…), o agente identifica o tipo e o sistema guarda no drive do escritório (Dropbox), na pasta do cliente, depois da assinatura do contrato. O agente só informa o tipo; quem cria a pasta e o nome do arquivo é o sistema. O que não for identificado vai para A CLASSIFICAR, e a equipe é avisada.",
    oQueToca: "Pasta do cliente no drive do escritório",
    risco: "atencao",
    pacotes: ["vender"],
  },
  {
    name: "crm_passar_para_agente",
    category: "write",
    rotulo: "Passar para outro agente",
    explicacao:
      "O Roteiro passa a conversa para outro agente publicado (por exemplo, o agente que atende quem já é cliente) e, se indicado, leva o card para o funil dele. O outro agente assume na próxima mensagem do cliente.",
    oQueToca: "Quem atende a conversa e o funil do card",
    risco: "atencao",
    pacotes: ["vender"],
  },
  {
    name: "crm_notificar_equipe",
    category: "write",
    rotulo: "Avisar a equipe por WhatsApp",
    explicacao:
      "O Roteiro chama uma notificação cadastrada na Central de notificações (por exemplo, quando o cliente é desqualificado) e a equipe recebe um aviso no WhatsApp, com o nome, o telefone, um resumo e o link da conversa. Quem recebe e o número que envia são configurados na Central.",
    oQueToca: "WhatsApp da equipe (pela conexão de avisos)",
    risco: "atencao",
    pacotes: ["vender"],
  },
  {
    name: "crm_enviar_cobranca",
    category: "write",
    rotulo: "Enviar boleto e PIX da parcela",
    explicacao:
      "Quando o cliente pede o boleto ou o PIX de uma parcela, o agente gera a cobrança no Asaas (pelo Sales) e o sistema envia ao cliente, no WhatsApp, o link de pagamento, o PIX copia e cola, a linha digitável e o PDF do boleto. Só da parcela em aberto do próprio cliente da conversa; parcela vencida fica para a equipe.",
    oQueToca: "Cobrança no Asaas e mensagens ao cliente",
    risco: "atencao",
    pacotes: ["atender"],
  },
  {
    name: "crm_anotar_no_sales",
    category: "write",
    rotulo: "Anotar no sistema do escritório (Sales)",
    explicacao:
      "O agente deixa uma anotação para a equipe no cadastro do cliente (ou num processo dele) no Sales, no nome do atendimento virtual: o que o cliente pediu ou informou e a equipe precisa saber. Só para quem já é cliente do escritório.",
    oQueToca: "Anotações do cliente no Sales",
    risco: "atencao",
    pacotes: ["atender"],
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
