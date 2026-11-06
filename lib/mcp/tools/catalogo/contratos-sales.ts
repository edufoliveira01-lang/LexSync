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
]);
