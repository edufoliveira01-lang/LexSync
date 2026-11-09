/**
 * Fork Sales — MCP write tool `crm_enviar_contrato`: o agente envia ao cliente, para assinatura, o contrato do escritório.
 *
 * O contrato é montado e enviado pelo Sales (kit de documentos do escritório + ZapSign): o agente só entrega os dados que o CLIENTE confirmou na
 * conversa. O alvo é SEMPRE o contato do turno (`ctx.contatoDoTurno`, nunca um argumento do modelo), a conversa é a mais recente dele, e um segundo
 * contrato não é gerado enquanto houver um aguardando assinatura. O link volta no resultado, para o agente mandá-lo na resposta.
 */
import { z } from "zod";

import { acharFicha, temasDaBase } from "@/lib/sales/base-juridica/fichas";
import { calcularRendaPerCapita } from "@/lib/sales/base-juridica/valores";
import { enviarTexto } from "@/lib/sales/acompanhar-contratos";
import { contratoPendenteDaConversa, criarContratoNaConversa, slugDaOrg } from "@/lib/sales/contrato-na-conversa";
import { cpfMascarado, faltaParaOContrato, gravarDadosDoCliente, lerDadosGravados, type CampoDoCliente } from "@/lib/sales/dados-do-cliente";
import { ErroContratoSales, type DadosDoContrato } from "@/lib/sales/contratos";
import type { McpToolDefinition } from "../types";

const pessoa = z.object({
  nome: z.string().min(3).max(120), nacionalidade: z.string().max(40).optional(), estado_civil: z.string().max(40).optional(),
  profissao: z.string().max(100).optional(), rg: z.string().max(30).optional(), cpf: z.string().max(25).optional(),
  endereco: z.string().max(250).optional(), qualidade: z.string().max(60).optional().describe("Relação com o cliente (mãe, pai, tutor…)."),
});

