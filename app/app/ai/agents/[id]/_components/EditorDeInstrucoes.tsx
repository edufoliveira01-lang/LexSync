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
import { cn } from "@/lib/utils";

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

export interface AcaoInserivel { id: string; grupo: "Mensagem e conversa" | "Ações no CRM" | "Consulta"; rotulo: string; linha: string }

/** As ações do menu `@`. O bloco inserido diz ao modelo o que executar e que isso nunca vai ao cliente; ‹…› marca o que a pessoa preenche. */
export const ACOES: readonly AcaoInserivel[] = [
  { id: "mensagem", grupo: "Mensagem e conversa", rotulo: "Enviar uma mensagem pronta", linha: "Envie ao cliente, exatamente assim: “‹texto da mensagem›”" },
  { id: "chamar_equipe", grupo: "Mensagem e conversa", rotulo: "Chamar a equipe (passar a conversa)", linha: "Passe a conversa para a equipe, com um resumo curto do que já foi dito. Só diga ao cliente que encaminhou depois da confirmação." },
  { id: "retorno", grupo: "Mensagem e conversa", rotulo: "Agendar um retorno", linha: "Agende um retorno para ‹quando› e retome o assunto com gentileza." },
  { id: "etiqueta_add", grupo: "Ações no CRM", rotulo: "Adicionar etiqueta", linha: "Etiqueta: ‹nome da etiqueta›" },
  { id: "etiqueta_rem", grupo: "Ações no CRM", rotulo: "Remover etiqueta", linha: "Remover etiqueta: ‹nome da etiqueta›" },
  { id: "etapa", grupo: "Ações no CRM", rotulo: "Mudar etapa no CRM", linha: "Etapa: ‹funil › etapa›" },
  { id: "responsavel", grupo: "Ações no CRM", rotulo: "Transferir para um responsável", linha: "Responsável: ‹nome da pessoa›" },
  { id: "notificar", grupo: "Ações no CRM", rotulo: "Notificar a equipe", linha: "Notificar equipe: ‹mensagem ou nome do aviso›" },
  { id: "dados", grupo: "Ações no CRM", rotulo: "Gravar um dado do cliente", linha: "Grave no cadastro o que o cliente informou (nome, CPF, endereço…)." },
  { id: "contrato", grupo: "Ações no CRM", rotulo: "Enviar o contrato para assinar", linha: "Envie o contrato para assinatura (somente depois da confirmação dos dados pelo cliente)." },
  { id: "base", grupo: "Consulta", rotulo: "Consultar a base jurídica", linha: "Consulte a base jurídica sobre ‹tema› e responda com base na ficha." },
];

/** O bloco que entra no texto quando se escolhe uma ação. */
export const blocoDaAcao = (a: AcaoInserivel): string => `\n⚙ AÇÃO — execute uma única vez; nunca mostre isto ao cliente:\n${a.linha}\n`;

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

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function EditorDeInstrucoes({
  value,
  onChange,
  disabled,
  invalid,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
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

  const filtradas = React.useMemo(() => {
    const q = norm(menu?.consulta ?? "").trim();
    return ACOES.filter((a) => !q || norm(a.rotulo).includes(q) || norm(a.grupo).includes(q));
  }, [menu]);

  const inserir = (a: AcaoInserivel) => {
    const el = ref.current;
    if (!el || !menu) return;
    const texto = partes[aba];
    const fim = el.selectionStart ?? texto.length;
    const novo = texto.slice(0, menu.inicio) + blocoDaAcao(a) + texto.slice(fim);
    atualizar(aba, novo);
    setMenu(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = menu.inicio + blocoDaAcao(a).length;
      el.setSelectionRange(pos, pos);
    });
  };

  const dica = ABAS.find((x) => x.id === aba)!.dica;
  const grupos = [...new Set(filtradas.map((a) => a.grupo))];

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
      <p className="text-xs text-muted-foreground">{t(dica)}</p>

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
            if (e.key === "Enter" && filtradas[0]) { e.preventDefault(); inserir(filtradas[0]); }
          }}
          disabled={disabled}
          rows={aba === "roteiro" ? 16 : 10}
          /* SEM `maxLength`: o atributo corta a colagem em silêncio (ver o teste agent-form-prompt-nao-trunca). */
          spellCheck={false}
          placeholder={aba === "faq" ? "Pergunta: …\nResposta: …" : undefined}
          className="font-mono text-xs"
          aria-invalid={invalid || undefined}
        />
        {menu && filtradas.length > 0 ? (
          <div role="listbox" data-testid="menu-de-acoes" className="absolute left-2 top-8 z-30 max-h-72 w-72 overflow-y-auto rounded-lg border bg-popover p-1 text-sm shadow-lg">
            <p className="px-2 py-1 text-[11px] text-muted-foreground">{t("Inserir uma ação no texto")} · Enter · Esc</p>
            {grupos.map((g) => (
              <div key={g}>
                <p className="px-2 pb-0.5 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t(g)}</p>
                {filtradas.filter((a) => a.grupo === g).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    data-testid={`acao-${a.id}`}
                    onMouseDown={(e) => { e.preventDefault(); inserir(a); }}
                    className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-muted"
                  >
                    {t(a.rotulo)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
