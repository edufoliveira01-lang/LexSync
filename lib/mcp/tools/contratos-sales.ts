/**
 * Fork Sales — MCP write tool `crm_enviar_contrato`: o agente envia ao cliente, para assinatura, o contrato do escritório.
 *
 * O contrato é montado e enviado pelo Sales (kit de documentos do escritório + ZapSign): o agente só entrega os dados que o CLIENTE confirmou na
 * conversa. O alvo é SEMPRE o contato do turno (`ctx.contatoDoTurno`, nunca um argumento do modelo), a conversa é a mais recente dele, e um segundo
 * contrato não é gerado enquanto houver um aguardando assinatura. O link volta no resultado, para o agente mandá-lo na resposta.
 */
import { z } from "zod";

import { enviarTexto } from "@/lib/sales/acompanhar-contratos";
import { contratoPendenteDaConversa, criarContratoNaConversa, slugDaOrg } from "@/lib/sales/contrato-na-conversa";
import { ErroContratoSales } from "@/lib/sales/contratos";
import type { McpToolDefinition } from "../types";

const pessoa = z.object({
  nome: z.string().min(3).max(120), nacionalidade: z.string().max(40).optional(), estado_civil: z.string().max(40).optional(),
  profissao: z.string().max(100).optional(), rg: z.string().max(30).optional(), cpf: z.string().max(25).optional(),
  endereco: z.string().max(250).optional(), qualidade: z.string().max(60).optional().describe("Relação com o cliente (mãe, pai, tutor…)."),
});

const inputShape = {
  confirmou_com_o_cliente: z.literal(true).describe("SÓ envie true se o cliente CONFIRMOU os dados (repetidos para ele) e disse que quer receber o contrato agora."),
  nome: z.string().min(3).max(200).describe("Nome completo do CLIENTE."),
  cpf: z.string().min(11).max(20),
  rg: z.string().max(30).optional(),
  nacionalidade: z.string().max(40).optional(),
  sexo: z.enum(["M", "F"]).optional(),
  estado_civil: z.string().max(40).optional(),
  profissao: z.string().max(100).optional(),
  logradouro: z.string().min(2).max(200).describe("Rua/avenida do cliente."),
  numero: z.string().max(20).optional(),
  complemento: z.string().max(100).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  uf: z.string().max(2).optional(),
  cep: z.string().max(12).optional(),
  email: z.string().max(254).optional().describe("E-mail do cliente: o contrato também vai por e-mail."),
  variante: z.enum(["comum", "representado", "rogo"]).optional().describe("comum (padrão): o cliente assina. representado: assina o responsável (menor/incapaz). rogo: outra pessoa assina a pedido do cliente."),
  representante: pessoa.optional().describe("Obrigatório quando variante=representado: quem assina pelo cliente."),
  a_rogo: pessoa.optional().describe("Obrigatório quando variante=rogo: quem assina a pedido do cliente."),
};

export const crmEnviarContrato: McpToolDefinition<typeof inputShape> = {
  name: "crm_enviar_contrato",
  description:
    "Gera os documentos do escritório (procuração, declarações, contrato) com os dados do cliente e envia o link de ASSINATURA. Use SÓ depois de o cliente confirmar os dados e querer o contrato. " +
    "O sistema manda o link ao cliente no WhatsApp (`link_enviado_ao_cliente`: NÃO reenvie); só se falhar devolve `mensagem_para_enviar`, para você enviar como veio. Se já houver contrato aguardando assinatura, devolve `ja_enviado` e NÃO gera outro. " +
    "Em caso de erro, diga que a equipe vai enviar o contrato e passe a conversa a um atendente.",
  inputSchema: inputShape,
  category: "write",
  requiresRole: "ai_operator", // só o agente (token efêmero do turno) envia contrato; a pessoa usa o botão "Gerar contrato"
  requiresScope: "mcp:write",
  handler: async (input, ctx) => {
    const contato = ctx.contatoDoTurno;
    if (!contato) return { ok: false, erro: "Não há contato nesta conversa para enviar o contrato.", proximo_passo: "Passe a conversa a um atendente." };
    const { data: conv } = await ctx.supabase.from("conversations").select("id").eq("organization_id", ctx.organizationId).eq("contact_id", contato).order("last_inbound_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
    const conversationId = (conv as { id: string } | null)?.id;
    if (!conversationId) return { ok: false, erro: "Conversa do contato não encontrada.", proximo_passo: "Passe a conversa a um atendente." };

    const pendente = await contratoPendenteDaConversa(ctx.organizationId, conversationId);
    if (pendente) return { ok: true, ja_enviado: true, contrato_id: pendente.numero, proximo_passo: "O contrato já foi enviado e aguarda assinatura. Não gere outro: diga ao cliente para abrir o link que recebeu e, se não achar, que a equipe reenvia." };

    const slug = await slugDaOrg(ctx.organizationId);
    if (!slug) return { ok: false, erro: "Esta empresa não está ligada ao Sales.", proximo_passo: "Passe a conversa a um atendente." };
    const { confirmou_com_o_cliente: _c, ...dados } = input;
    try {
      const { contrato, mensagem } = await criarContratoNaConversa({ orgId: ctx.organizationId, conversationId, slug, userId: null, nomeDeQuemPediu: "Assistente virtual", dados });
      // O link NÃO depende de o modelo lembrar de mandá-lo: o sistema envia a mensagem na hora, pelo mesmo caminho do atendimento.
      // Só se o envio falhar a mensagem volta para o agente mandar (como antes).
      const enviado = await enviarTexto(ctx.organizationId, conversationId, mensagem);
      if (enviado) {
        return {
          ok: true, contrato_id: contrato.id, email_enviado: contrato.email_enviado, link_enviado_ao_cliente: true,
          proximo_passo: "O sistema JÁ enviou ao cliente, no WhatsApp, a mensagem com o link de assinatura. NÃO envie o link de novo. Em UMA mensagem curta, avise que a assinatura é pelo celular e leva poucos minutos, e que você acompanha. Não mova o negócio de etapa: o sistema já fez.",
        };
      }
      return {
        ok: true, contrato_id: contrato.id, email_enviado: contrato.email_enviado, mensagem_para_enviar: mensagem,
        proximo_passo: "O contrato foi criado, mas o envio automático falhou. Envie `mensagem_para_enviar` ao cliente com send_message, sem alterar o link. Depois avise que a assinatura é pelo celular e leva poucos minutos.",
      };
    } catch (e) {
      if (e instanceof ErroContratoSales) return { ok: false, erro: e.message, proximo_passo: "Se o erro for de dado faltando, peça só o que faltou ao cliente. Caso contrário, diga que a equipe enviará o contrato e passe a conversa a um atendente." };
      throw e;
    }
  },
};
