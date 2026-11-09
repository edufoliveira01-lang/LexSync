"use client";
/**
 * Fork Sales — o campo de instruções do agente em TRÊS partes e com AÇÕES no meio do texto.
 *
 *   Roteiro: o que o agente faz e fala, do começo ao fim, com as ações (etiqueta, etapa do funil, chamar a equipe…).
 *   Regras:  limites e comportamento (o que nunca faz, tom, exceções).
 *   FAQ:     perguntas frequentes, com as respostas aprovadas pelo escritório.
 *
 * Nada muda no que é gravado: continua UM texto (`system_prompt`). As partes são separadas por duas linhas-marca (`=== REGRAS ===`, `=== FAQ ===`);
 * um texto antigo, sem marcas, abre inteiro no Roteiro. Digitar `@` abre a lista de ações, que entram no texto como um bloco claro para o modelo executar.
 */
import * as React from "react";

import { Textarea } from "@/components/ui/textarea";
import type { FunilDaResposta } from "@/hooks/pipelines/usePipelines";
import { cn } from "@/lib/utils";

import { linhaDaAcao, MenuDeAcoes, type TipoDeAcao } from "./MenuDeAcoes";

export const MARCA_REGRAS = "=== REGRAS ===";
export const MARCA_FAQ = "=== FAQ (respostas aprovadas) ===";

export interface PartesDoTexto { roteiro: string; regras: string; faq: string }

/** Separa o texto gravado nas três partes. Sem marcas, tudo é Roteiro. */
export function separarPartes(texto: string): PartesDoTexto {
  const linhas = texto.split("\n");
  const partes: Record<keyof PartesDoTexto, string[]> = { roteiro: [], regras: [], faq: [] };
  let atual: keyof PartesDoTexto = "roteiro";
  for (const l of linhas) {
    const t = l.trim();
    if (t === MARCA_REGRAS) { atual = "regras"; continue; }
    if (t === MARCA_FAQ) { atual = "faq"; continue; }
    partes[atual].push(l);
  }
  const lim = (a: string[]) => a.join("\n").replace(/^\n+|\n+$/g, "");
  return { roteiro: lim(partes.roteiro), regras: lim(partes.regras), faq: lim(partes.faq) };
}

/** Junta as três partes no texto único que o agente recebe. Parte vazia não deixa marca. */
export function juntarPartes(p: PartesDoTexto): string {
  const blocos = [p.roteiro.replace(/\n+$/g, "")];
  if (p.regras.trim()) blocos.push(`${MARCA_REGRAS}\n${p.regras.replace(/\n+$/g, "")}`);
  if (p.faq.trim()) blocos.push(`${MARCA_FAQ}\n${p.faq.replace(/\n+$/g, "")}`);
  return blocos.join("\n\n");
}

/** O bloco que entra no roteiro quando se escolhe uma ação: manda executar uma vez e nunca mostrar ao cliente. */
export const CABECALHO_DA_ACAO = "⚙ AÇÃO — execute uma única vez; nunca mostre isto ao cliente:";
export const blocoDaAcao = (tipo: TipoDeAcao, valor = ""): string => `\n${CABECALHO_DA_ACAO}\n${linhaDaAcao(tipo, valor)}\n`;

export interface AcaoDoTexto { inicio: number; fim: number; linha: string }

/** As ações que já estão no texto (para mostrar como etiquetas clicáveis e poder tirar). */
export function acoesDoTexto(texto: string): AcaoDoTexto[] {
  const out: AcaoDoTexto[] = [];
  const rx = new RegExp(`\\n?${CABECALHO_DA_ACAO.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n([^\\n]*)\\n?`, "g");
  let m: RegExpExecArray | null;
  while ((m = rx.exec(texto)) !== null) out.push({ inicio: m.index, fim: m.index + m[0].length, linha: (m[1] ?? "").trim() });
  return out;
}

/** Tira uma ação do texto, sem deixar linha vazia sobrando. */
export function tirarAcao(texto: string, a: AcaoDoTexto): string {
  return (texto.slice(0, a.inicio) + (texto[a.inicio - 1] === "\n" || a.inicio === 0 ? "" : "\n") + texto.slice(a.fim)).replace(/\n{3,}/g, "\n\n");
}

/** Há um `@` aberto logo antes do cursor? Devolve onde começa e o que já foi digitado depois dele. */
export function arrobaAberta(texto: string, cursor: number): { inicio: number; consulta: string } | null {
  const ate = texto.slice(0, cursor);
  const i = ate.lastIndexOf("@");
  if (i < 0) return null;
  const consulta = ate.slice(i + 1);
  if (/\s/.test(consulta) && consulta.trim().length > 20) return null;
  if (/\n/.test(consulta)) return null;
  if (i > 0 && !/\s/.test(ate[i - 1]!)) return null; // e-mail ou palavra colada: não abre
  return { inicio: i, consulta };
}

