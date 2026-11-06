/** Fork Sales — reconhece, pelo NOME do campo personalizado, qual dado do contrato ele representa (CPF, RG, endereço…). */
export interface Sugestoes {
  nome?: string; telefone?: string; email?: string; cpf?: string; rg?: string; nacionalidade?: string; estado_civil?: string; profissao?: string;
  cep?: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; uf?: string; sexo?: "M" | "F";
}

export const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const REGRAS: [keyof Sugestoes, RegExp][] = [
  ["cpf", /^(cpf|cpf cnpj|documento)$/], ["rg", /^(rg|identidade|registro geral)$/], ["nacionalidade", /^nacionalidade$/],
  ["estado_civil", /^estado civil$/], ["profissao", /^(profissao|ocupacao)$/], ["cep", /^cep$/],
  ["logradouro", /^(logradouro|endereco|rua|avenida|endereco completo)$/], ["numero", /^(numero|n|num|n o)$/],
  ["complemento", /^complemento$/], ["bairro", /^bairro$/], ["cidade", /^(cidade|municipio)$/], ["uf", /^(uf|estado)$/],
  ["sexo", /^(sexo|genero)$/],
];

export function sugerirDados(e: { contato: Record<string, string | null>; campos: { rotulo: string; valor: string }[] }): Sugestoes {
  const s: Sugestoes = {};
  const nome = e.contato.display_name || e.contato.name;
  if (nome) s.nome = nome;
  if (e.contato.phone_number) s.telefone = e.contato.phone_number;
  if (e.contato.email) s.email = e.contato.email;
  for (const c of e.campos) {
    const chave = sem(c.rotulo);
    const regra = REGRAS.find(([, rx]) => rx.test(chave));
    if (!regra) continue;
    const [campo] = regra;
    if (s[campo] !== undefined) continue; // o mais recente vence
    const valor = c.valor.trim();
    if (campo === "sexo") { const v = sem(valor); if (/^(f|fem|feminino|mulher)/.test(v)) s.sexo = "F"; else if (/^(m|masc|masculino|homem)/.test(v)) s.sexo = "M"; }
    else if (campo === "uf") s.uf = valor.slice(0, 2).toUpperCase();
    else (s as Record<string, string>)[campo] = valor;
  }
  return s;
}
