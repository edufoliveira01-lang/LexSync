"use client";
/**
 * Fork Sales — o campo de redação do roteiro: TEXTO FORMATADO (negrito, itálico, itens) e AÇÕES como etiquetas coloridas, uma cor por tipo.
 *
 * Por baixo continua um texto só, em Markdown simples: **negrito**, *itálico*, "- item" e as ações como `[[Etapa: Novo contato]]`. Ao digitar, o campo é lido
 * e devolvido nesse texto; ao abrir, o texto vira formatação e etiquetas de novo. Colar entra sempre como texto puro. O `@` e o botão "Inserir ação" chamam
 * quem usa este campo (`onArroba`, `ref.inserir`).
 */
import * as React from "react";

import { cn } from "@/lib/utils";

import { rotuloDaAcao } from "./chips-do-roteiro";

const ZWSP = "​";

export interface AlvoDoArroba { no: Text; inicio: number; fim: number; consulta: string }
export interface ManejoDoEditor { inserir: (linha: string, alvo?: AlvoDoArroba | null) => void; focar: () => void }

/** A etiqueta colorida de uma ação (um elemento que não se edita por dentro). `aviso`: o que faz falta para a ação funcionar. */
export function criarChip(doc: Document, linha: string, removivel: boolean, aviso?: string | null): HTMLElement {
  const r = rotuloDaAcao(linha);
  const chip = doc.createElement("span");
  chip.setAttribute("contenteditable", "false");
  chip.setAttribute("data-acao", "");
  chip.setAttribute("data-linha", linha);
  chip.className = cn("mx-0.5 inline-flex max-w-full select-none items-center gap-1.5 rounded-full px-2.5 py-0.5 align-baseline text-sm font-medium", r.cor, aviso && "ring-1 ring-amber-500");
  if (aviso) chip.title = aviso;
  const icone = doc.createElement("span");
  icone.setAttribute("aria-hidden", "true");
  icone.textContent = aviso ? "⚠" : r.icone;
  const texto = doc.createElement("span");
  texto.className = "truncate";
  texto.textContent = r.texto;
  if (!aviso) texto.title = r.texto;
  chip.append(icone, texto);
  if (removivel) {
    const x = doc.createElement("span");
    x.setAttribute("data-remover", "");
    x.setAttribute("role", "button");
    x.setAttribute("aria-label", "Tirar esta ação");
    x.className = "ml-0.5 cursor-pointer rounded-full px-1 leading-none opacity-60 hover:bg-black/10 hover:opacity-100";
    x.textContent = "×";
    chip.append(x);
  }
  return chip;
}

// ───────────────────────── tela → texto gravado (Markdown simples) ─────────────────────────

/** O que está na tela, de volta no texto gravado. */
export function serializarEditor(raiz: Node): string {
  let out = "";
  const quebra = () => { if (out && !out.endsWith("\n")) out += "\n"; };
  const sub = (nos: ArrayLike<Node>): string => {
    const antes = out;
    out = "";
    Array.from(nos).forEach(visita);
    const r = out;
    out = antes;
    return r;
  };
  function visita(n: Node): void {
    if (n.nodeType === 3) { out += (n.textContent ?? "").replace(/​/g, "").replace(/ /g, " "); return; }
    if (n.nodeType !== 1) return;
    const el = n as HTMLElement;
    if (el.hasAttribute("data-acao")) { out += `[[${el.getAttribute("data-linha") ?? ""}]]`; return; }
    const tag = el.tagName;
    if (tag === "BR") { out += "\n"; return; }
    if (tag === "B" || tag === "STRONG") { const t = sub(el.childNodes); out += t.trim() ? `**${t}**` : t; return; }
    if (tag === "I" || tag === "EM") { const t = sub(el.childNodes); out += t.trim() ? `*${t}*` : t; return; }
    if (tag === "UL" || tag === "OL") {
      quebra();
      el.querySelectorAll(":scope > li").forEach((li) => { out += `- ${sub(li.childNodes).replace(/\n+$/, "")}\n`; });
      return;
    }
    if (tag === "DIV" || tag === "P") { quebra(); el.childNodes.forEach(visita); return; }
    el.childNodes.forEach(visita);
  }
  raiz.childNodes.forEach(visita);
  return out.replace(/\n+$/, (m) => (m.length > 1 ? "\n" : "")).replace(/^\n/, "");
}

