"use client";
/**
 * Fork Sales — o campo de instruções do agente em TRÊS partes, com texto formatado e AÇÕES coloridas no meio do texto.
 *
 *   Roteiro: o que o agente faz e fala, do começo ao fim, com as ações (etapa do funil, etiqueta, consultas, contrato, equipe…).
 *   Regras:  limites e comportamento (o que nunca faz, tom, exceções).
 *   FAQ:     perguntas frequentes, com as respostas aprovadas pelo escritório.
 *
 * Nada muda no que é gravado: continua UM texto (`system_prompt`). As partes são separadas por linhas-marca (`=== REGRAS ===`, `=== FAQ … ===`); um texto
 * antigo, sem marcas, abre inteiro no Roteiro. Entre Regras e FAQ o campo mantém sozinho a LEGENDA das ações usadas (como o agente executa cada uma): ninguém
 * precisa escrevê-la.
 */
import * as React from "react";

import { Textarea } from "@/components/ui/textarea";
import type { FunilDaResposta } from "@/hooks/pipelines/usePipelines";
import { cn } from "@/lib/utils";

import { defDaAcao, ferramentaLigada, legendaDasAcoes, linhaDaAcao, rotuloDaFerramenta, tipoDaLinha } from "./chips-do-roteiro";
import { EditorComChips, type AlvoDoArroba, type ManejoDoEditor } from "./EditorComChips";
import { MenuDeAcoes, type TipoDeAcao } from "./MenuDeAcoes";

export const MARCA_REGRAS = "=== REGRAS ===";
export const MARCA_LEGENDA = "=== COMO EXECUTAR AS AÇÕES (automático) ===";
export const MARCA_FAQ = "=== FAQ (respostas aprovadas) ===";

export interface PartesDoTexto { roteiro: string; regras: string; faq: string }

/** Separa o texto gravado nas três partes. Sem marcas, tudo é Roteiro. A legenda automática não é uma parte: é refeita a cada gravação. */
export function separarPartes(texto: string): PartesDoTexto {
  const partes: Record<keyof PartesDoTexto | "legenda", string[]> = { roteiro: [], regras: [], faq: [], legenda: [] };
  let atual: keyof typeof partes = "roteiro";
  for (const l of texto.split("\n")) {
    const t = l.trim();
    if (t === MARCA_REGRAS) { atual = "regras"; continue; }
    if (t === MARCA_LEGENDA) { atual = "legenda"; continue; }
    if (t === MARCA_FAQ) { atual = "faq"; continue; }
    partes[atual].push(l);
  }
  const lim = (a: string[]) => a.join("\n").replace(/^\n+|\n+$/g, "");
  return { roteiro: lim(partes.roteiro), regras: lim(partes.regras), faq: lim(partes.faq) };
}

/** Junta as partes no texto único que o agente recebe, com a legenda das ações usadas entre as Regras e a FAQ. Parte vazia não deixa marca. */
export function juntarPartes(p: PartesDoTexto): string {
  const blocos = [p.roteiro.replace(/\n+$/g, "")];
  if (p.regras.trim()) blocos.push(`${MARCA_REGRAS}\n${p.regras.replace(/\n+$/g, "")}`);
  const legenda = legendaDasAcoes(`${p.roteiro}\n${p.regras}`);
  if (legenda) blocos.push(`${MARCA_LEGENDA}\n${legenda}`);
  if (p.faq.trim()) blocos.push(`${MARCA_FAQ}\n${p.faq.replace(/\n+$/g, "")}`);
  return blocos.join("\n\n");
}