const inputShape = {
  confirmou_com_o_cliente: z.literal(true).describe("SÓ envie true se o cliente CONFIRMOU os dados (repetidos para ele) e disse que quer receber o contrato agora."),
  nome: z.string().max(200).optional().describe("Nome completo do CLIENTE (se omitido, vale o gravado)."),
  cpf: z.string().max(20).optional(),
  rg: z.string().max(30).optional(),
  nacionalidade: z.string().max(40).optional(),
  sexo: z.enum(["M", "F"]).optional(),
  estado_civil: z.string().max(40).optional(),
  profissao: z.string().max(100).optional(),
  logradouro: z.string().max(200).optional().describe("Rua/avenida do cliente."),
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
    const { confirmou_com_o_cliente: _c, ...informados } = input;
    // o contrato sai do que JÁ está gravado (crm_registrar_dados_do_cliente); o que veio nesta chamada vale por cima
    const gravados = await lerDadosGravados(ctx.organizationId, contato);
    const dados = { ...gravados, ...Object.fromEntries(Object.entries(informados).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")) } as unknown as DadosDoContrato & { nome: string };
    const falta = faltaParaOContrato(dados);
    if (falta.obrigatorios.length > 0) return { ok: false, erro: `Faltam dados obrigatórios: ${falta.obrigatorios.join(", ")}.`, proximo_passo: "Pergunte ao cliente SÓ o que falta, grave com crm_registrar_dados_do_cliente, confirme e chame de novo." };
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

const dadosShape = {
  nome: z.string().max(200).optional().describe("Nome do cliente (no começo o primeiro nome basta; o contrato exige nome e sobrenome)."),
  email: z.string().max(254).optional(), data_nascimento: z.string().max(20).optional(), nome_da_mae: z.string().max(120).optional(),
  cpf: z.string().max(20).optional(), rg: z.string().max(30).optional(),
  nacionalidade: z.string().max(40).optional(), sexo: z.enum(["M", "F"]).optional(), estado_civil: z.string().max(40).optional(), profissao: z.string().max(100).optional(),
  cep: z.string().max(12).optional().describe("Com o CEP, rua, bairro, cidade e UF vêm sozinhos: pergunte só CEP e número."), logradouro: z.string().max(200).optional().describe("Rua/avenida."), numero: z.string().max(20).optional(),
  complemento: z.string().max(100).optional(), bairro: z.string().max(100).optional(), cidade: z.string().max(100).optional(), uf: z.string().max(2).optional(),
};

export const crmRegistrarDadosDoCliente: McpToolDefinition<typeof dadosShape> = {
  name: "crm_registrar_dados_do_cliente",
  description:
    "Grava no cadastro os dados que o cliente ACABOU de informar (só os campos informados) e devolve o que já está gravado e o que falta para o contrato. " +
    "Chame a cada dado novo, e sem campos para consultar antes de perguntar. Nunca pergunte de novo o que já está gravado.",
  inputSchema: dadosShape,
  category: "write",
  requiresRole: "ai_operator", // só o agente (token efêmero do turno); o alvo é sempre o contato do turno
  requiresScope: "mcp:write",
  handler: async (input, ctx) => {
    const contato = ctx.contatoDoTurno;
    if (!contato) return { ok: false, erro: "Não há contato nesta conversa para gravar dados.", proximo_passo: "Siga a conversa normalmente." };
    try {
      const novos = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Partial<Record<CampoDoCliente, string>>;
      const gravado = Object.keys(novos).length ? await gravarDadosDoCliente(ctx.organizationId, contato, novos) : await lerDadosGravados(ctx.organizationId, contato);
      const falta = faltaParaOContrato(gravado);
      return { ok: true, gravado, cpf_para_confirmar: cpfMascarado(gravado.cpf) || undefined, falta_obrigatorios_para_o_contrato: falta.obrigatorios, falta_recomendados: falta.recomendados, proximo_passo: "Não pergunte de novo o que já está em `gravado`. Pergunte só o que falta, uma coisa por vez." };
    } catch (e) {
      return { ok: false, erro: e instanceof Error ? e.message : "não consegui gravar agora", proximo_passo: "Siga a conversa e registre uma nota com o dado, para a equipe." };
    }
  },
};

const baseShape = { tema: z.string().min(2).max(120).describe("O assunto: bpc, loas, pensão por morte, auxílio por incapacidade…") };

/** Ficha curada do tema (requisitos, alegações do INSS, teses, prazos, fonte e data). O agente responde com base nela, não de memória. */
export const crmConsultarBaseJuridica: McpToolDefinition<typeof baseShape> = {
  name: "crm_consultar_base_juridica",
  description:
    "Consulta a ficha jurídica do tema (requisitos, alegações do INSS, teses, prazos, fonte e data). Use ANTES de responder dúvida de direito, prazo ou benefício; responda com base nela. " +
    "Se `cobertura: false`, a base não cobre: diga que o advogado confirma.",
  inputSchema: baseShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input) => {
    const r = acharFicha(input.tema);
    if (!r) return { ok: true, cobertura: false, temas_disponiveis: temasDaBase(), proximo_passo: "A base não cobre este tema: responda só com o que for geral e seguro e diga que o advogado confirma." };
    const { ficha, vencida } = r;
    return {
      ok: true, cobertura: true, ficha,
      aviso: [vencida ? "A ficha passou da validade de revisão: responda com ressalva e diga que o advogado confirma." : null, ficha.status === "pendente_revisao" ? "Ficha ainda sem a conferência de um advogado: use, e diga que o advogado confirma pelo caso." : null].filter(Boolean),
      proximo_passo: "Responda com segurança e em linguagem simples, com base na ficha; nunca prometa resultado; cite o prazo quando houver.",
    };
  },
};

const rendaShape = {
  renda_total_mensal: z.number().min(0).max(1_000_000).describe("Renda mensal total da família, em reais."),
  moradores: z.number().int().min(1).max(30).describe("Quantas pessoas moram na casa (a família para o cálculo)."),
  gastos_saude_mensais: z.number().min(0).max(1_000_000).optional().describe("Gastos mensais de saúde comprovados (terapias, remédios, fraldas…), se houver."),
};

/** Aritmética do critério de renda do BPC com o salário mínimo VIGENTE: o modelo não calcula nem lembra o valor. */
export const crmCalcularRendaPerCapita: McpToolDefinition<typeof rendaShape> = {
  name: "crm_calcular_renda_per_capita",
  description:
    "Calcula a renda por pessoa da família contra 1/4 e 1/2 do salário mínimo vigente (BPC). Use SEMPRE que for falar de renda; nunca calcule de cabeça nem cite o salário mínimo de memória.",
  inputSchema: rendaShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input) => {
    const r = calcularRendaPerCapita(input.renda_total_mensal, input.moradores, input.gastos_saude_mensais ?? 0);
    if (!r) return { ok: false, erro: "Não consegui calcular com esses números.", proximo_passo: "Diga que o advogado faz a conta com os números exatos." };
    return { ok: true, ...r, proximo_passo: "Explique o resultado em linguagem simples, sem prometer: diga a faixa e que o advogado confirma pelo caso." };
  },
};