const ABAS = [
  { id: "roteiro", rotulo: "Roteiro", dica: "O que o agente faz e fala, do começo ao fim. Digite @ para inserir uma ação no meio do texto." },
  { id: "regras", rotulo: "Regras", dica: "Limites e comportamento: o que ele nunca faz, o tom, as exceções." },
  { id: "faq", rotulo: "FAQ", dica: "Perguntas frequentes com as respostas aprovadas pelo escritório. Escreva “Pergunta:” e “Resposta:”." },
] as const;
type IdDaAba = (typeof ABAS)[number]["id"];

export function EditorDeInstrucoes({
  value,
  onChange,
  disabled,
  invalid,
  funis = [],
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  funis?: readonly FunilDaResposta[];
  t: (s: string) => string;
}) {
  const partes = React.useMemo(() => separarPartes(value), [value]);
  const [aba, setAba] = React.useState<IdDaAba>("roteiro");
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = React.useState<{ inicio: number; consulta: string } | null>(null);

  const atualizar = (parte: IdDaAba, texto: string) => onChange(juntarPartes({ ...partes, [parte]: texto }));

  const verArroba = (el: HTMLTextAreaElement) => {
    if (aba === "faq") { setMenu(null); return; }
    setMenu(arrobaAberta(el.value, el.selectionStart ?? el.value.length));
  };

  const abrirNoCursor = () => {
    const el = ref.current;
    const pos = el?.selectionStart ?? partes[aba].length;
    setMenu({ inicio: pos, consulta: "" });
  };

  const inserir = (tipo: TipoDeAcao, valor: string) => {
    const el = ref.current;
    if (!menu) return;
    const texto = partes[aba];
    const fim = el?.selectionStart ?? menu.inicio;
    const bloco = blocoDaAcao(tipo, valor);
    const novo = texto.slice(0, menu.inicio) + bloco + texto.slice(Math.max(fim, menu.inicio));
    atualizar(aba, novo);
    setMenu(null);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = menu.inicio + bloco.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const acoes = React.useMemo(() => (aba === "faq" ? [] : acoesDoTexto(partes[aba])), [aba, partes]);

  const dica = ABAS.find((x) => x.id === aba)!.dica;

  return (
    <div className="space-y-2">
      <div role="tablist" aria-label={t("Partes das instruções")} className="inline-flex gap-1 rounded-lg bg-muted p-1">
        {ABAS.map((a) => {
          const cheia = a.id === "roteiro" ? partes.roteiro.trim().length > 0 : a.id === "regras" ? partes.regras.trim().length > 0 : partes.faq.trim().length > 0;
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              data-testid={`instrucoes-${a.id}`}
              onClick={() => { setAba(a.id); setMenu(null); }}
              className={cn("rounded-md px-3 py-1 text-sm transition-colors", aba === a.id ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {t(a.rotulo)}
              {cheia && aba !== a.id ? <span aria-hidden className="ml-1 text-[10px] text-muted-foreground">●</span> : null}
            </button>
          );
        })}
      </div>
      {aba !== "faq" ? (
        <button
          type="button"
          data-testid="inserir-acao"
          disabled={disabled}
          onClick={abrirNoCursor}
          className="ml-2 rounded-full border px-3 py-1 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          ＋ {t("Inserir ação")}
        </button>
      ) : null}
      <p className="text-xs text-muted-foreground">{t(dica)} {aba !== "faq" ? t("Ou digite @.") : ""}</p>

      <div className="relative">
        <Textarea
          key={aba}
          ref={ref}
          value={partes[aba]}
          onChange={(e) => { atualizar(aba, e.target.value); verArroba(e.target); }}
          onKeyUp={(e) => { if (e.key !== "Escape") verArroba(e.currentTarget); }}
          onClick={(e) => verArroba(e.currentTarget)}
          onKeyDown={(e) => {
            if (!menu) return;
            if (e.key === "Escape") { e.preventDefault(); setMenu(null); }
          }}
          disabled={disabled}
          rows={aba === "roteiro" ? 16 : 10}
          /* SEM `maxLength`: o atributo corta a colagem em silêncio (ver o teste agent-form-prompt-nao-trunca). */
          spellCheck={false}
          placeholder={aba === "faq" ? "Pergunta: …\nResposta: …" : undefined}
          className="font-mono text-xs"
          aria-invalid={invalid || undefined}
        />
        {menu ? <MenuDeAcoes funis={funis} onInserir={inserir} onFechar={() => setMenu(null)} t={t} /> : null}
      </div>
      {acoes.length > 0 ? (
        <div data-testid="acoes-do-texto" className="rounded-lg border bg-muted/30 p-2">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("Ações neste texto")} · {acoes.length}</p>
          <ul className="flex flex-wrap gap-1.5">
            {acoes.map((a, i) => (
              <li key={`${a.inicio}-${i}`} className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background py-0.5 pl-2.5 pr-1 text-xs">
                <span className="truncate" title={a.linha}>⚙ {a.linha}</span>
                <button type="button" aria-label={t("Tirar esta ação")} onClick={() => atualizar(aba, tirarAcao(partes[aba], a))} className="rounded-full px-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">×</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