// ───────────────────────── texto gravado → tela ─────────────────────────

const INLINE = /(\[\[[^\]\n]{1,400}\]\]|(?<![*\w])\*\*[^*\s][^*\n]*?\*\*(?![*\w])|(?<![*\w])\*[^*\s][^*\n]*?\*(?![*\w]))/g;

function inline(doc: Document, pai: Node, texto: string, removivel: boolean, aviso: ((linha: string) => string | null) | undefined): void {
  let ultimo = 0;
  let m: RegExpExecArray | null;
  const rx = new RegExp(INLINE.source, "g");
  while ((m = rx.exec(texto)) !== null) {
    if (m.index > ultimo) pai.appendChild(doc.createTextNode(texto.slice(ultimo, m.index)));
    const tok = m[0];
    if (tok.startsWith("[[")) {
      const linha = tok.slice(2, -2).trim();
      pai.appendChild(doc.createTextNode(ZWSP));
      pai.appendChild(criarChip(doc, linha, removivel, aviso?.(linha) ?? null));
      pai.appendChild(doc.createTextNode(ZWSP));
    } else if (tok.startsWith("**")) {
      const b = doc.createElement("b");
      inline(doc, b, tok.slice(2, -2), removivel, aviso);
      pai.appendChild(b);
    } else {
      const i = doc.createElement("i");
      inline(doc, i, tok.slice(1, -1), removivel, aviso);
      pai.appendChild(i);
    }
    ultimo = m.index + tok.length;
  }
  if (ultimo < texto.length) pai.appendChild(doc.createTextNode(texto.slice(ultimo)));
}

/** O texto gravado na tela: linhas, itens, negrito, itálico e etiquetas. */
export function desenharNoEditor(raiz: HTMLElement, texto: string, removivel: boolean, aviso?: (linha: string) => string | null): void {
  const doc = raiz.ownerDocument;
  const nos: Node[] = [];
  let lista: HTMLUListElement | null = null;
  for (const linha of texto.split("\n")) {
    const item = /^[-•] (.*)$/.exec(linha);
    if (item) {
      if (!lista) { lista = doc.createElement("ul"); lista.className = "my-1 list-disc pl-6"; nos.push(lista); }
      const li = doc.createElement("li");
      inline(doc, li, item[1] ?? "", removivel, aviso);
      lista.appendChild(li);
      continue;
    }
    lista = null;
    const div = doc.createElement("div");
    if (linha === "") div.appendChild(doc.createElement("br"));
    else inline(doc, div, linha, removivel, aviso);
    nos.push(div);
  }
  raiz.replaceChildren(...nos);
}

/** Atualiza o aviso das etiquetas que já estão na tela (quando as ferramentas ligadas mudam), sem mexer no cursor. */
export function atualizarAvisos(raiz: HTMLElement, aviso: (linha: string) => string | null): void {
  raiz.querySelectorAll<HTMLElement>("[data-acao]").forEach((chip) => {
    const linha = chip.getAttribute("data-linha") ?? "";
    const a = aviso(linha);
    chip.classList.toggle("ring-1", !!a);
    chip.classList.toggle("ring-amber-500", !!a);
    if (a) chip.title = a; else chip.removeAttribute("title");
    const ic = chip.firstElementChild;
    if (ic) ic.textContent = a ? "⚠" : rotuloDaAcao(linha).icone;
  });
}

