"use client";

import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { EVENTO_PENDENCIAS_ATUALIZAR } from "@/components/inbox/PendenciasDoSales";

/**
 * Fork Sales — anotação rápida na conversa (atalho Alt+N, igual ao do Sales).
 *
 * Acha no Sales o cliente dono do telefone da conversa e grava a anotação no cadastro dele ou num processo, no nome de quem atende —
 * sem sair do atendimento. A anotação mora no Sales (aparece lá na aba Anotações do cliente).
 */
type Achado = {
  disponivel: boolean; encontrado: boolean; semTelefone?: boolean;
  pessoa?: { id: number; nome: string };
  processos?: { id: number; pasta: string; numero: string; titulo: string; status: string }[];
  recentes?: { autor: string; texto: string; criado_em: string; onde: string }[];
};

export function AnotacaoDoSales({ conversationId }: { conversationId: string }) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  useHotkeys("alt+n", () => setAberto(true), { preventDefault: true, enableOnFormTags: true });
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setAberto(true)} data-testid="anotacao-do-sales" title={t("Anotar no cadastro do cliente (Alt+N)")}>
        {t("Anotar")}
      </Button>
      {aberto && <Janela conversationId={conversationId} onFechar={() => setAberto(false)} />}
    </>
  );
}

function Janela({ conversationId, onFechar }: { conversationId: string; onFechar: () => void }) {
  const t = useT();
  const [achado, setAchado] = useState<Achado | null>(null);
  const [erro, setErro] = useState("");
  const [processoId, setProcessoId] = useState(0);
  const [texto, setTexto] = useState("");
  const [importante, setImportante] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    apiClient.get<{ data: Achado }>(`/api/v1/conversations/${conversationId}/anotacao-sales`)
      .then((r) => {
        if (!ativo) return;
        setAchado(r.data);
        // O padrão é SEMPRE o cadastro do cliente (processoId 0); anotar num processo é uma escolha de quem atende.
      })
      .catch((e) => { if (ativo) setErro(e instanceof Error ? e.message : t("Não foi possível falar com o Sales.")); });
    return () => { ativo = false; };
  }, [conversationId, t]);

  async function salvar() {
    if (!achado?.pessoa) return;
    if (texto.trim().length < 2) return void toast.info(t("Escreva a anotação."));
    setSalvando(true);
    try {
      await apiClient.post(`/api/v1/conversations/${conversationId}/anotacao-sales`, { pessoa_id: achado.pessoa.id, processo_id: processoId || undefined, texto, importante });
      toast.success(t(importante ? "Anotação importante salva no Sales." : "Anotação salva no Sales."));
      window.dispatchEvent(new Event(EVENTO_PENDENCIAS_ATUALIZAR));
      onFechar();
    } catch (e) {
      showApiError(e);
    } finally {
      setSalvando(false);
    }
  }

  const pessoa = achado?.pessoa;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar(); }}>
      <DialogContent className="max-w-xl" data-testid="janela-anotacao-do-sales">
        <DialogHeader>
          <DialogTitle>{t("Nova anotação")}{pessoa ? ` — ${pessoa.nome}` : ""}</DialogTitle>
          <DialogDescription>{t("Fica no cadastro do cliente no Sales. Ctrl+Enter salva.")}</DialogDescription>
        </DialogHeader>
        {erro ? <p role="alert" className="text-sm text-destructive">{erro}</p>
          : !achado ? <p className="text-sm text-muted-foreground">{t("Procurando o cliente no Sales…")}</p>
          : !achado.disponivel ? <p className="text-sm text-muted-foreground">{t("Esta empresa ainda não está ligada ao Sales.")}</p>
          : achado.semTelefone ? <p className="text-sm text-muted-foreground">{t("Este contato não tem telefone para localizar o cliente no Sales.")}</p>
          : !pessoa ? <p className="text-sm text-muted-foreground">{t("Este número ainda não está cadastrado como cliente no Sales. Gere o contrato (ou cadastre a pessoa no Sales) para poder anotar.")}</p>
          : (
            <div className="space-y-4 text-sm">
              {(achado.processos?.length ?? 0) > 0 && (
                <fieldset className="space-y-1.5">
                  <legend className="mb-1 text-xs font-medium text-muted-foreground">{t("Anotar em")}</legend>
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2"><input type="radio" name="destino" checked={processoId === 0} onChange={() => setProcessoId(0)} /> {t("No cadastro do cliente")}</label>
                  {achado.processos!.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 rounded-md border px-3 py-2"><input type="radio" name="destino" checked={processoId === p.id} onChange={() => setProcessoId(p.id)} /> <span className="truncate"><b>{p.pasta}</b> {p.titulo || p.numero}</span></label>
                  ))}
                </fieldset>
              )}
              <Textarea
                autoFocus rows={5} value={texto} maxLength={4000} placeholder={t("Escreva a anotação…")}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void salvar(); } }}
              />
              <label className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 ${importante ? "border-warning/50 bg-warning-bg" : ""}`}>
                <input type="checkbox" className="mt-0.5" data-testid="anotacao-importante" checked={importante} onChange={(e) => setImportante(e.target.checked)} />
                <span><b>{t("Importante")}</b><span className="block text-xs text-muted-foreground">{t("Avisa quem abrir este cliente (aqui no chat e no Sales), até alguém dar como cumprido. Ex.: “preciso do documento deste cliente”.")}</span></span>
              </label>
              {(achado.recentes?.length ?? 0) > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{t("Últimas anotações")}</p>
                  <ul className="space-y-1">
                    {achado.recentes!.map((r, i) => <li key={i} className="rounded-md bg-muted/50 px-3 py-2 text-xs"><b>{r.autor}</b> · {r.onde}<br />{r.texto}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>{t("Cancelar")}</Button>
          {pessoa && <Button onClick={() => void salvar()} disabled={salvando}>{t("Salvar anotação")}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
