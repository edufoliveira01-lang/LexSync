/**
 * Fork Sales — MÁSCARAS dos campos: como o valor aparece e é gravado (CPF 000.000.000-00, CEP 00000-000…).
 *
 * A máscara é guardada no campo como o nome de uma máscara pronta (`cpf`, `cep`…) ou como `padrao:<padrão>`, em que 0 = um dígito, A = uma letra, * = letra ou
 * dígito, e o resto é literal. O valor vai GRAVADO JÁ FORMATADO (assim o contrato e as exportações o leem como a pessoa vê); quem precisa só dos dígitos (consulta
 * de CEP, conferência do CPF) já os extrai. Valor antigo sem formato é formatado ao abrir, sem reescrever o registro.
 */
import { isValidCpf } from "@/lib/legal/perfil-do-pais";

export const MASCARAS_PRONTAS = {
  cpf: { rotulo: "CPF", padrao: "000.000.000-00" },
  cnpj: { rotulo: "CNPJ", padrao: "00.000.000/0000-00" },
  cep: { rotulo: "CEP", padrao: "00000-000" },
  telefone: { rotulo: "Telefone", padrao: "(00) 00000-0000" },
  data: { rotulo: "Data (dd/mm/aaaa)", padrao: "00/00/0000" },
  cnj: { rotulo: "Nº do processo (CNJ)", padrao: "0000000-00.0000.0.00.0000" },
} as const;
export type MascaraPronta = keyof typeof MASCARAS_PRONTAS;

export const PREFIXO_PERSONALIZADA = "padrao:";
export const ehMascaraPronta = (m: string | undefined): m is MascaraPronta => !!m && m in MASCARAS_PRONTAS;
export const mascaraPersonalizada = (padrao: string): string => `${PREFIXO_PERSONALIZADA}${padrao}`;

/** O padrão que a máscara usa (`null` = sem máscara). */
export function padraoDaMascara(m: string | undefined | null): string | null {
  if (!m) return null;
  if (ehMascaraPronta(m)) return MASCARAS_PRONTAS[m].padrao;
  if (m.startsWith(PREFIXO_PERSONALIZADA)) return m.slice(PREFIXO_PERSONALIZADA.length) || null;
  return null;
}

const ehDigito = (c: string) => c >= "0" && c <= "9";
const ehLetra = (c: string) => /\p{L}/u.test(c);

function aplicarPadrao(valor: string, padrao: string): string {
  const raw = [...valor];
  let j = 0;
  let out = "";
  for (const p of padrao) {
    if (p === "0" || p === "A" || p === "*") {
      while (j < raw.length) {
        const c = raw[j]!;
        const ok = p === "0" ? ehDigito(c) : p === "A" ? ehLetra(c) : ehDigito(c) || ehLetra(c);
        j++;
        if (ok) { out += p === "A" ? c.toLocaleUpperCase("pt-BR") : c; break; }
      }
    } else if (raw.slice(j).some((c) => ehDigito(c) || ehLetra(c))) {
      out += p;
    } else {
      break;
    }
  }
  return out;
}

/** O valor com a máscara aplicada. Telefone aceita 10 ou 11 dígitos. Sem máscara, devolve o valor como veio. */
export function aplicarMascara(valor: unknown, mascara: string | undefined | null): string {
  const v = valor === undefined || valor === null ? "" : String(valor);
  if (!mascara) return v;
  if (mascara === "telefone") {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length === 0) return "";
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}${d.length > 6 ? `-${d.slice(6)}` : ""}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  const padrao = padraoDaMascara(mascara);
  return padrao ? aplicarPadrao(v, padrao) : v;
}

/** O valor completo e válido para a máscara? `null` = sim (ou sem máscara/vazio). Texto = o que está errado, em linguagem simples. */
export function validarComMascara(valor: unknown, mascara: string | undefined | null): string | null {
  const v = valor === undefined || valor === null ? "" : String(valor).trim();
  if (!mascara || v === "") return null;
  const d = v.replace(/\D/g, "");
  if (mascara === "cpf") return d.length === 11 && isValidCpf(d) ? null : "CPF inválido: confira os números.";
  if (mascara === "cnpj") return d.length === 14 ? null : "CNPJ incompleto.";
  if (mascara === "cep") return d.length === 8 ? null : "CEP incompleto: são 8 números.";
  if (mascara === "telefone") return d.length === 10 || d.length === 11 ? null : "Telefone incompleto: DDD e número.";
  if (mascara === "cnj") return d.length === 20 ? null : "Número do processo incompleto.";
  if (mascara === "data") {
    if (d.length !== 8) return "Data incompleta: dd/mm/aaaa.";
    const dia = Number(d.slice(0, 2)), mes = Number(d.slice(2, 4)), ano = Number(d.slice(4));
    const dt = new Date(ano, mes - 1, dia);
    return dt.getFullYear() === ano && dt.getMonth() === mes - 1 && dt.getDate() === dia ? null : "Data inexistente.";
  }
  const padrao = padraoDaMascara(mascara);
  if (padrao) return v.length === padrao.length ? null : "Preencha o campo por completo.";
  return null;
}

/** A máscara faz o campo aceitar só números? (para o teclado do celular) */
export const mascaraEhNumerica = (mascara: string | undefined | null): boolean => {
  if (!mascara) return false;
  if (ehMascaraPronta(mascara)) return true;
  const padrao = padraoDaMascara(mascara);
  return !!padrao && !/[A*]/.test(padrao);
};

/** Formato padrão para os dados que o CONTRATO leva, com ou sem máscara no campo: CPF, CEP e telefone sempre no formato de todo mundo. */
export function formatoPadraoDoContrato(campo: "cpf" | "cep" | "telefone", valor: unknown): string {
  const v = valor === undefined || valor === null ? "" : String(valor).trim();
  const d = v.replace(/\D/g, "");
  if (campo === "cpf" && d.length === 11) return aplicarMascara(d, "cpf");
  if (campo === "cep" && d.length === 8) return aplicarMascara(d, "cep");
  if (campo === "telefone" && (d.length === 10 || d.length === 11)) return aplicarMascara(d, "telefone");
  return v;
}