export const EditorComChips = React.forwardRef<
  ManejoDoEditor,
  {
    value: string;
    onChange: (v: string) => void;
    onArroba?: (alvo: AlvoDoArroba | null) => void;
    /** O que falta para uma ação funcionar (ferramenta desligada): a etiqueta mostra o aviso. */
    aviso?: (linha: string) => string | null;
    disabled?: boolean;
    invalid?: boolean;
    placeholder?: string;
    className?: string;
  }
>(function EditorComChips({ value, onChange, onArroba, aviso, disabled, invalid, placeholder, className }, ref) {
  const raiz = React.useRef<HTMLDivElement>(null);
  // Os textos que ESTE campo já devolveu a quem o usa. O estado de quem usa chega depois (React agrupa as atualizações): se o valor que chega é um que o
  // próprio campo emitiu, a tela já está certa e NÃO se redesenha (redesenhar no meio da digitação joga o cursor para o começo).
  const emitidos = React.useRef<Set<string>>(new Set());
  const salvo = React.useRef<Range | null>(null);
  const avisoRef = React.useRef(aviso);
  avisoRef.current = aviso;
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
    desenharNoEditor(el, value, !disabled, avisoRef.current);
    emitidos.current = new Set([value]);
  }, [value, disabled]);

  // as ferramentas ligadas mudaram: só atualiza o aviso das etiquetas
  React.useEffect(() => {
    if (raiz.current && aviso) atualizarAvisos(raiz.current, aviso);
  }, [aviso]);

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
    const m = /(^|[\s​])@([^\s@​]{0,20})$/.exec(ate);
    if (!m) { onArroba(null); return; }
    onArroba({ no: no as Text, inicio: sel.anchorOffset - (m[2]?.length ?? 0) - 1, fim: sel.anchorOffset, consulta: m[2] ?? "" });
  };

  const comando = (nome: "bold" | "italic" | "insertUnorderedList") => {
    raiz.current?.focus();
    document.execCommand(nome, false);
    emitir();
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
      frag.append(document.createTextNode(ZWSP), criarChip(document, linha, !disabled, avisoRef.current?.(linha) ?? null), depois);
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

  const botao = "rounded px-2 py-0.5 text-sm hover:bg-muted disabled:opacity-40";
  return (
    <div className={cn("rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring", invalid && "border-destructive", disabled && "opacity-60")}>
      <div role="toolbar" aria-label="Formatação" className="flex items-center gap-0.5 border-b px-1.5 py-1">
        <button type="button" data-testid="fmt-negrito" title="Negrito (Ctrl+B)" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => comando("bold")} className={cn(botao, "font-bold")}>B</button>
        <button type="button" data-testid="fmt-italico" title="Itálico (Ctrl+I)" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => comando("italic")} className={cn(botao, "italic")}>I</button>
        <button type="button" data-testid="fmt-itens" title="Lista de itens" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => comando("insertUnorderedList")} className={botao}>≡ Itens</button>
      </div>
      <div
        ref={raiz}
        role="textbox"
        aria-multiline="true"
        aria-invalid={invalid || undefined}
        data-testid="editor-com-etiquetas"
        data-placeholder={placeholder}
        contentEditable={!disabled}
        suppressContentEditableWarning
        spellCheck={false}
        onInput={() => { emitir(); olharArroba(); }}
        onKeyUp={() => { guardarSelecao(); }}
        onMouseUp={guardarSelecao}
        onBlur={guardarSelecao}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
        onClick={(e) => {
          const alvo = (e.target as HTMLElement).closest("[data-remover]");
          if (!alvo || disabled) return;
          alvo.closest("[data-acao]")?.remove();
          emitir();
        }}
        className={cn(
          "max-h-[28rem] min-h-[16rem] w-full overflow-y-auto whitespace-pre-wrap break-words p-3 text-sm leading-7 outline-none",
          "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
          className,
        )}
      />
    </div>
  );
});

