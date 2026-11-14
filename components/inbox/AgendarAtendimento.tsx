"use client";

import { QueryClientContext } from "@tanstack/react-query";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Calendario } from "@/components/ui/calendario";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import { agruparPorDia, quandoLegivel, textoDaConfirmacao, type HorarioLivre } from "@/lib/agenda/quando-legivel";
import { diaLocalISO } from "@/lib/agenda/fuso";
import { rotuloDoLocal } from "@/lib/agenda/locais";
import { apiClient } from "@/lib/api/client";
import { randomId } from "@/lib/random-id";
import { CalendarBlank, CircleNotch } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

type Tipo = { id: string; name: string; duration_minutes: number; is_active: boolean; location_kind?: string | null; location_details?: string | null };
type Marcado = { id: string; titulo: string; iniciaEm: string; fuso: string; situacao: string; revision?: number; tipo?: { nome: string } | null };
type Livres = { slots: HorarioLivre[]; fuso_da_regra: string; publicou_horarios: boolean };

const CHAVE_DO_TIPO = "agendar-atendimento.tipo";
const JANELA_RAPIDA_DIAS = 14;
const FUSO_PADRAO = "America/Sao_Paulo";

const lerTipoLembrado = () => {
  try { return window.localStorage.getItem(CHAVE_DO_TIPO); } catch { return null; }
};
const lembrarTipo = (id: string) => {
  try { window.localStorage.setItem(CHAVE_DO_TIPO, id); } catch { /* sem armazenamento: segue */ }
};

/**
 * "Agendar" ao lado de Programar e Follow-up: o atendente marca, remarca ou desmarca o atendimento do cliente SEM sair da conversa.
 *
 *  - Ao abrir, os próximos horários livres já aparecem (sem botão "Consultar"); para outro dia, o calendário.
 *  - Tipo de atendimento: o último usado. Quem atende: o responsável padrão do tipo (a rota decide).
 *  - Cliente que já tem atendimento marcado vê esse atendimento, com Remarcar e Desmarcar, em vez do formulário (não duplica).
 *  - Avisar o cliente no WhatsApp vem ligado, com o texto editável.
 *  - A cápsula "Fulano agendou um atendimento…" aparece na conversa (o servidor a registra).
 *
 * Só a equipe agenda: o agente de IA não usa esta tela e não tem a ferramenta de marcar.
 */
