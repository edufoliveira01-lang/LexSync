/**
 * Os campos que o funil MOSTRA NO CARD do quadro (fork Sales) — a regra, pura.
 *
 * O dono marca "Mostrar no card" em cada campo do funil (Configurações › Funis › Campos). O card mostra uma etiqueta "Rótulo: valor" para cada
 * um que tem valor, no máximo `MAX_CAMPOS_NO_CARD`. Campo do CONTATO fica de fora (o valor mora na ficha da pessoa, não no negócio), e campo de
 * arquivo também (tem o bloco próprio de anexos).
 */
import { escopoDoCampo } from "@/lib/leads/campos-do-funil";
import type { CustomFieldDef } from "@/lib/schemas/settings";

export const MAX_CAMPOS_NO_CARD = 3;

/** As definições que vão para o card: do negócio, marcadas, na ordem em que o funil as declara, no máximo 3. */
export function camposDoCard(defs: readonly CustomFieldDef[]): CustomFieldDef[] {
  return defs
    .filter((d) => d.no_card === true && escopoDoCampo(d) === "negocio" && d.type !== "file")
    .slice(0, MAX_CAMPOS_NO_CARD);
}

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

function textoDe(def: CustomFieldDef, valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (Array.isArray(valor)) {
    const itens = valor.map((v) => textoDe(def, v)).filter((v): v is string => v !== null);
    return itens.length > 0 ? itens.join(", ") : null;
  }
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : null;
  if (typeof valor !== "string") return null;
  const bruto = valor.trim();
  if (bruto === "") return null;
  // Lista (select, multiselect, searchable_select): o card mostra o RÓTULO da opção, não o valor canônico gravado.
  const opcao = def.options?.find((o) => o.value === bruto);
  if (opcao) return opcao.label;
  if (def.type === "date") {
    const m = DATA_ISO.exec(bruto);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return bruto;
}

/** O que a etiqueta mostra: o valor legível, ou `null` quando o campo está vazio (o card não desenha etiqueta vazia). */
export function valorParaOCard(def: CustomFieldDef, valor: unknown): string | null {
  return textoDe(def, valor);
}

export interface EtiquetaDoCard {
  chave: string;
  rotulo: string;
  valor: string;
}

/** As etiquetas deste negócio: só os campos marcados que têm valor. */
export function etiquetasDoCard(
  defs: readonly CustomFieldDef[],
  customFields: Record<string, unknown> | null | undefined,
): EtiquetaDoCard[] {
  const valores = customFields ?? {};
  const saida: EtiquetaDoCard[] = [];
  for (const def of camposDoCard(defs)) {
    const valor = valorParaOCard(def, valores[def.key]);
    if (valor !== null) saida.push({ chave: def.key, rotulo: def.label, valor });
  }
  return saida;
}
