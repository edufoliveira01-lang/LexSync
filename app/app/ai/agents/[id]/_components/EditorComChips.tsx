"use client";
/**
 * Fork Sales — o roteiro como TEXTO COM ETIQUETAS: as ações (etapa, etiqueta, mensagem…) aparecem no meio do texto como etiquetas coloridas, com um × para tirar.
 *
 * Por baixo continua um texto só: ao digitar, o campo é lido e devolvido como o texto gravado (a ação vira o bloco claro "⚙ AÇÃO — …"). Ao abrir, o texto gravado
 * vira etiquetas de novo. Colar entra sempre como texto puro. O `@` e o botão "Inserir ação" chamam quem usa este campo (`onArroba`, `ref.inserir`).
 */
import * as React from "react";

import { cn } from "@/lib/utils";

import { CABECALHO_DA_ACAO, deSegmentos, paraSegmentos, rotuloDaAcao } from "./chips-do-roteiro";

const ZWSP = "\u200b";

export interface AlvoDoArroba { no: Text; inicio: number; fim: number; consulta: string }
export interface ManejoDoEditor { inserir: (linha: string, alvo?: AlvoDoArroba | null) => void; focar: () => void }

/** A etiqueta colorida de uma ação (um elemento que não se edita por dentro). */
export function criarChip(doc: Document, linha: string, removivel: boolean): HTMLElement {
  const r = rotuloDaAcao(linha);
  const chip = doc.createElement("span");
  chip.setAttribute("contenteditable", "false");
  chip.setAttribute("data-acao", "");
  chip.setAttribute("data-linha", linha);
  chip.className = "mx-0.5 inline-flex max-w-full select-none items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 align-baseline text-sm font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-200";
  const icone = doc.createElement("span");
  icone.setAttribute("aria-hidden", "true");
  icone.textContent = r.icone;
  const texto = doc.createElement("span");
  texto.className = "truncate";
  texto.textContent = r.texto;
  texto.title = r.texto;
  chip.append(icone, texto);
  if (removivel) {
    const x = doc.createElement("span");
    x.setAttribute("data-remover", "");
    x.setAttribute("role", "button");
    x.setAttribute("aria-label", "Tirar esta ação");
    x.className = "ml-0.5 cursor-pointer rounded-full px-1 leading-none text-blue-700 hover:bg-blue-200 dark:text-blue-300 dark:hover:bg-blue-900";
    x.textContent = "×";
    chip.append(x);
  }
  return chip;
}

/** O que está na tela, de volta no texto gravado. */
export function serializarEditor(raiz: Node): string {
  let out = "";
  const visita = (n: Node) => {
    if (n.nodeType === 3) { out += n.textContent ?? ""; return; }
    if (n.nodeType !== 1) return;
    const el = n as HTMLElement;
    if (el.hasAttribute("data-acao")) { out += `\n${CABECALHO_DA_ACAO}\n${el.getAttribute("data-linha") ?? ""}\n`; return; }
    if (el.tagName === "BR") { out += "\n"; return; }
    const bloco = el.tagName === "DIV" || el.tagName === "P";
    if (bloco && out && !out.endsWith("\n")) out += "\n";
    el.childNodes.forEach(visita);
  };
  raiz.childNodes.forEach(visita);
  return out.replace(/\u200b/g, "").replace(/^\n/, "");
}

/** O texto gravado na tela: texto comum e etiquetas. */
export function desenharNoEditor(raiz: HTMLElement, texto: string, removivel: boolean): void {
  const doc = raiz.ownerDocument;
  const nos: Node[] = [];
  const segs = paraSegmentos(texto);
  for (const g of segs) {
    if (g.t === "texto") nos.push(doc.createTextNode(g.v));
    else nos.push(doc.createTextNode(ZWSP), criarChip(doc, g.linha, removivel), doc.createTextNode(ZWSP));
  }
  raiz.replaceChildren(...nos);
}

export const EditorComChips = React.forwardRef<
  ManejoDoEditor,
  {
    value: string;
    onChange: (v: string) => void;
    onArroba?: (alvo: AlvoDoArroba | null) => void;
    disabled?: boolean;
    invalid?: boolean;
    placeholder?: string;
    className?: string;
  }
