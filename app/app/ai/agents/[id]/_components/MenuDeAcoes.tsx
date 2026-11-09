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
import { ChatsCircle, ClipboardText, Clock, Gauge, Kanban, ListChecks, Robot, Users } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export type TipoDeAcao = "mensagem" | "chamar_equipe" | "retorno" | "etiqueta_add" | "etiqueta_rem" | "etapa" | "responsavel" | "notificar" | "dados" | "contrato" | "base";

interface DefDaAcao { id: TipoDeAcao; grupo: string; rotulo: string; dica: string; icone: React.ComponentType<{ className?: string }>; escolhe: boolean }

export const DEFS: readonly DefDaAcao[] = [
  { id: "mensagem", grupo: "Mensagem e conversa", rotulo: "Enviar uma mensagem pronta", dica: "Um texto exato para o cliente", icone: ChatsCircle, escolhe: true },
  { id: "chamar_equipe", grupo: "Mensagem e conversa", rotulo: "Chamar a equipe", dica: "Passa a conversa para uma pessoa", icone: Users, escolhe: false },
  { id: "retorno", grupo: "Mensagem e conversa", rotulo: "Agendar um retorno", dica: "Voltar a falar depois", icone: Clock, escolhe: true },
  { id: "etiqueta_add", grupo: "Ações no CRM", rotulo: "Adicionar etiqueta", dica: "Marca o contato", icone: ListChecks, escolhe: true },
  { id: "etiqueta_rem", grupo: "Ações no CRM", rotulo: "Remover etiqueta", dica: "Tira uma marca", icone: ListChecks, escolhe: true },
  { id: "etapa", grupo: "Ações no CRM", rotulo: "Mudar etapa no funil", dica: "Move o negócio de coluna", icone: Kanban, escolhe: true },
  { id: "responsavel", grupo: "Ações no CRM", rotulo: "Transferir para uma pessoa", dica: "Define o responsável", icone: Users, escolhe: true },
  { id: "notificar", grupo: "Ações no CRM", rotulo: "Avisar a equipe", dica: "Manda um aviso interno", icone: Robot, escolhe: true },
  { id: "dados", grupo: "Ações no CRM", rotulo: "Gravar dados do cliente", dica: "Nome, CPF, endereço…", icone: ClipboardText, escolhe: false },
  { id: "contrato", grupo: "Ações no CRM", rotulo: "Enviar o contrato", dica: "Link de assinatura", icone: ClipboardText, escolhe: false },
  { id: "base", grupo: "Consulta", rotulo: "Consultar a base jurídica", dica: "Responder com a ficha do tema", icone: Gauge, escolhe: true },
];

/** A linha de texto que cada ação deixa no roteiro (com o que a pessoa escolheu). */
export function linhaDaAcao(tipo: TipoDeAcao, valor = ""): string {
  switch (tipo) {
    case "mensagem": return `Envie ao cliente, exatamente assim: “${valor}”`;
    case "chamar_equipe": return "Passe a conversa para a equipe, com um resumo curto do que já foi dito. Só diga ao cliente que encaminhou depois da confirmação.";
    case "retorno": return `Agende um retorno ${valor || "para amanhã"} e retome o assunto com gentileza.`;
    case "etiqueta_add": return `Etiqueta: ${valor}`;
    case "etiqueta_rem": return `Remover etiqueta: ${valor}`;
    case "etapa": return `Etapa: ${valor}`;
    case "responsavel": return `Responsável: ${valor}`;
    case "notificar": return `Notificar equipe: ${valor}`;
    case "dados": return "Grave no cadastro o que o cliente informou (nome, CPF, endereço…).";
    case "contrato": return "Envie o contrato para assinatura (somente depois da confirmação dos dados pelo cliente).";
    case "base": return `Consulte a base jurídica sobre ${valor} e responda com base na ficha.`;
  }
}

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
  ["Em 1 hora", "em 1 hora"], ["Hoje à tarde", "para hoje à tarde"], ["Amanhã", "para amanhã"], ["Em 3 dias", "em 3 dias"], ["Em 1 semana", "em 1 semana"],
];

