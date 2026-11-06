/**
 * Fork Sales — devolve ao Deskcomm o que foi digitado no contrato: preenche os campos personalizados do NEGÓCIO (CPF, RG, endereço…)
 * reconhecidos pelo NOME do campo, o mesmo critério que `sugerirDados` usa no sentido contrário. Só preenche o que está vazio.
 */
import { REGRAS, sem } from "@/lib/sales/sugerir-dados";

export interface DadosDoCliente {
  cpf?: string; rg?: string; nacionalidade?: string; estado_civil?: string; profissao?: string; cep?: string; logradouro?: string;
  numero?: string; complemento?: string; bairro?: string; cidade?: string; uf?: string; sexo?: "M" | "F" | string;
}

const vazio = (v: unknown) => v === undefined || v === null || String(v).trim() === "";

export function valorParaOCampo(rotulo: string, dados: DadosDoCliente): string | null {
  const chave = sem(rotulo);
  const regra = REGRAS.find(([, rx]) => rx.test(chave));
  if (!regra) return null;
  const campo = regra[0] as keyof DadosDoCliente;
  const v = dados[campo];
  if (vazio(v)) return null;
  if (campo === "sexo") return v === "F" ? "Feminino" : v === "M" ? "Masculino" : String(v);
  return String(v).trim();
}

/** O que gravar em `custom_fields` do negócio: só os campos que existem no funil, casam pelo nome e ainda estão vazios. */
export function preencherCamposDoNegocio(defs: { key: string; label: string }[], dados: DadosDoCliente, atuais: Record<string, unknown> | null): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const d of defs) {
    if (!vazio(atuais?.[d.key])) continue;
    const v = valorParaOCampo(d.label, dados);
    if (v !== null) saida[d.key] = v;
  }
  return saida;
}
