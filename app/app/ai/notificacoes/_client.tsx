"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DADOS_DE_EXEMPLO, DESCRICAO_DO_MARCADOR, GATILHOS, MARCADORES, MAXIMO_DE_DESTINATARIOS, MAXIMO_DE_NOTIFICACOES,
  MENSAGEM_PADRAO, ROTULO_DO_GATILHO, TAMANHO_MAXIMO_DA_MENSAGEM, normalizarTelefone, renderizarMensagem,
  type ConfigDeNotificacoes, type Gatilho, type Notificacao,
} from "@/lib/notificacoes-equipe/config";

import {
  enviarTesteDeNotificacao, novoIdDeNotificacao, prepararCanalDeAvisos, salvarCentralDeNotificacoes,
  type EstadoDaCentral,
} from "./_actions";

const ERROS: Record<string, string> = {
  validation_failed: "Confira os campos: algum número ou texto está inválido.",
  canal_invalido: "Essa conexão não existe mais.",
  canal_com_agente: "Esse número atende clientes com um agente. Use outro número só para avisos.",
  sem_numero: "Digite um número válido, com DDD.",
  sem_conexao: "Escolha primeiro a conexão que envia os avisos.",
  forbidden_role: "Você não tem permissão para isso.",
  mfa_required: "Confirme a verificação em duas etapas e tente de novo.",
};
const msgErro = (e: string, detalhe?: string) => ERROS[e] ?? detalhe ?? "Não foi possível concluir. Tente de novo.";

const formatarNumero = (n: string) => {
  const d = n.replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : n;
};