/** A coluna da direita: as opções da ação escolhida. */
function Opcoes({ tipo, funis, onEscolher, t }: { tipo: TipoDeAcao; funis: readonly FunilDaResposta[]; onEscolher: (v: string) => void; t: (s: string) => string }) {
  const [busca, setBusca] = React.useState("");
  const [funil, setFunil] = React.useState<FunilDaResposta | null>(null);
  const [texto, setTexto] = React.useState("");
  React.useEffect(() => { setBusca(""); setFunil(null); setTexto(""); }, [tipo]);

  const ehEtiqueta = tipo === "etiqueta_add" || tipo === "etiqueta_rem";
  const etiquetas = useQuery({
    queryKey: ["agente", "editor", "etiquetas"],
    queryFn: async () => ((await apiClient.get<{ data: { tag: string }[] }>("/api/v1/tags/vocabulario")).data ?? []).map((x) => x.tag),
    enabled: ehEtiqueta,
    staleTime: 60_000,
  });
  const pessoas = useAssignableMembers(tipo === "responsavel");
  const q = norm(busca);

  if (tipo === "etapa") {
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
  if (ehEtiqueta) {
    const lista = (etiquetas.data ?? []).filter((x) => !q || norm(x).includes(q));
    return (
      <div>
        <Busca valor={busca} onChange={setBusca} placeholder={t("Buscar etiqueta…")} auto />
        {etiquetas.isLoading ? <Vazio texto={t("Carregando as etiquetas…")} /> : lista.length === 0 ? <Vazio texto={t("Nenhuma etiqueta encontrada.")} /> : lista.map((x) => <Linha key={x} titulo={x} onClick={() => onEscolher(x)} />)}
      </div>
    );
  }
  if (tipo === "responsavel") {
    const lista = (pessoas.data ?? []).filter((m) => !q || norm(m.full_name ?? "").includes(q));
    return (
      <div>
        <Busca valor={busca} onChange={setBusca} placeholder={t("Buscar pessoa…")} auto />
        {pessoas.isLoading ? <Vazio texto={t("Carregando a equipe…")} /> : lista.length === 0 ? <Vazio texto={t("Ninguém encontrado.")} /> : lista.map((m) => <Linha key={m.user_id} titulo={m.full_name ?? t("Sem nome")} sub={m.role} onClick={() => onEscolher(m.full_name ?? "")} />)}
      </div>
    );
  }
  if (tipo === "retorno") return <div>{RETORNOS.map(([r, v]) => <Linha key={v} titulo={t(r)} onClick={() => onEscolher(v)} />)}</div>;
  if (tipo === "base") {
    const lista = FICHAS.filter((f) => !q || norm(f.titulo).includes(q));
    return (
      <div>
        <Busca valor={busca} onChange={setBusca} placeholder={t("Buscar tema…")} auto />
        {lista.map((f) => <Linha key={f.tema} titulo={f.titulo} onClick={() => onEscolher(f.titulo.split(" — ")[0] ?? f.titulo)} />)}
      </div>
    );
  }
  if (tipo === "mensagem" || tipo === "notificar") {
    return (
      <div className="space-y-2 p-1">
        <textarea
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          placeholder={tipo === "mensagem" ? t("Escreva a mensagem que o agente vai enviar…") : t("Escreva o aviso para a equipe…")}
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

/** O menu inteiro. `onInserir` recebe a ação e o valor escolhido; `onFechar` é Esc ou clique fora. */
export function MenuDeAcoes({ funis, onInserir, onFechar, t }: { funis: readonly FunilDaResposta[]; onInserir: (tipo: TipoDeAcao, valor: string) => void; onFechar: () => void; t: (s: string) => string }) {
  const [busca, setBusca] = React.useState("");
  const [ativa, setAtiva] = React.useState<TipoDeAcao | null>(null);
  const q = norm(busca);
  const lista = DEFS.filter((d) => !q || norm(d.rotulo).includes(q) || norm(d.grupo).includes(q));
  const grupos = [...new Set(lista.map((d) => d.grupo))];
  const escolher = (d: DefDaAcao) => { if (d.escolhe) setAtiva(d.id); else onInserir(d.id, ""); };

  return (
    <div
      data-testid="menu-de-acoes"
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onFechar(); } }}
      className="absolute left-2 top-8 z-30 flex w-[34rem] max-w-[calc(100%-1rem)] overflow-hidden rounded-xl border bg-popover shadow-xl"
    >
      <div className="max-h-80 w-1/2 overflow-y-auto border-r p-2">
        <Busca valor={busca} onChange={setBusca} placeholder={t("Buscar ação…")} auto={!ativa} />
        {grupos.map((g) => (
          <div key={g}>
            <p className="px-2 pb-0.5 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t(g)}</p>
            {lista.filter((d) => d.grupo === g).map((d) => {
              const Icone = d.icone;
              return (
                <button
                  key={d.id}
                  type="button"
                  data-testid={`acao-${d.id}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolher(d)}
                  className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted", ativa === d.id && "bg-muted")}
                >
                  <Icone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{t(d.rotulo)}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{t(d.dica)}</span>
                  </span>
                  {d.escolhe ? <span aria-hidden className="text-muted-foreground">›</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="max-h-80 w-1/2 overflow-y-auto p-2">
        {ativa ? <Opcoes tipo={ativa} funis={funis} onEscolher={(v) => onInserir(ativa, v)} t={t} /> : <Vazio texto={t("Escolha uma ação à esquerda. As opções aparecem aqui.")} />}
      </div>
    </div>
  );
}