export function AgendarAtendimento({ conversationId, contactId, contactName, somenteLeitura = false }: { conversationId: string; contactId: string | null; contactName?: string | null; somenteLeitura?: boolean }) {
  const t = useT();
  const queryClient = useContext(QueryClientContext);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erroDeCarga, setErroDeCarga] = useState(false);
  const [tipos, setTipos] = useState<Tipo[] | null>(null);
  const [tipoId, setTipoId] = useState("");
  const [marcado, setMarcado] = useState<Marcado | null>(null);
  const [livres, setLivres] = useState<Livres | null>(null);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [outroDia, setOutroDia] = useState(false);
  const [dia, setDia] = useState<Date | null>(null);
  const [modo, setModo] = useState<"agendar" | "remarcar" | "desmarcar">("agendar");
  const [motivo, setMotivo] = useState("");
  const [avisar, setAvisar] = useState(true);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const tipo = tipos?.find((x) => x.id === tipoId) ?? null;
  const fuso = livres?.fuso_da_regra ?? FUSO_PADRAO;

  const carregarHorarios = useCallback(
    async (id: string, diaPedido: Date | null) => {
      setCarregandoHorarios(true);
      try {
        const agora = new Date();
        let de = agora;
        let ate = new Date(agora.getTime() + JANELA_RAPIDA_DIAS * 86_400_000);
        if (diaPedido) {
          const inicio = new Date(diaPedido.getFullYear(), diaPedido.getMonth(), diaPedido.getDate(), 0, 0, 0);
          de = new Date(Math.max(agora.getTime(), inicio.getTime() - 14 * 3_600_000));
          ate = new Date(inicio.getTime() + 38 * 3_600_000);
        }
        const r = await apiClient.get<{ data: Livres }>(`/api/v1/agenda/horarios-livres?event_type_id=${encodeURIComponent(id)}&de=${encodeURIComponent(de.toISOString())}&ate=${encodeURIComponent(ate.toISOString())}`);
        setLivres(r.data);
        setEscolhido(null);
      } catch (e) {
        setLivres(null);
        showApiError(e);
      } finally {
        setCarregandoHorarios(false);
      }
    },
    [],
  );

  // Abriu: carrega os tipos e o atendimento que o cliente já tem marcado.
  useEffect(() => {
    if (!aberto || !contactId) return;
    let cancelado = false;
    setCarregando(true);
    setErroDeCarga(false);
    void (async () => {
      try {
        const agora = new Date();
        // A listagem recusa períodos acima de 62 dias (`agenda_listagem_janela_invalida`): 60 dias é também a janela em que a agenda aceita marcar.
        const ate = new Date(agora.getTime() + 60 * 86_400_000);
        const [rTipos, rMarcados] = await Promise.all([
          apiClient.get<{ data: Tipo[] }>("/api/v1/agenda/tipos"),
          apiClient.get<{ data: Marcado[] }>(`/api/v1/agenda/agendamentos?contact_id=${encodeURIComponent(contactId)}&de=${encodeURIComponent(agora.toISOString())}&ate=${encodeURIComponent(ate.toISOString())}`),
        ]);
        if (cancelado) return;
        const ativos = (Array.isArray(rTipos.data) ? rTipos.data : []).filter((x) => x.is_active);
        const proximos = (Array.isArray(rMarcados.data) ? rMarcados.data : [])
          .filter((x) => (x.situacao === "pending" || x.situacao === "confirmed") && new Date(x.iniciaEm).getTime() > agora.getTime())
          .sort((a, b) => a.iniciaEm.localeCompare(b.iniciaEm));
        setTipos(ativos);
        setMarcado(proximos[0] ?? null);
        const lembrado = lerTipoLembrado();
        const inicial = ativos.find((x) => x.id === lembrado) ?? ativos[0];
        if (inicial) {
          setTipoId(inicial.id);
          if (!proximos[0]) void carregarHorarios(inicial.id, null);
        }
      } catch {
        if (!cancelado) setErroDeCarga(true);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [aberto, contactId, tentativa, carregarHorarios]);

  // O texto da confirmação acompanha o horário escolhido, até a pessoa editar.
  const [textoEditado, setTextoEditado] = useState(false);
  useEffect(() => {
    if (textoEditado || !escolhido || !tipo) return;
    setTexto(textoDaConfirmacao({ nome: contactName ?? null, tipo: tipo.name, inicio: escolhido, fuso, local: rotuloDoLocal(tipo.location_kind, tipo.location_details) }));
  }, [escolhido, tipo, fuso, contactName, textoEditado]);

  const diasComVaga = useMemo(() => {
    const vistos = new Set<string>();
    const datas: Date[] = [];
    for (const s of livres?.slots ?? []) {
      const d = diaLocalISO(new Date(s.inicio), fuso);
      if (!vistos.has(d)) {
        vistos.add(d);
        datas.push(new Date(`${d}T12:00:00`));
      }
    }
    return datas;
  }, [livres, fuso]);

  const grupos = useMemo(() => agruparPorDia(livres?.slots ?? [], fuso, new Date(), { maxDias: dia ? 1 : 3 }), [livres, fuso, dia]);

  if (!contactId || somenteLeitura) return null;

  const atualizarAgenda = () => void queryClient?.invalidateQueries({ queryKey: ["agenda"] });
  const recarregar = () => {
    setMarcado(null);
    setModo("agendar");
    setOutroDia(false);
    setDia(null);
    setTextoEditado(false);
    setTentativa((n) => n + 1);
  };

  const agendar = async () => {
    if (!escolhido || !tipo) return;
    setSalvando(true);
    try {
      await apiClient.post("/api/v1/agenda/agendamentos", { event_type_id: tipo.id, starts_at: escolhido, contact_id: contactId, conversation_id: conversationId }, { idempotencyKey: randomId() });
      lembrarTipo(tipo.id);
      if (avisar && texto.trim()) {
        try {
          await apiClient.post("/api/v1/messages", { conversation_id: conversationId, body: texto.trim() });
        } catch {
          toast.error(t("O atendimento foi agendado, mas a confirmação não saiu pelo WhatsApp."));
        }
      }
      toast.success(t("Atendimento agendado."));
      atualizarAgenda();
      recarregar();
    } catch (e) {
      showApiError(e);
      // Horário tomado entre abrir e confirmar: atualiza a lista sem fechar o painel.
      void carregarHorarios(tipo.id, dia);
    } finally {
      setSalvando(false);
    }
  };

  const remarcar = async () => {
    if (!escolhido || !marcado) return;
    setSalvando(true);
    try {
      await apiClient.patch("/api/v1/agenda/agendamentos", { id: marcado.id, ...(marcado.revision ? { revision: marcado.revision } : {}), starts_at: escolhido });
      toast.success(t("Atendimento remarcado."));
      atualizarAgenda();
      recarregar();
    } catch (e) {
      showApiError(e);
      if (tipo) void carregarHorarios(tipo.id, dia);
    } finally {
      setSalvando(false);
    }
  };

  const desmarcar = async () => {
    if (!marcado) return;
    setSalvando(true);
    try {
      await apiClient.delete("/api/v1/agenda/agendamentos", { id: marcado.id, ...(marcado.revision ? { revision: marcado.revision } : {}), reason: motivo.trim() || t("Desmarcado a pedido do cliente.") });
      toast.success(t("Atendimento desmarcado."));
      atualizarAgenda();
      recarregar();
    } catch (e) {
      showApiError(e);
    } finally {
      setSalvando(false);
    }
  };

  const escolherDia = (d: Date) => {
    setDia(d);
    if (tipo) void carregarHorarios(tipo.id, d);
  };

  const seletor = (
    <div className="space-y-2">
      {carregandoHorarios ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><CircleNotch size={14} className="animate-spin" aria-hidden />{t("Procurando horários livres…")}</p>
      ) : livres && !livres.publicou_horarios ? (
        <p className="text-xs text-muted-foreground">{t("Os horários de atendimento ainda não foram publicados. Defina a jornada nas configurações da Agenda.")}</p>
      ) : grupos.length === 0 ? (
        <p className="text-xs text-muted-foreground">{dia ? t("Sem horários livres neste dia.") : t("Sem horários livres nos próximos dias.")}</p>
      ) : (
        grupos.map((g) => (
          <div key={g.dia}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t(g.rotulo)}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.horarios.map((h) => (
                <button
                  key={h.inicio}
                  type="button"
                  aria-pressed={escolhido === h.inicio}
                  onClick={() => setEscolhido(h.inicio)}
                  className={cn("rounded-md border bg-surface px-2.5 py-1 text-sm transition", escolhido === h.inicio ? "border-accent bg-accent-50 font-semibold" : "border-border hover:border-accent-300")}
                >
                  {h.rotulo}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
      <button type="button" onClick={() => setOutroDia((v) => !v)} className="text-xs font-medium text-accent hover:underline">
        {outroDia ? t("Esconder o calendário") : t("Ver outro dia")}
      </button>
      {outroDia && <Calendario value={dia} min={new Date()} marcados={diasComVaga} onSelect={escolherDia} className="mx-auto" />}
    </div>
  );

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="agendar-atendimento"
          title={t("Agendar um atendimento para este cliente")}
          className="inline-flex h-[26px] items-center gap-1 rounded-full border border-border bg-surface px-2.5 text-[11.5px] font-semibold transition hover:border-accent-300"
        >
          <CalendarBlank size={13} aria-hidden />
          {t("Agendar")}
          {marcado && <span className="ml-0.5 size-1.5 rounded-full bg-accent" aria-label={t("Há atendimento marcado")} />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="max-h-[80vh] w-[22rem] space-y-3 overflow-y-auto p-4">
        <div>
          <p className="text-sm font-semibold">{marcado ? t("Atendimento marcado") : t("Agendar atendimento")}</p>
          <p className="text-xs text-muted-foreground">{marcado ? t("Este cliente já tem um atendimento marcado.") : t("Escolha um horário livre e confirme.")}</p>
        </div>

        {carregando ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><CircleNotch size={14} className="animate-spin" aria-hidden />{t("Carregando…")}</p>
        ) : erroDeCarga ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("Não foi possível carregar a agenda.")}</p>
            <Button size="sm" variant="outline" onClick={recarregar}>{t("Tentar de novo")}</Button>
          </div>
        ) : !tipos || tipos.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("Nenhum tipo de atendimento ativo. Cadastre em Configurações da Agenda.")}</p>
        ) : marcado && modo === "agendar" ? (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-surface p-3 text-sm">
              <p className="font-medium">{marcado.tipo?.nome ?? marcado.titulo}</p>
              <p className="text-muted-foreground">{quandoLegivel(marcado.iniciaEm, marcado.fuso || FUSO_PADRAO)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{marcado.situacao === "pending" ? t("Aguardando confirmação") : t("Confirmado")}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setModo("remarcar"); if (tipo) void carregarHorarios(tipo.id, null); }}>{t("Remarcar")}</Button>
              <Button size="sm" variant="destructive" onClick={() => setModo("desmarcar")}>{t("Desmarcar")}</Button>
            </div>
          </div>
        ) : modo === "desmarcar" && marcado ? (
          <div className="space-y-2">
            <p className="text-sm">{t("Desmarcar")} <strong>{quandoLegivel(marcado.iniciaEm, marcado.fuso || FUSO_PADRAO)}</strong>?</p>
            <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("Motivo (opcional)")} aria-label={t("Motivo de desmarcar")} />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setModo("agendar")} disabled={salvando}>{t("Voltar")}</Button>
              <Button size="sm" variant="destructive" onClick={desmarcar} disabled={salvando} data-testid="confirmar-desmarcar">
                {salvando && <CircleNotch size={14} className="animate-spin" aria-hidden />}{t("Desmarcar")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {tipos.length > 1 && modo === "agendar" && (
              <label className="block space-y-1 text-xs font-medium">
                {t("Tipo de atendimento")}
                <select
                  className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                  value={tipoId}
                  onChange={(e) => { setTipoId(e.target.value); setDia(null); setTextoEditado(false); void carregarHorarios(e.target.value, null); }}
                >
                  {tipos.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.duration_minutes} min</option>)}
                </select>
              </label>
            )}
            {seletor}
            {escolhido && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-sm"><strong>{tipo?.name}</strong> · {quandoLegivel(escolhido, fuso)}</p>
                {modo === "agendar" && (
                  <>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />
                      {t("Avisar o cliente no WhatsApp")}
                    </label>
                    {avisar && <Textarea rows={3} value={texto} onChange={(e) => { setTexto(e.target.value); setTextoEditado(true); }} aria-label={t("Mensagem de confirmação ao cliente")} />}
                  </>
                )}
                <div className="flex gap-2">
                  {modo === "remarcar" && <Button size="sm" variant="outline" onClick={() => { setModo("agendar"); setEscolhido(null); }} disabled={salvando}>{t("Voltar")}</Button>}
                  <Button className="flex-1" disabled={salvando} onClick={modo === "remarcar" ? remarcar : agendar} data-testid="confirmar-agendamento">
                    {salvando && <CircleNotch size={14} className="animate-spin" aria-hidden />}
                    {modo === "remarcar" ? t("Remarcar para este horário") : t("Agendar")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