export function CentralDeNotificacoes({ inicial }: { inicial: Extract<EstadoDaCentral, { ok: true }> }) {
  const [config, setConfig] = useState<ConfigDeNotificacoes>(inicial.config);
  const [canais, setCanais] = useState(inicial.canais);
  const [editando, setEditando] = useState<Notificacao | null>(null);
  const [pendente, iniciar] = useTransition();
  const canal = canais.find((c) => c.id === config.canal_id) ?? null;

  function gravar(proxima: ConfigDeNotificacoes, ok?: string) {
    iniciar(async () => {
      const r = await salvarCentralDeNotificacoes(proxima);
      if (r.ok) { setConfig(r.config); if (ok) toast.success(ok); } else toast.error(msgErro(r.error));
    });
  }

  function escolherCanal(id: string) {
    gravar({ ...config, canal_id: id || null }, "Conexão salva.");
  }

  function prepararAvisos() {
    if (!config.canal_id) return;
    iniciar(async () => {
      const r = await prepararCanalDeAvisos(config.canal_id!);
      if (r.ok) { setCanais((l) => l.map((c) => (c.id === config.canal_id ? { ...c, deAvisos: true } : c))); toast.success("Pronto: a IA não responde nesse número."); }
      else toast.error(msgErro(r.error));
    });
  }

  async function nova() {
    if (config.notificacoes.length >= MAXIMO_DE_NOTIFICACOES) return toast.error(`No máximo ${MAXIMO_DE_NOTIFICACOES} notificações.`);
    setEditando({ id: await novoIdDeNotificacao(), nome: "", ativa: true, gatilho: "passou_para_equipe", mensagem: MENSAGEM_PADRAO.passou_para_equipe, destinatarios: [] });
  }

  function salvarNotificacao(n: Notificacao) {
    const existe = config.notificacoes.some((x) => x.id === n.id);
    const lista = existe ? config.notificacoes.map((x) => (x.id === n.id ? n : x)) : [...config.notificacoes, n];
    setEditando(null);
    gravar({ ...config, notificacoes: lista }, "Notificação salva.");
  }

  const alternar = (n: Notificacao, ativa: boolean) => gravar({ ...config, notificacoes: config.notificacoes.map((x) => (x.id === n.id ? { ...x, ativa } : x)) });
  const excluir = (n: Notificacao) => { if (window.confirm(`Excluir "${n.nome}"?`)) gravar({ ...config, notificacoes: config.notificacoes.filter((x) => x.id !== n.id) }, "Notificação excluída."); };

  return (
    <Tabs defaultValue="notificacoes" className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
        <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
      </TabsList>

      <TabsContent value="notificacoes" className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3 p-4">
          <div>
            <h2 className="text-base font-semibold">Conexão que envia os avisos</h2>
            <p className="text-sm text-text-muted">
              Use um segundo número só para avisos. Conecte-o em Conexões (QR Code) como qualquer outro; ele não interfere no número que atende os clientes.
            </p>
          </div>
          {canais.length === 0 ? (
            <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              Nenhuma conexão de WhatsApp disponível. Conecte o segundo número em <a className="underline" href="/app/settings/channels">Conexões</a> e volte aqui.
            </p>
          ) : (
            <select
              className="h-9 w-full max-w-md rounded-md border border-border bg-background px-2 text-sm"
              value={config.canal_id ?? ""}
              disabled={pendente}
              onChange={(e) => escolherCanal(e.target.value)}
              aria-label="Conexão que envia os avisos"
            >
              <option value="">Escolha uma conexão…</option>
              {canais.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} · {c.telefone}{c.tipo ? ` · ${c.tipo}` : ""}{c.pronto ? "" : " (desconectada)"}
                </option>
              ))}
            </select>
          )}
          {!config.canal_id && <p className="text-sm text-warning">Sem uma conexão escolhida, nenhum aviso é enviado.</p>}
          {canal && !canal.pronto && <p className="text-sm text-warning">Essa conexão está desconectada. Reconecte em Conexões para os avisos saírem.</p>}
          {canal?.temAgente && <p className="text-sm text-warning">Esse número atende clientes com um agente publicado. Prefira um número só para avisos.</p>}
          {canal && !canal.deAvisos && !canal.temAgente && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={prepararAvisos} disabled={pendente}>Usar como número de avisos</Button>
              <span className="text-xs text-text-muted">Garante que a IA nunca responda mensagens que chegarem nesse número.</span>
            </div>
          )}
          {canal?.deAvisos && <Badge variant="secondary">A IA não responde neste número</Badge>}
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Suas notificações</h2>
          <Button onClick={nova} disabled={pendente}>Nova notificação</Button>
        </div>

        {config.notificacoes.length === 0 ? (
          <Card className="p-6 text-sm text-text-muted">Nenhuma notificação ainda. Crie a primeira, por exemplo “Cliente para atender”.</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {config.notificacoes.map((n) => (
              <Card key={n.id} className="flex flex-wrap items-center gap-3 p-3">
                <Switch checked={n.ativa} disabled={pendente} onCheckedChange={(v) => alternar(n, v)} aria-label={`Ativar ${n.nome}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{n.nome}</div>
                  <div className="text-xs text-text-muted">
                    {ROTULO_DO_GATILHO[n.gatilho]} · {n.destinatarios.length} {n.destinatarios.length === 1 ? "número" : "números"}
                    {n.destinatarios.length === 0 ? " (adicione quem recebe)" : ""}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditando(n)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => excluir(n)} disabled={pendente}>Excluir</Button>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="relatorios">
        {inicial.registros.length === 0 ? (
          <Card className="p-6 text-sm text-text-muted">Nenhum aviso enviado ainda.</Card>
        ) : (
          <Card className="divide-y divide-border">
            {inicial.registros.map((r, i) => (
              <div key={`${r.em}-${i}`} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="w-40 text-text-muted">{new Date(r.em).toLocaleString("pt-BR")}</span>
                <span className="flex-1 font-medium">{r.notificacao}</span>
                <span className="text-text-muted">{r.destino}</span>
                {r.ok ? <Badge variant="secondary">Enviado</Badge> : <Badge variant="destructive" title={r.erro}>Falhou</Badge>}
              </div>
            ))}
          </Card>
        )}
      </TabsContent>

      {editando && (
        <Editor
          inicial={editando}
          canalId={config.canal_id}
          onFechar={() => setEditando(null)}
          onSalvar={salvarNotificacao}
        />
      )}
    </Tabs>
  );
}

function Editor({ inicial, canalId, onFechar, onSalvar }: { inicial: Notificacao; canalId: string | null; onFechar: () => void; onSalvar: (n: Notificacao) => void }) {
  const [n, setN] = useState(inicial);
  const [numero, setNumero] = useState("");
  const [testando, iniciarTeste] = useTransition();
  const previa = renderizarMensagem(n.mensagem, DADOS_DE_EXEMPLO);

  function adicionar() {
    const t = normalizarTelefone(numero);
    if (!t) return toast.error(msgErro("sem_numero"));
    if (n.destinatarios.includes(t)) return setNumero("");
    if (n.destinatarios.length >= MAXIMO_DE_DESTINATARIOS) return toast.error(`No máximo ${MAXIMO_DE_DESTINATARIOS} números.`);
    setN({ ...n, destinatarios: [...n.destinatarios, t] });
    setNumero("");
  }

  function testar() {
    const alvo = n.destinatarios[0] ?? numero;
    iniciarTeste(async () => {
      const r = await enviarTesteDeNotificacao({ canalId, telefone: alvo, mensagem: n.mensagem });
      if (r.ok) toast.success("Teste enviado."); else toast.error(msgErro(r.error, r.detalhe));
    });
  }

  function trocarGatilho(g: Gatilho) {
    // Se a mensagem ainda é o modelo do gatilho anterior, acompanha o novo.
    const eraPadrao = n.mensagem === MENSAGEM_PADRAO[n.gatilho];
    setN({ ...n, gatilho: g, mensagem: eraPadrao ? MENSAGEM_PADRAO[g] : n.mensagem });
  }

  const podeSalvar = n.nome.trim().length > 0 && n.mensagem.trim().length > 0 && n.mensagem.length <= TAMANHO_MAXIMO_DA_MENSAGEM;

  return (
    <Dialog open onOpenChange={(a) => { if (!a) onFechar(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{inicial.nome ? "Editar notificação" : "Nova notificação"}</DialogTitle>
          <DialogDescription>Escreva o aviso, escolha quando dispara e quem recebe.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">Nome
              <Input value={n.nome} maxLength={100} onChange={(e) => setN({ ...n, nome: e.target.value })} placeholder="Ex.: Cliente para atender" />
            </label>
            <label className="text-sm font-medium">Quando dispara
              <select className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm" value={n.gatilho} onChange={(e) => trocarGatilho(e.target.value as Gatilho)}>
                {GATILHOS.map((g) => <option key={g} value={g}>{ROTULO_DO_GATILHO[g]}</option>)}
              </select>
            </label>
            {n.gatilho === "armazenamento" && (
              <p className="rounded-md bg-muted p-2 text-xs">Este aviso não tem cliente: use só <b>{"{{resumo}}"}</b>, que traz o problema (por exemplo, envios que falharam ou Dropbox desconectado). É enviado uma vez por problema novo.</p>
            )}
            {n.gatilho === "roteiro" && (
              <p className="rounded-md bg-muted p-2 text-xs">No Roteiro, use a ação <b>@ Notificar WhatsApp</b> e escreva este nome: <b>{n.nome || "…"}</b>.</p>
            )}
            <label className="text-sm font-medium">Mensagem
              <Textarea rows={8} value={n.mensagem} onChange={(e) => setN({ ...n, mensagem: e.target.value })} />
            </label>
            <div className="flex flex-wrap items-center gap-1">
              {MARCADORES.map((m) => (
                <Button key={m} type="button" size="sm" variant="outline" title={DESCRICAO_DO_MARCADOR[m]} onClick={() => setN({ ...n, mensagem: `${n.mensagem}{{${m}}}` })}>{`{{${m}}}`}</Button>
              ))}
              <span className={`ml-auto text-xs ${n.mensagem.length > TAMANHO_MAXIMO_DA_MENSAGEM ? "text-destructive" : "text-text-muted"}`}>{n.mensagem.length}/{TAMANHO_MAXIMO_DA_MENSAGEM}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <div className="text-sm font-medium">Quem recebe ({n.destinatarios.length}/{MAXIMO_DE_DESTINATARIOS})</div>
              <div className="mt-1 flex gap-2">
                <Input value={numero} inputMode="tel" placeholder="(13) 99999-9999" onChange={(e) => setNumero(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }} />
                <Button type="button" variant="outline" onClick={adicionar}>Adicionar</Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {n.destinatarios.map((d) => (
                  <Badge key={d} variant="secondary" className="gap-1">
                    {formatarNumero(d)}
                    <button type="button" aria-label={`Remover ${formatarNumero(d)}`} onClick={() => setN({ ...n, destinatarios: n.destinatarios.filter((x) => x !== d) })}>×</button>
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">Prévia (dados de exemplo)</div>
              <div className="mt-1 whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50">{previa || "—"}</div>
            </div>
            <div className="flex flex-col gap-1">
              <Button type="button" variant="outline" onClick={testar} disabled={testando || !canalId || (n.destinatarios.length === 0 && !numero)}>
                {testando ? "Enviando…" : "Enviar teste"}
              </Button>
              {!canalId && <p className="text-xs text-warning">Escolha a conexão que envia os avisos para poder testar.</p>}
              <p className="text-xs text-text-muted">O teste vai para o primeiro número da lista (ou o que estiver digitado).</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button disabled={!podeSalvar} onClick={() => onSalvar({ ...n, nome: n.nome.trim() })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
