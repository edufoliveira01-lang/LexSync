"use client";
/**
 * Fork Sales — a tela do agente em SEÇÕES LATERAIS.
 *
 * Antes: uma rolagem única com ~20 cartões. Agora: um menu na lateral (Quem é, Como ele fala, O que ele faz, O que ele sabe, Onde atende,
 * Quando chama a equipe, Retornos, Modelo e limites, Avançado) e UMA seção por vez. O formulário continua um só (um salvar só): as seções são
 * só uma forma de mostrar. Os blocos ficam montados e só ficam escondidos (`hidden`), então nada perde estado e os testes continuam achando tudo.
 */
import * as React from "react";

import { ChatsCircle, ClipboardText, Clock, Gauge, Gear, ListChecks, PlugsConnected, Robot, Users } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export type IdDaSecao = "identidade" | "instrucoes" | "capacidades" | "conhecimento" | "canais" | "equipe" | "retornos" | "modelo" | "avancado";

export interface DefinicaoDaSecao { id: IdDaSecao; rotulo: string; dica: string; icone: React.ComponentType<{ className?: string; size?: number }> }

/** Os rótulos dizem o que a seção FAZ pelo cliente do escritório, não o nome técnico. */
export const SECOES: readonly DefinicaoDaSecao[] = [
  { id: "identidade", rotulo: "Quem é", dica: "Nome, descrição e público", icone: Robot },
  { id: "instrucoes", rotulo: "Como ele fala", dica: "Instruções, estilo e voz", icone: ChatsCircle },
  { id: "capacidades", rotulo: "O que ele faz", dica: "Ações que o agente pode executar", icone: ListChecks },
  { id: "conhecimento", rotulo: "O que ele sabe", dica: "Materiais, skills e fotos", icone: ClipboardText },
  { id: "canais", rotulo: "Onde atende", dica: "WhatsApp e gatilhos", icone: PlugsConnected },
  { id: "equipe", rotulo: "Quando chama a equipe", dica: "Passagem para uma pessoa", icone: Users },
  { id: "retornos", rotulo: "Retornos", dica: "Follow-up de quem esfriou", icone: Clock },
  { id: "modelo", rotulo: "Modelo e limites", dica: "IA, chave e limites de uso", icone: Gauge },
  { id: "avancado", rotulo: "Avançado", dica: "Celular, servidores externos", icone: Gear },
];

const Ctx = React.createContext<{ ativa: IdDaSecao; escolher: (id: IdDaSecao) => void }>({ ativa: "identidade", escolher: () => undefined });

/** Uma frase, em linguagem de quem usa, do que se resolve em cada seção. */
export const DESCRICAO_DA_SECAO: Record<IdDaSecao, string> = {
  identidade: "Como este agente se chama e para quem ele atende.",
  instrucoes: "O texto que diz ao agente quem ele é, como fala e o que nunca faz. Dá para escrever à mão ou usar o texto pronto do escritório.",
  capacidades: "O que o agente consegue fazer sozinho durante o atendimento: só o que estiver ligado aqui.",
  conhecimento: "Onde ele busca informação (materiais do escritório, skills) e se ele vê as fotos que o cliente manda.",
  canais: "Em qual WhatsApp ele atende e o que o faz entrar na conversa.",
  equipe: "Quando o agente para e chama uma pessoa, e como pede ajuda sem sair da conversa.",
  retornos: "Como ele volta a falar com quem parou de responder, sem insistir demais.",
  modelo: "A inteligência artificial usada, a chave de acesso e os limites de uso por conversa.",
  avancado: "Comandos pelo celular e servidores externos. Quem só quer ajustar o atendimento não precisa mexer aqui.",
};

export const ehSecaoValida = (v: string): v is IdDaSecao => SECOES.some((s) => s.id === v);

