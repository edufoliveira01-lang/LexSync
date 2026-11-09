/**
 * Fork Sales — fichas do TRABALHISTA. Rascunhos redigidos a partir da lei, em `pendente_revisao`: a rotina de atualização os confere contra as fontes
 * oficiais (trecho literal) e o advogado revisa. Em dúvida, a ficha diz "o advogado confirma".
 */
import type { FichaJuridica } from "./fichas";

const CLT = { titulo: "CLT — Decreto-Lei nº 5.452/1943", url: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm" };
const L8213 = { titulo: "Lei nº 8.213/1991, art. 118 (estabilidade acidentária)", url: "https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm" };
const CF = { titulo: "Constituição Federal, art. 7º", url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm" };
const L8036 = { titulo: "Lei nº 8.036/1990 (FGTS)", url: "https://www.planalto.gov.br/ccivil_03/leis/l8036consol.htm" };

const base = { areas: ["trabalhista"] as const, revisado_em: "2026-11-09", validade_dias: 90, status: "pendente_revisao" as const };

export const FICHAS_TRABALHISTA: readonly FichaJuridica[] = [
  {
    ...base,
    tema: "trabalhista_rescisao_e_verbas",
    titulo: "Rescisão do contrato de trabalho e verbas rescisórias",
    palavras_chave: ["demitido", "demissão", "demissao", "rescisão", "rescisao", "verbas rescisórias", "verbas rescisorias", "aviso prévio", "aviso previo", "multa de 40", "fgts", "seguro-desemprego", "seguro desemprego", "justa causa", "pedido de demissão", "acerto", "não recebi", "nao recebi", "13º", "décimo terceiro", "férias"],
    resumo: "As verbas que a pessoa recebe dependem de como o contrato terminou: dispensa sem justa causa, pedido de demissão, justa causa, rescisão indireta, acordo ou término de contrato por prazo.",
    requisitos: [
      "Sem justa causa: saldo de salário, aviso prévio (trabalhado ou indenizado), férias vencidas e proporcionais com 1/3, 13º proporcional, saque do FGTS com multa de 40%, e seguro-desemprego se cumpridos os requisitos.",
      "Pedido de demissão: saldo de salário, férias vencidas e proporcionais com 1/3 e 13º proporcional; sem multa do FGTS, sem saque e sem seguro-desemprego.",
      "Justa causa: saldo de salário e férias vencidas; perde aviso prévio, multa do FGTS, saque, 13º proporcional e férias proporcionais.",
      "Acordo (art. 484-A da CLT): metade do aviso prévio e da multa de 40%, saque de até 80% do FGTS, sem seguro-desemprego.",
    ],
    alegacoes_comuns_do_inss: [],
    teses_e_flexibilizacoes: [
      "Rescisão indireta (falta grave do empregador, como atraso de salário, não depósito do FGTS ou assédio): a pessoa pode pedir na Justiça que o contrato seja considerado encerrado por culpa da empresa, com as verbas de uma dispensa sem justa causa.",
      "Justa causa aplicada sem prova ou sem proporcionalidade pode ser contestada na Justiça.",
      "FGTS não depositado, horas extras e outras verbas não pagas podem ser cobrados junto com a rescisão.",
    ],
    prazos: [
      "A empresa deve pagar as verbas rescisórias em até 10 dias contados do término do contrato (art. 477 da CLT); a multa pelo atraso é de um salário.",
      "Prescrição: 2 anos depois do fim do contrato para ajuizar ação, podendo cobrar os últimos 5 anos de direitos.",
    ],
    a_favor: ["Termo de rescisão, contracheques, extrato do FGTS, conversas e provas do que aconteceu."],
    contra: ["Passou mais de 2 anos do fim do contrato (prescrição).", "Assinou quitação sem ressalva (isso pode ser analisado)."],
    perguntas_que_faltam: ["Como terminou o contrato (sem justa causa, pedido, justa causa, acordo)?", "Datas de entrada e de saída, e o que a empresa pagou ou deixou de pagar?", "Tinha carteira assinada o tempo todo? Recebeu extrato do FGTS e o termo de rescisão?"],
    cuidados: ["Não afirme valores: cada verba depende do salário e das datas; o advogado calcula.", "Se a demissão ocorreu depois de acidente ou afastamento pelo INSS, consulte a ficha de estabilidade do acidente de trabalho."],
    fontes: [CLT, L8036, CF],
  },
  {
    ...base,
    tema: "trabalhista_acidente_e_estabilidade",
    titulo: "Acidente de trabalho: estabilidade de 12 meses e direitos trabalhistas",
    palavras_chave: ["acidente de trabalho", "estabilidade", "demitido depois de afastamento", "voltou do inss", "cat", "doença ocupacional", "doenca ocupacional", "acidente no trabalho", "machuquei no trabalho", "me machuquei", "empresa abriu cat", "readaptação", "readaptacao", "reintegração", "reintegracao"],
    resumo: "O empregado que sofreu acidente de trabalho e recebeu auxílio-doença acidentário tem estabilidade provisória de 12 meses depois que o benefício termina. A dispensa sem justa causa nesse período pode ser questionada.",
    requisitos: [
      "Acidente de trabalho ou doença ocupacional (equiparada), em regra com a CAT, e afastamento superior a 15 dias com recebimento do auxílio-doença acidentário (espécie 91).",
      "Estabilidade de 12 meses contados da cessação do auxílio-doença acidentário (art. 118 da Lei 8.213/91). A jurisprudência também reconhece a estabilidade em casos de doença ocupacional diagnosticada depois do fim do contrato, quando há relação com o trabalho.",
    ],
    alegacoes_comuns_do_inss: [],
    teses_e_flexibilizacoes: [
      "Dispensa sem justa causa durante a estabilidade: pedido de reintegração ao emprego ou, passado o período, indenização equivalente aos salários e demais direitos do período.",
      "A estabilidade não depende de o empregador ter emitido a CAT quando o acidente é comprovado por outros meios.",
      "Indenização por danos materiais e morais decorrentes do acidente ou doença do trabalho, quando houver culpa ou risco da atividade: o advogado analisa; só mencione se o escritório atuar nesse tipo de pedido.",
    ],
    prazos: ["Prescrição de 2 anos depois do fim do contrato para a ação trabalhista, com direitos dos últimos 5 anos.", "A estabilidade dura 12 meses a partir do fim do auxílio-doença acidentário."],
    a_favor: ["CAT, comprovantes do recebimento do benefício acidentário, data da alta do INSS e data da demissão.", "Laudos que liguem a lesão ao trabalho."],
    contra: ["Benefício comum (espécie 31) e sem relação reconhecida com o trabalho.", "Demissão depois de passados 12 meses do fim do benefício."],
    perguntas_que_faltam: ["O benefício do INSS era acidentário (espécie 91) ou comum (31)?", "Qual a data da alta do INSS e a data da demissão?", "A empresa abriu a CAT?", "A empresa pagou a rescisão? Qual foi a justificativa da demissão?"],
    cuidados: ["Não afirme que a demissão foi ilegal nem prometa reintegração ou valor: diga que existe a estabilidade e que o advogado analisa as datas.", "Também consulte a ficha do auxílio-acidente: a sequela pode dar direito a benefício do INSS."],
    fontes: [L8213, CLT],
  },
  {
    ...base,
    tema: "trabalhista_vinculo_e_horas_extras",
    titulo: "Reconhecimento de vínculo, horas extras e jornada",
    palavras_chave: ["vínculo", "vinculo", "sem carteira", "carteira não assinada", "carteira nao assinada", "pj", "pejotização", "pejotizacao", "horas extras", "hora extra", "jornada", "adicional noturno", "banco de horas", "intervalo", "comissões", "comissoes", "motorista de aplicativo", "entregador", "uber", "ifood", "autônomo", "autonomo"],
    resumo: "Quem trabalha com pessoalidade, de forma habitual, com pagamento e subordinação tem vínculo de emprego, mesmo sem carteira assinada. Daí decorrem horas extras, FGTS, férias, 13º e demais direitos.",
    requisitos: [
      "Vínculo de emprego (art. 3º da CLT): pessoa física, pessoalidade, não eventualidade, onerosidade e subordinação.",
      "Horas extras: trabalho além de 8 horas por dia ou 44 semanais, com adicional de pelo menos 50%.",
      "Prova da jornada: cartões de ponto, mensagens, testemunhas e registros do trabalho.",
    ],
    alegacoes_comuns_do_inss: [],
    teses_e_flexibilizacoes: [
      "Contratos de 'PJ' ou autônomo que escondem uma relação de emprego (fraude) podem ser contestados na Justiça do Trabalho.",
      "Trabalho por aplicativo: a existência de vínculo é tema de jurisprudência em evolução; o advogado analisa o caso pelas condições reais do trabalho.",
      "Quando a empresa não junta os cartões de ponto, a jornada alegada pela pessoa pode ser considerada, em regra, com outras provas.",
    ],
    prazos: ["Prescrição: 2 anos depois do fim do contrato para ajuizar, cobrando os últimos 5 anos."],
    a_favor: ["Mensagens de ordens e horários, comprovantes de pagamento, testemunhas e fotos do trabalho.", "Cartões de ponto e escalas."],
    contra: ["Trabalho eventual e autonomia real (sem ordens nem horários da empresa).", "Falta total de provas da jornada."],
    perguntas_que_faltam: ["Como era o trabalho: horário, quem dava as ordens e como era pago?", "Teve carteira assinada? Por quanto tempo trabalhou?", "Como provar: mensagens, testemunhas, comprovantes de pagamento?"],
    cuidados: ["Autônomo, MEI ou motorista de aplicativo sem vínculo de emprego não é caso trabalhista por padrão: veja os benefícios do INSS (previdenciário). Se houver dúvida sobre o vínculo, diga que o advogado analisa, sem sugerir ação contra a empresa.", "Não afirme que há vínculo nem valores."],
    fontes: [CLT, CF],
  },
];
