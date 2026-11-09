/**
 * Fork Sales — base jurídica curada: uma FICHA por tema, consultada pelo agente (ferramenta `crm_consultar_base_juridica`) em vez de responder de memória.
 * Cada ficha traz fonte, data da revisão e validade; passou da validade, o agente responde com ressalva até alguém revalidar.
 * `status`: "pendente_revisao" = redigida por IA a partir de fontes oficiais e ainda sem a conferência de um advogado: o agente a usa, mas diz que o advogado confirma.
 */
export interface FonteDaFicha { titulo: string; url: string }
export interface FichaJuridica {
  tema: string;
  titulo: string;
  areas: readonly string[];
  palavras_chave: readonly string[];
  resumo: string;
  requisitos: readonly string[];
  alegacoes_comuns_do_inss: readonly string[];
  teses_e_flexibilizacoes: readonly string[];
  prazos: readonly string[];
  a_favor: readonly string[];
  contra: readonly string[];
  perguntas_que_faltam: readonly string[];
  cuidados: readonly string[];
  fontes: readonly FonteDaFicha[];
  revisado_em: string;
  validade_dias: number;
  status: "revisada" | "pendente_revisao";
}

export const FICHAS: readonly FichaJuridica[] = [
  {
    tema: "bpc",
    titulo: "BPC/LOAS — benefício assistencial à pessoa com deficiência e ao idoso",
    areas: ["previdenciario"],
    palavras_chave: ["bpc", "loas", "benefício assistencial", "beneficio assistencial", "autismo", "deficiência", "deficiencia", "criança com deficiência", "idoso 65", "renda per capita", "cadúnico", "cadunico"],
    resumo: "Um salário mínimo mensal para quem tem 65 anos ou mais, ou tem deficiência de longo prazo, e não consegue se manter nem ser mantido pela família. Não exige contribuição ao INSS.",
    requisitos: [
      "Idoso: 65 anos ou mais. Basta a idade: não se pede laudo nem perícia médica.",
      "Pessoa com deficiência (inclusive criança): impedimento de longo prazo (em regra, 2 anos ou mais) de natureza física, mental, intelectual ou sensorial que, junto com barreiras, limite a participação na sociedade. A avaliação é biopsicossocial: perícia médica e avaliação social do INSS.",
      "Renda familiar por pessoa de até 1/4 do salário mínimo vigente (use a ferramenta de cálculo, nunca de memória).",
      "Família para o cálculo: o requerente, cônjuge ou companheiro, pais, madrasta ou padrasto, irmãos solteiros, filhos e enteados solteiros e menores tutelados, desde que vivam sob o mesmo teto.",
      "Inscrição e atualização no CadÚnico, que é indispensável para pedir o benefício.",
    ],
    alegacoes_comuns_do_inss: [
      "Renda per capita acima de 1/4 do salário mínimo.",
      "Ausência de impedimento de longo prazo (perícia concluiu que a limitação não é de 2 anos ou mais, ou que não é suficiente).",
      "CadÚnico desatualizado ou com dados divergentes.",
    ],
    teses_e_flexibilizacoes: [
      "A lei (Lei 8.742/93, alterada pela Lei 14.176/2021) permite considerar renda per capita de até 1/2 salário mínimo, avaliando o grau da deficiência, a dependência de terceiros para atividades básicas e os gastos com saúde, tratamentos, fraldas, alimentação especial e medicamentos não fornecidos pelo SUS, desde que comprovados.",
      "Gastos de saúde comprovados podem ser considerados na análise da renda: guarde recibos, notas e receitas.",
      "Quando o ponto da negativa é o laudo ou a perícia, discute-se a avaliação biopsicossocial (a perícia médica não é a única prova): laudos de especialistas, relatórios de terapias e escolares.",
    ],
    prazos: [
      "Recurso administrativo contra a negativa do INSS: 30 dias a contar da ciência da decisão.",
      "Passado o prazo do recurso, é possível fazer um novo requerimento no INSS ou ir à Justiça (em regra, com o requerimento administrativo prévio e a decisão do INSS). O advogado define o caminho pela data da negativa.",
    ],
    a_favor: ["Idoso com 65 anos ou mais e renda dentro do limite.", "Deficiência de longo prazo bem documentada (laudo, relatórios de terapias e da escola), CadÚnico atualizado e gastos de saúde comprovados."],
    contra: ["Renda per capita acima de 1/2 salário mínimo.", "CadÚnico desatualizado.", "Laudos que não descrevem a limitação nem a duração."],
    perguntas_que_faltam: ["Quantas pessoas moram na casa e qual é a renda total? (use a ferramenta de cálculo)", "Há gastos mensais de saúde comprovados (terapias, remédios, fraldas, alimentação especial)?", "O CadÚnico está atualizado?", "Qual é a data da negativa e o número do requerimento? O que diz a carta (renda, impedimento de longo prazo ou os dois)?"],
    cuidados: [
      "Nunca diga que há \"chance\" ou \"não há chance\": diga o que a lei prevê e que o advogado confirma pelo caso.",
      "Se a carta cita DOIS motivos (renda e impedimento de longo prazo), comente os dois.",
      "Cite o prazo de 30 dias do recurso e calcule a partir da data da negativa; se já passou, explique os outros caminhos.",
    ],
    fontes: [
      { titulo: "Lei nº 8.742/1993 (LOAS), art. 20 e 20-B", url: "https://www.planalto.gov.br/ccivil_03/leis/l8742.htm" },
      { titulo: "Lei nº 14.176/2021", url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/L14176.htm" },
      { titulo: "INSS — Benefício assistencial à pessoa com deficiência", url: "https://www.gov.br/inss/pt-br/direitos-e-deveres/beneficios-assistenciais" },
    ],
    revisado_em: "2026-11-09",
    validade_dias: 90,
    status: "pendente_revisao",
  },
];

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface FichaConsultada { ficha: FichaJuridica; vencida: boolean }

/** A ficha que melhor responde ao tema pedido (id exato, ou palavras-chave no texto). `null` = a base não cobre. */
export function acharFicha(consulta: string, hoje: Date = new Date(), lista: readonly FichaJuridica[] = FICHAS): FichaConsultada | null {
  const q = norm(consulta);
  if (!q.trim()) return null;
  const pontos = (f: FichaJuridica) => (norm(f.tema) === q ? 100 : 0) + f.palavras_chave.filter((p) => q.includes(norm(p))).length * 10 + (q.includes(norm(f.tema)) ? 5 : 0);
  const melhor = lista.map((f) => ({ f, p: pontos(f) })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p)[0]?.f;
  if (!melhor) return null;
  const idadeDias = (hoje.getTime() - new Date(melhor.revisado_em).getTime()) / 86_400_000;
  return { ficha: melhor, vencida: idadeDias > melhor.validade_dias };
}

export const temasDaBase = (lista: readonly FichaJuridica[] = FICHAS): string[] => lista.map((f) => f.tema);