/** Há um `@` aberto logo antes do cursor? Devolve onde começa e o que já foi digitado depois dele (usado no modo "texto puro"). */
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
  { id: "roteiro", rotulo: "Roteiro", dica: "O que o agente faz e fala, do começo ao fim. Use ＋ Inserir ação (ou digite @) para colocar uma ação no meio do texto." },
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
  toolIds,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  funis?: readonly FunilDaResposta[];
  /** As ferramentas ligadas em "O que ele faz": ação que depende de ferramenta desligada ganha um aviso na etiqueta. */
  toolIds?: readonly string[];
  t: (s: string) => string;
}) {
  const partes = React.useMemo(() => separarPartes(value), [value]);
  const [aba, setAba] = React.useState<IdDaAba>("roteiro");
  // Nos testes (jsdom não edita `contenteditable`), o campo abre em texto puro; o editor formatado tem os próprios testes e a verificação no navegador.
  const [modoTexto, setModoTexto] = React.useState(process.env.NODE_ENV === "test");
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const editor = React.useRef<ManejoDoEditor>(null);
  const caixa = React.useRef<HTMLDivElement>(null);
  const [menu, setMenu] = React.useState<{ inicio: number; consulta: string; alvo?: AlvoDoArroba } | null>(null);
  const visual = !modoTexto;
  const comAcoes = aba !== "faq";

  const atualizar = (parte: IdDaAba, texto: string) => onChange(juntarPartes({ ...partes, [parte]: texto }));
  const fechar = React.useCallback(() => setMenu(null), []);

  const aviso = React.useMemo(() => {
    if (!toolIds) return undefined;
    return (linha: string): string | null => {
      const tipo = tipoDaLinha(linha);
      if (!tipo) return null;
      const faltam = defDaAcao(tipo).ferramentas.filter((f) => !ferramentaLigada(f, toolIds));
      if (faltam.length === 0) return null;
      const dasConsultas = faltam.some((f) => f.startsWith("mcp_externo:"));
      const onde = dasConsultas ? t("Ligue em “Avançado” (consultas do Sales) ou em “O que ele faz”:") : t("Ligue em “O que ele faz”:");
      return `${t("Esta ação precisa de uma ferramenta que está desligada.")} ${onde} ${faltam.map(rotuloDaFerramenta).join(", ")}`;
    };
  }, [toolIds, t]);

  const verArroba = (el: HTMLTextAreaElement) => {
    if (!comAcoes) { setMenu(null); return; }
    setMenu(arrobaAberta(el.value, el.selectionStart ?? el.value.length));
  };

  const inserir = (tipo: TipoDeAcao, valor: string) => {
    if (!menu) return;
    const linha = linhaDaAcao(tipo, valor);
    if (visual) {
      editor.current?.inserir(linha, menu.alvo ?? null);
      setMenu(null);
      return;
    }
    const el = ref.current;
    const texto = partes[aba];
    const fim = el?.selectionStart ?? menu.inicio;
    const bloco = `[[${linha}]]`;
    atualizar(aba, texto.slice(0, menu.inicio) + bloco + texto.slice(Math.max(fim, menu.inicio)));
    setMenu(null);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = menu.inicio + bloco.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const dica = ABAS.find((x) => x.id === aba)!.dica;
  const legenda = legendaDasAcoes(`${partes.roteiro}\n${partes.regras}`);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
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
        {comAcoes ? (
          <button
            type="button"
            data-testid="inserir-acao"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (menu ? setMenu(null) : setMenu({ inicio: ref.current?.selectionStart ?? 0, consulta: "" }))}
            className="rounded-full border px-3 py-1 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            ＋ {t("Inserir ação")}
          </button>
        ) : null}
        <button
          type="button"
          data-testid="instrucoes-modo-texto"
          onClick={() => { setModoTexto((v) => !v); setMenu(null); }}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {modoTexto ? t("Ver formatado") : t("Ver como texto")}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{t(dica)}</p>

      <div className="relative" ref={caixa}>
        {visual ? (
          <EditorComChips
            key={aba}
            ref={editor}
            value={partes[aba]}
            onChange={(v) => atualizar(aba, v)}
            onArroba={comAcoes ? (alvo) => setMenu(alvo ? { inicio: alvo.inicio, consulta: alvo.consulta, alvo } : null) : undefined}
            aviso={aviso}
            disabled={disabled}
            invalid={invalid}
            placeholder={aba === "faq" ? t("Pergunta: …  Resposta: …") : t("Escreva aqui o que o agente deve fazer e dizer…")}
          />
        ) : (
          <Textarea
            key={aba}
            ref={ref}
            value={partes[aba]}
            onChange={(e) => { atualizar(aba, e.target.value); verArroba(e.target); }}
            onKeyUp={(e) => { if (e.key !== "Escape") verArroba(e.currentTarget); }}
            onClick={(e) => verArroba(e.currentTarget)}
            disabled={disabled}
            rows={aba === "roteiro" ? 16 : 10}
            /* SEM `maxLength`: o atributo corta a colagem em silêncio (ver o teste agent-form-prompt-nao-trunca). */
            spellCheck={false}
            placeholder={aba === "faq" ? "Pergunta: …\nResposta: …" : undefined}
            className="font-mono text-xs"
            aria-invalid={invalid || undefined}
          />
        )}
        {menu && comAcoes ? <MenuDeAcoes funis={funis} onInserir={inserir} onFechar={fechar} ancora={caixa} t={t} /> : null}
      </div>
      {legenda ? (
        <details className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground" data-testid="legenda-das-acoes">
          <summary className="cursor-pointer select-none">{t("A legenda das ações é mantida automaticamente no texto do agente (só das ações que você usou). Ver")}</summary>
          <pre className="mt-2 whitespace-pre-wrap font-sans">{legenda}</pre>
        </details>
      ) : null}
    </div>
  );
}