>(function EditorComChips({ value, onChange, onArroba, disabled, invalid, placeholder, className }, ref) {
  const raiz = React.useRef<HTMLDivElement>(null);
  // Os textos que ESTE campo já devolveu a quem o usa. O estado de quem usa chega depois (React agrupa as atualizações): se o valor que chega é um que o
  // próprio campo emitiu, a tela já está certa e NÃO se redesenha (redesenhar no meio da digitação joga o cursor para o começo).
  const emitidos = React.useRef<Set<string>>(new Set());
  const salvo = React.useRef<Range | null>(null);
  const lembrar = (v: string) => {
    const set = emitidos.current;
    set.add(v);
    if (set.size > 200) { const primeiro = set.values().next().value; if (primeiro !== undefined) set.delete(primeiro); }
  };

  // texto vindo de fora (abrir a tela, "Usar o texto do escritório", trocar de aba): desenha de novo
  React.useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    if (emitidos.current.has(value)) return;
    desenharNoEditor(el, value, !disabled);
    emitidos.current = new Set([value]);
  }, [value, disabled]);

  const emitir = () => {
    const el = raiz.current;
    if (!el) return;
    const v = serializarEditor(el);
    lembrar(v);
    onChange(v);
  };

  const guardarSelecao = () => {
    const el = raiz.current;
    const sel = window.getSelection();
    if (el && sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) salvo.current = sel.getRangeAt(0).cloneRange();
  };

  const olharArroba = () => {
    if (!onArroba) return;
    const sel = window.getSelection();
    const no = sel?.anchorNode;
    if (!sel || !no || no.nodeType !== 3 || !raiz.current?.contains(no)) { onArroba(null); return; }
    const ate = (no.textContent ?? "").slice(0, sel.anchorOffset);
    const m = /(^|[\s\u200b])@([^\s@\u200b]{0,20})$/.exec(ate);
    if (!m) { onArroba(null); return; }
    onArroba({ no: no as Text, inicio: sel.anchorOffset - (m[2]?.length ?? 0) - 1, fim: sel.anchorOffset, consulta: m[2] ?? "" });
  };

  React.useImperativeHandle(ref, () => ({
    focar: () => raiz.current?.focus(),
    inserir: (linha, alvo) => {
      const el = raiz.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      if (alvo && el.contains(alvo.no)) {
        // tira o "@" (e o que veio depois dele) e põe a etiqueta no lugar
        const t = alvo.no.textContent ?? "";
        alvo.no.textContent = t.slice(0, alvo.inicio) + t.slice(alvo.fim);
        range.setStart(alvo.no, Math.min(alvo.inicio, alvo.no.textContent.length));
      } else if (salvo.current && el.contains(salvo.current.commonAncestorContainer)) {
        range.setStart(salvo.current.startContainer, salvo.current.startOffset);
      } else {
        range.selectNodeContents(el);
        range.collapse(false);
      }
      range.collapse(true);
      const frag = document.createDocumentFragment();
      const depois = document.createTextNode(ZWSP);
      frag.append(document.createTextNode(ZWSP), criarChip(document, linha, !disabled), depois);
      range.insertNode(frag);
      const fim = document.createRange();
      fim.setStart(depois, depois.length);
      fim.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(fim);
      guardarSelecao();
      emitir();
      onArroba?.(null);
    },
  }));

  return (
    <div
      ref={raiz}
      role="textbox"
      aria-multiline="true"
      aria-invalid={invalid || undefined}
      data-testid="editor-com-etiquetas"
      data-placeholder={placeholder}
      // `plaintext-only` impede formatação (negrito etc.) e deixa o navegador cuidar do Enter e do desfazer; as etiquetas são elementos não editáveis dentro dele
      contentEditable={disabled ? false : ("plaintext-only" as unknown as boolean)}
      suppressContentEditableWarning
      spellCheck={false}
      onInput={() => { emitir(); olharArroba(); }}
      onKeyUp={() => { guardarSelecao(); }}
      onMouseUp={guardarSelecao}
      onBlur={() => {
        guardarSelecao();
        // texto colado com um bloco de ação vira etiqueta quando a pessoa sai do campo
        const el = raiz.current;
        if (el && !disabled && (el.textContent ?? "").includes(CABECALHO_DA_ACAO)) { const v = serializarEditor(el); desenharNoEditor(el, deSegmentos(paraSegmentos(v)), true); lembrar(v); }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const texto = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, texto);
      }}
      onClick={(e) => {
        const alvo = (e.target as HTMLElement).closest("[data-remover]");
        if (!alvo || disabled) return;
        const chip = alvo.closest("[data-acao]");
        chip?.remove();
        emitir();
      }}
      className={cn(
        "max-h-[28rem] min-h-[16rem] w-full overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-background p-3 text-sm leading-7 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
        invalid && "border-destructive",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    />
  );
});
