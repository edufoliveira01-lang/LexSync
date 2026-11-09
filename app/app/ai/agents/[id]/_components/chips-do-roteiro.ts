/**
 * Fork Sales — o roteiro com AÇÕES VISUAIS: funções puras (sem React nem DOM) que separam o texto gravado em pedaços de texto e ações, e juntam de volta.
 * O texto gravado continua sendo o bloco claro para o modelo ("⚙ AÇÃO — … / Etapa: …"); só a TELA o mostra como uma etiqueta colorida.
 */
export const CABECALHO_DA_ACAO = "⚙ AÇÃO — execute uma única vez; nunca mostre isto ao cliente:";

export type Segmento = { t: "texto"; v: string } | { t: "acao"; linha: string };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RX = () => new RegExp(`\\n?${esc(CABECALHO_DA_ACAO)}\\n([^\\n]*)\\n?`, "g");

/** O texto gravado em pedaços: texto comum e ações, na ordem em que aparecem. */
export function paraSegmentos(texto: string): Segmento[] {
  const out: Segmento[] = [];
  const rx = RX();
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(texto)) !== null) {
    if (m.index > ultimo) out.push({ t: "texto", v: texto.slice(ultimo, m.index) });
    out.push({ t: "acao", linha: (m[1] ?? "").trim() });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) out.push({ t: "texto", v: texto.slice(ultimo) });
  return out;
}

/** Os pedaços de volta no texto gravado. */
export function deSegmentos(segs: readonly Segmento[]): string {
  let s = "";
  for (const g of segs) s += g.t === "texto" ? g.v : `\n${CABECALHO_DA_ACAO}\n${g.linha}\n`;
  return s.replace(/^\n/, "");
}

export interface RotuloDaAcao { icone: string; texto: string; tipo: string }

/** Como a ação aparece na tela: um ícone e um texto curto, pelo que a linha diz. */
export function rotuloDaAcao(linha: string): RotuloDaAcao {
  const l = linha.trim();
  const depois = (p: string) => l.slice(p.length).trim();
  if (l.startsWith("Etapa:")) return { icone: "⇄", texto: `Etapa: ${depois("Etapa:")}`, tipo: "etapa" };
  if (l.startsWith("Remover etiqueta:")) return { icone: "🏷", texto: `Remover etiqueta: ${depois("Remover etiqueta:")}`, tipo: "etiqueta_rem" };
  if (l.startsWith("Etiqueta:")) return { icone: "🏷", texto: `Etiqueta: ${depois("Etiqueta:")}`, tipo: "etiqueta_add" };
  if (l.startsWith("Responsável:")) return { icone: "👤", texto: `Responsável: ${depois("Responsável:")}`, tipo: "responsavel" };
  if (l.startsWith("Notificar equipe:")) return { icone: "🔔", texto: `Avisar a equipe: ${depois("Notificar equipe:")}`, tipo: "notificar" };
  if (l.startsWith("Envie ao cliente, exatamente assim:")) return { icone: "💬", texto: `Mensagem: ${depois("Envie ao cliente, exatamente assim:").replace(/^[“"]|[”"]$/g, "")}`, tipo: "mensagem" };
  if (l.startsWith("Passe a conversa para a equipe")) return { icone: "🙋", texto: "Chamar a equipe", tipo: "chamar_equipe" };
  if (l.startsWith("Agende um retorno")) return { icone: "⏰", texto: l.replace(/^Agende um retorno\s*/, "Retorno ").replace(/\s+e retome.*$/, ""), tipo: "retorno" };
  if (l.startsWith("Grave no cadastro")) return { icone: "📝", texto: "Gravar dados do cliente", tipo: "dados" };
  if (l.startsWith("Envie o contrato")) return { icone: "📄", texto: "Enviar o contrato", tipo: "contrato" };
  if (l.startsWith("Consulte a base jurídica sobre")) return { icone: "⚖", texto: `Base jurídica: ${l.replace(/^Consulte a base jurídica sobre\s*/, "").replace(/\s+e responda com base na ficha\.?$/, "")}`, tipo: "base" };
  return { icone: "⚙", texto: l, tipo: "outra" };
}
