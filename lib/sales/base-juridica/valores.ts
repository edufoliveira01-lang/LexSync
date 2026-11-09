/**
 * Fork Sales — valores que mudam com o tempo (salário mínimo etc.), FORA do texto do agente e das fichas.
 * O modelo nunca "lembra" um número: a ferramenta devolve o valor vigente na data, com a fonte. Mudou o salário mínimo? Acrescente uma linha
 * aqui (a rotina de atualização da base também escreve aqui); todas as fichas e cálculos acompanham.
 */
export interface ValorVigente {
  chave: "salario_minimo";
  /** Primeiro dia (AAAA-MM-DD) em que o valor vale. */
  vigente_desde: string;
  valor: number;
  fonte: string;
  revisado_em: string;
  /** `false` = lançado por IA e ainda não conferido por uma pessoa: a ferramenta avisa. */
  confirmado: boolean;
}

export const VALORES: readonly ValorVigente[] = [
  { chave: "salario_minimo", vigente_desde: "2024-01-01", valor: 1412, fonte: "Decreto nº 11.864/2023", revisado_em: "2026-11-09", confirmado: true },
  { chave: "salario_minimo", vigente_desde: "2025-01-01", valor: 1518, fonte: "Decreto nº 12.342/2024", revisado_em: "2026-11-09", confirmado: true },
  { chave: "salario_minimo", vigente_desde: "2026-01-01", valor: 1621, fonte: "Decreto de reajuste do salário mínimo de 2026 (confirmar no Diário Oficial)", revisado_em: "2026-11-09", confirmado: false },
];

/** O valor que vale na data (hoje por padrão), ou `null` se não houver. */
export function valorVigente(chave: ValorVigente["chave"], em: Date = new Date(), lista: readonly ValorVigente[] = VALORES): ValorVigente | null {
  const dia = em.toISOString().slice(0, 10);
  return lista.filter((v) => v.chave === chave && v.vigente_desde <= dia).sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))[0] ?? null;
}

export interface ResultadoRendaPerCapita {
  salario_minimo: number;
  salario_minimo_fonte: string;
  salario_minimo_confirmado: boolean;
  renda_per_capita: number;
  limite_um_quarto: number;
  limite_meio: number;
  faixa: "ate_um_quarto" | "entre_um_quarto_e_meio" | "acima_de_meio";
  leitura: string;
  /** Só quando houve gastos de saúde informados: eles NÃO abatem a renda; pesam na ampliação do limite (até 1/2) e o advogado analisa. */
  gastos_de_saude_por_pessoa?: number;
  leitura_gastos_de_saude?: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const faixaDe = (pc: number, quarto: number, meio: number): ResultadoRendaPerCapita["faixa"] => (pc <= quarto ? "ate_um_quarto" : pc <= meio ? "entre_um_quarto_e_meio" : "acima_de_meio");

/** Renda por pessoa da família contra 1/4 e 1/2 do salário mínimo vigente (BPC). Aritmética aqui, nunca no modelo. */
export function calcularRendaPerCapita(rendaTotal: number, moradores: number, gastosDeSaude = 0, em: Date = new Date(), lista: readonly ValorVigente[] = VALORES): ResultadoRendaPerCapita | null {
  const sm = valorVigente("salario_minimo", em, lista);
  if (!sm || !(moradores >= 1) || !(rendaTotal >= 0)) return null;
  const quarto = r2(sm.valor / 4), meio = r2(sm.valor / 2);
  const pc = r2(rendaTotal / moradores);
  const faixa = faixaDe(pc, quarto, meio);
  const leitura =
    faixa === "ate_um_quarto" ? "Dentro do critério legal de renda (até 1/4 do salário mínimo por pessoa)."
    : faixa === "entre_um_quarto_e_meio" ? "Acima de 1/4, mas até 1/2 do salário mínimo por pessoa: o critério pode ser flexibilizado conforme o grau da deficiência, a dependência de terceiros e os gastos de saúde comprovados. O advogado analisa."
    : "Acima de 1/2 salário mínimo por pessoa: o INSS tende a negar pela renda e a flexibilização é bem mais difícil. O advogado analisa.";
  const out: ResultadoRendaPerCapita = { salario_minimo: sm.valor, salario_minimo_fonte: sm.fonte, salario_minimo_confirmado: sm.confirmado, renda_per_capita: pc, limite_um_quarto: quarto, limite_meio: meio, faixa, leitura };
  if (gastosDeSaude > 0) {
    out.gastos_de_saude_por_pessoa = r2(gastosDeSaude / moradores);
    out.leitura_gastos_de_saude = "Os gastos de saúde comprovados NÃO são descontados da renda; eles são um dos fatores que o INSS considera para ampliar o limite de 1/4 até 1/2 salário mínimo (art. 20-B da Lei 8.742/93). Guarde recibos, notas e receitas. O advogado analisa como entram no caso.";
  }
  return out;
}