/** Qual seção abre primeiro: a do endereço (#capacidades), senão a primeira com erro, senão "Quem é". */
export function secaoInicial(hash: string, secaoComErro: IdDaSecao | null): IdDaSecao {
  const h = hash.replace(/^#/, "");
  if (ehSecaoValida(h)) return h;
  return secaoComErro ?? "identidade";
}

/** Em que seção mora cada campo com validação (para o ponto vermelho do menu). */
export function secaoDoCampo(campo: string): IdDaSecao {
  if (campo === "name" || campo === "description" || campo === "priority" || campo === "public" || campo === "audience") return "identidade";
  if (campo === "system_prompt") return "instrucoes";
  if (campo === "tool_ids") return "capacidades";
  return "modelo";
}

export function ProvedorDaSecao({ ativa, escolher, children }: { ativa: IdDaSecao; escolher: (id: IdDaSecao) => void; children: React.ReactNode }) {
  const valor = React.useMemo(() => ({ ativa, escolher }), [ativa, escolher]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** O título e a frase da seção aberta, no alto do conteúdo. */
export function CabecalhoDaSecao({ t }: { t: (s: string) => string }) {
  const { ativa } = React.useContext(Ctx);
  const def = SECOES.find((x) => x.id === ativa)!;
  return (
    <header data-testid="cabecalho-da-secao" className="space-y-0.5">
      <h3 className="text-lg font-semibold tracking-tight">{t(def.rotulo)}</h3>
      <p className="text-sm text-muted-foreground">{t(DESCRICAO_DA_SECAO[ativa])}</p>
    </header>
  );
}

/** "Anterior" e "Próxima" no fim do conteúdo: dá para percorrer o agente do começo ao fim sem voltar ao menu. */
export function RodapeDaSecao({ t }: { t: (s: string) => string }) {
  const { ativa, escolher } = React.useContext(Ctx);
  const i = SECOES.findIndex((x) => x.id === ativa);
  const anterior = SECOES[i - 1];
  const proxima = SECOES[i + 1];
  return (
    <div className="mt-2 flex items-center justify-between border-t pt-3 text-sm">
      {anterior ? (
        <button type="button" data-testid="secao-anterior" onClick={() => escolher(anterior.id)} className="text-muted-foreground hover:text-foreground">
          ← {t(anterior.rotulo)}
        </button>
      ) : <span />}
      {proxima ? (
        <button type="button" data-testid="secao-proxima" onClick={() => escolher(proxima.id)} className="font-medium hover:underline">
          {t(proxima.rotulo)} →
        </button>
      ) : <span />}
    </div>
  );
}

/** Um bloco da tela que pertence a uma seção: some quando a seção não é a ativa (continua montado). */
export function Bloco({ secao, children }: { secao: IdDaSecao; children: React.ReactNode }) {
  const { ativa } = React.useContext(Ctx);
  return (
    <div data-secao={secao} className={secao === ativa ? "flex flex-col gap-4" : "hidden"}>
      {children}
    </div>
  );
}

export interface ResumoDaSecao { erro?: boolean; texto?: string }

/** O menu lateral (em telas estreitas vira uma faixa rolável no topo). */
export function MenuDasSecoes({
  ativa,
  onEscolher,
  resumos,
  t,
}: {
  ativa: IdDaSecao;
  onEscolher: (id: IdDaSecao) => void;
  resumos: Partial<Record<IdDaSecao, ResumoDaSecao>>;
  t: (s: string) => string;
}) {
  return (
    <nav aria-label={t("Seções do agente")} data-testid="menu-das-secoes" className="lg:sticky lg:top-4 lg:self-start">
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {SECOES.map((s) => {
          const Icone = s.icone;
          const r = resumos[s.id];
          const marcada = s.id === ativa;
          return (
            <li key={s.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                data-testid={`secao-${s.id}`}
                aria-current={marcada ? "page" : undefined}
                onClick={() => onEscolher(s.id)}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                  marcada ? "border-border bg-muted font-medium text-foreground shadow-sm" : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icone className={cn("h-4 w-4 shrink-0", marcada ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{t(s.rotulo)}</span>
                  <span className="hidden truncate text-[11px] font-normal text-muted-foreground lg:block">{r?.texto ?? t(s.dica)}</span>
                </span>
                {r?.erro ? <span aria-label={t("Há algo a corrigir nesta seção")} className="h-2 w-2 shrink-0 rounded-full bg-destructive" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
