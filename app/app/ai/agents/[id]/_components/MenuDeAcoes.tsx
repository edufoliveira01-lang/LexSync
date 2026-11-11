"use client";
/**
 * Fork Sales — o menu `@` do roteiro: TUDO POR CLIQUE, com os dados reais do CRM (funis e etapas, etiquetas, pessoas, temas da base jurídica).
 * Duas colunas: à esquerda, as ações; à direita, as opções da ação escolhida. Ninguém digita nome de etapa ou de etiqueta: escolhe na lista.
 * O que sai daqui é só o TEXTO da linha da ação; quem monta o bloco no roteiro é o `EditorDeInstrucoes`.
 */
import { useQuery } from "@tanstack/react-query";
import * as React from "react";

import { useAssignableMembers } from "@/hooks/inbox/useAssignableMembers";
import { useAgentMapping } from "@/hooks/pipelines/useAgentMapping";
import type { FunilDaResposta } from "@/hooks/pipelines/usePipelines";
import { apiClient } from "@/lib/api/client";
import { FICHAS } from "@/lib/sales/base-juridica/fichas";
import { cn } from "@/lib/utils";

import { ACOES, GRUPOS, type DefDaAcao, type TipoDeAcao } from "./chips-do-roteiro";

export type { TipoDeAcao };

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Busca({ valor, onChange, placeholder, auto }: { valor: string; onChange: (v: string) => void; placeholder: string; auto?: boolean }) {
  return (
    <input
      autoFocus={auto}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mb-1 w-full rounded-full border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

function Linha({ titulo, sub, onClick, seta }: { titulo: string; sub?: string; onClick: () => void; seta?: boolean }) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-muted">
      <span className="min-w-0">
        <span className="block truncate text-sm">{titulo}</span>
        {sub ? <span className="block truncate text-[11px] text-muted-foreground">{sub}</span> : null}
      </span>
      {seta ? <span aria-hidden className="text-muted-foreground">›</span> : null}
    </button>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="px-3 py-4 text-sm text-muted-foreground">{texto}</p>;
}

function EtapasDoFunil({ funil, onEscolher, t }: { funil: FunilDaResposta; onEscolher: (v: string) => void; t: (s: string) => string }) {
  const { data, isLoading } = useAgentMapping(funil.id);
  if (isLoading) return <Vazio texto={t("Carregando as etapas…")} />;
  const etapas = data?.etapas ?? [];
  if (etapas.length === 0) return <Vazio texto={t("Este funil ainda não tem etapas.")} />;
  return <>{etapas.map((e, i) => <Linha key={e.id} titulo={e.name} sub={`${t("Etapa")} ${i + 1}`} onClick={() => onEscolher(`${funil.name} › ${e.name}`)} />)}</>;
}

const RETORNOS: readonly [string, string][] = [
  ["Em 1 hora", "em 1 hora"], ["Hoje à tarde", "hoje à tarde"], ["Amanhã", "amanhã"], ["Em 3 dias", "em 3 dias"], ["Em 1 semana", "em 1 semana"],
];

/** A coluna da direita: as opções da ação escolhida. */
function Opcoes({ def, funis, onEscolher, t }: { def: DefDaAcao; funis: readonly FunilDaResposta[]; onEscolher: (v: string) => void; t: (s: string) => string }) {
  const [busca, setBusca] = React.useState("");
  const [funil, setFunil] = React.useState<FunilDaResposta | null>(null);
  const [texto, setTexto] = React.useState("");
  const [agente, setAgente] = React.useState<string | null>(null);
  React.useEffect(() => { setBusca(""); setFunil(null); setTexto(""); setAgente(null); }, [def.tipo]);
  const agentes = useQuery({
    queryKey: ["agente", "editor", "agentes-publicados"],
    queryFn: async () => {
      const r = await apiClient.get<{ data: { name: string; published_version_id?: string | null }[] }>("/api/v1/ai/agents");
      return (r.data ?? []).filter((a) => a.published_version_id).map((a) => a.name);
    },
    enabled: def.escolhe === "agente",
    staleTime: 60_000,
  });

  const etiquetas = useQuery({
    queryKey: ["agente", "editor", "etiquetas"],
    queryFn: async () => ((await apiClient.get<{ data: { tag: string }[] }>("/api/v1/tags/vocabulario")).data ?? []).map((x) => x.tag),
    enabled: def.escolhe === "etiqueta",
    staleTime: 60_000,
  });
  const pessoas = useAssignableMembers(def.escolhe === "pessoa");
  const q = norm(busca);

  if (def.escolhe === "agente") {
    if (agente !== null) {
      const lista = funis.filter((f) => !q || norm(f.name).includes(q));
      if (funil) {
        return (
          <div>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setFunil(null)} className="mb-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground">← {t("Funis")}</button>
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{funil.name}</p>
            <EtapasDoFunil funil={funil} onEscolher={(v) => onEscolher(`${agente} › ${v}`)} t={t} />
          </div>
        );
      }
      return (
        <div>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setAgente(null)} className="mb-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground">← {t("Agentes")}</button>
          <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{agente}</p>
          <Linha titulo={t("Só passar a conversa")} sub={t("O card fica onde está")} onClick={() => onEscolher(agente)} />
          <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("Ou levar o card para um funil")}</p>
          <Busca valor={busca} onChange={setBusca} placeholder={t("Buscar funil…")} />
          {lista.map((f) => <Linha key={f.id} titulo={f.name} seta onClick={() => setFunil(f)} />)}
        </div>
      );
    }
    const lista = (agentes.data ?? []).filter((a) => !q || norm(a).includes(q));
    return (
      <div>
        <Busca valor={busca} onChange={setBusca} placeholder={t("Buscar agente…")} auto />
        {agentes.isLoading ? <Vazio texto={t("Carregando os agentes…")} /> : lista.length === 0 ? <Vazio texto={t("Nenhum outro agente publicado encontrado.")} /> : lista.map((a) => <Linha key={a} titulo={a} seta onClick={() => setAgente(a)} />)}
      </div>
    );
  }
  if (def.escolhe === "etapa") {
    if (funil) {
      return (
        <div>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setFunil(null)} className="mb-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground">← {t("Funis")}</button>
          <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{funil.name}</p>
          <EtapasDoFunil funil={funil} onEscolher={onEscolher} t={t} />
        </div>
      );
    }
    const lista = funis.filter((f) => !q || norm(f.name).includes(q));
    return (
      <div>
        <Busca valor={busca} onChange={setBusca} placeholder={t("Buscar funil…")} auto />
        {lista.length === 0 ? <Vazio texto={t("Nenhum funil encontrado.")} /> : lista.map((f) => <Linha key={f.id} titulo={f.name} sub={f.is_default ? t("Funil padrão") : undefined} seta onClick={() => setFunil(f)} />)}
      </div>
    );
  }
  if (def.escolhe === "etiqueta") {
    const lista = (etiquetas.data ?? []).filter((x) => !q || norm(x).includes(q));
    return (
      <div>
        <Busca valor={busca} onChange={setBusca} placeholder={t("Buscar etiqueta…")} auto />
        {etiquetas.isLoading ? <Vazio texto={t("Carregando as etiquetas…")} /> : lista.length === 0 ? <Vazio texto={t("Nenhuma etiqueta encontrada.")} /> : lista.map((x) => <Linha key={x} titulo={x} onClick={() => onEscolher(x)} />)}
      </div>
    );
  }
  if (def.escolhe === "pessoa") {
    const lista = (pessoas.data ?? []).filter((m) => !q || norm(m.full_name ?? "").includes(q));
    return (
      <div>
        <Busca valor={busca} onChange={setBusca} placeholder={t("Buscar pessoa…")} auto />
        {pessoas.isLoading ? <Vazio texto={t("Carregando a equipe…")} /> : lista.length === 0 ? <Vazio texto={t("Ninguém encontrado.")} /> : lista.map((m) => <Linha key={m.user_id} titulo={m.full_name ?? t("Sem nome")} sub={m.role} onClick={() => onEscolher(m.full_name ?? "")} />)}
      </div>
    );
  }
  if (def.escolhe === "retorno") return <div>{RETORNOS.map(([r, v]) => <Linha key={v} titulo={t(r)} onClick={() => onEscolher(v)} />)}</div>;
  if (def.escolhe === "tema") {
    const lista = FICHAS.filter((f) => !q || norm(f.titulo).includes(q));
    return (
      <div>
        <Busca valor={busca} onChange={setBusca} placeholder={t("Buscar tema…")} auto />
        {lista.map((f) => <Linha key={f.tema} titulo={f.titulo} onClick={() => onEscolher(f.titulo.split(" — ")[0] ?? f.titulo)} />)}
      </div>
    );
  }
  if (def.escolhe === "texto") {
    return (
      <div className="space-y-2 p-1">
        <textarea
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          placeholder={def.tipo === "mensagem" ? t("Escreva a mensagem que o agente vai enviar…") : t("Escreva o aviso para a equipe…")}
          className="w-full rounded-lg border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button type="button" disabled={!texto.trim()} onMouseDown={(e) => e.preventDefault()} onClick={() => onEscolher(texto.trim())} className="w-full rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {t("Inserir no roteiro")}
        </button>
      </div>
    );
  }
  return null;
}

/**
 * O menu inteiro. `onInserir` recebe a ação e o valor escolhido. Fecha com o botão "Cancelar", com Esc e com um clique fora dele (`ancora`: o campo de texto,
 * que não conta como "fora"). Ações que não precisam de escolha entram direto.
 */
export function MenuDeAcoes({
  funis,
  onInserir,
  onFechar,
  ancora,
  t,
}: {
  funis: readonly FunilDaResposta[];
  onInserir: (tipo: TipoDeAcao, valor: string) => void;
  onFechar: () => void;
  ancora?: React.RefObject<HTMLElement | null>;
  t: (s: string) => string;
}) {
  const [busca, setBusca] = React.useState("");
  const [ativa, setAtiva] = React.useState<DefDaAcao | null>(null);
  const raiz = React.useRef<HTMLDivElement>(null);
  const q = norm(busca);
  const lista = ACOES.filter((d) => !q || norm(d.rotulo).includes(q) || norm(d.grupo).includes(q) || norm(d.dica).includes(q));

  React.useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onFechar(); } };
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (raiz.current?.contains(alvo) || ancora?.current?.contains(alvo)) return;
      onFechar();
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("mousedown", fora);
    return () => { document.removeEventListener("keydown", tecla); document.removeEventListener("mousedown", fora); };
  }, [onFechar, ancora]);

  const escolher = (d: DefDaAcao) => { if (d.escolhe !== "nenhuma") setAtiva(d); else onInserir(d.tipo, ""); };

  return (
    <div
      ref={raiz}
      data-testid="menu-de-acoes"
      className="absolute left-2 top-2 z-30 flex w-[36rem] max-w-[calc(100%-1rem)] overflow-hidden rounded-xl border bg-popover shadow-xl"
    >
      <div className="max-h-96 w-1/2 overflow-y-auto border-r p-2">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1"><Busca valor={busca} onChange={setBusca} placeholder={t("Buscar ação…")} auto={!ativa} /></div>
          <button type="button" data-testid="menu-cancelar" aria-label={t("Cancelar")} title={t("Cancelar (Esc)")} onMouseDown={(e) => e.preventDefault()} onClick={onFechar} className="mb-1 shrink-0 rounded-full border px-2.5 py-1 text-xs hover:bg-muted">✕ {t("Cancelar")}</button>
        </div>
        {GRUPOS.map((g) => {
          const itens = lista.filter((d) => d.grupo === g);
          if (itens.length === 0) return null;
          return (
            <div key={g}>
              <p className="px-2 pb-0.5 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t(g)}</p>
              {itens.map((d) => (
                <button
                  key={d.tipo}
                  type="button"
                  data-testid={`acao-${d.tipo}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolher(d)}
                  className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted", ativa?.tipo === d.tipo && "bg-muted")}
                >
                  <span aria-hidden className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs", d.cor)}>{d.icone}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{t(d.rotulo)}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{t(d.dica)}</span>
                  </span>
                  {d.escolhe !== "nenhuma" ? <span aria-hidden className="text-muted-foreground">›</span> : null}
                </button>
              ))}
            </div>
          );
        })}
        {lista.length === 0 ? <Vazio texto={t("Nenhuma ação encontrada.")} /> : null}
      </div>
      <div className="max-h-96 w-1/2 overflow-y-auto p-2">
        {ativa ? <Opcoes def={ativa} funis={funis} onEscolher={(v) => onInserir(ativa.tipo, v)} t={t} /> : <Vazio texto={t("Escolha uma ação à esquerda. As opções aparecem aqui.")} />}
      </div>
    </div>
  );
}
