"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOpcoesDoContrato, useSugestoesDoContrato } from "@/hooks/inbox/useOpcoesDoContrato";
import { useSendMessage } from "@/hooks/inbox/useSendMessage";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { mensagemDoContrato } from "@/lib/sales/mensagem-do-contrato";
import type { PessoaDoContrato } from "@/lib/sales/contratos";

/**
 * Fork Sales — botão "Gerar contrato" do cabeçalho da conversa.
 *
 * O formulário reúne os dados que entram na qualificação do cliente nos documentos (nome, nacionalidade, estado civil,
 * profissão, RG, CPF, endereço). Ao gerar, o painel do Sales cadastra o cliente, monta TODOS os documentos do kit e os manda
 * ao ZapSign; o link de assinatura volta e segue ao cliente pelo WhatsApp desta conversa (cópia por e-mail, pelo ZapSign).
 */
type Dados = { conversationId: string; nomeInicial: string; telefoneInicial: string | null; emailInicial?: string | null };

export function GerarContrato(dados: Dados) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button size="sm" variant="default" onClick={() => setAberto(true)} data-testid="gerar-contrato" title={t("Prepara o contrato deste cliente com os dados da conversa.")}>
        {t("Gerar contrato")}
      </Button>
      {aberto && <FormularioDoContrato {...dados} onFechar={() => setAberto(false)} />}
    </>
  );
}

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const ESTADOS_CIVIS = ["solteiro(a)", "casado(a)", "divorciado(a)", "viúvo(a)", "em união estável", "separado(a)"];
const campo = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export { mensagemDoContrato } from "@/lib/sales/mensagem-do-contrato";

function FormularioDoContrato({ conversationId, nomeInicial, telefoneInicial, emailInicial, onFechar }: Dados & { onFechar: () => void }) {
  const t = useT();
  const enviar = useSendMessage();
  const [f, setF] = useState({
    nome: nomeInicial, cpf: "", rg: "", sexo: "" as "" | "M" | "F", nacionalidade: "", estado_civil: "", profissao: "",
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
    email: emailInicial ?? "", telefone: telefoneInicial ?? "",
  });
  const [porWhatsApp, setPorWhatsApp] = useState(true);
  const opcoes = useOpcoesDoContrato().data?.escritorio ?? null;
  const [variante, setVariante] = useState<"comum" | "representado" | "rogo">("comum");
  const [outra, setOutra] = useState<PessoaDoContrato>({});
  const [modelo, setModelo] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const sugestoes = useSugestoesDoContrato(conversationId);
  // O que o Deskcomm já sabe do contato preenche só o que ainda está vazio — nunca por cima do que foi digitado.
  const sugestaoAplicada = useRef(false);
  useEffect(() => {
    if (!sugestoes.data || sugestaoAplicada.current) return;
    sugestaoAplicada.current = true;
    const s = sugestoes.data;
    setF((x) => ({ ...x, ...Object.fromEntries(Object.entries(s).filter(([k, v]) => v && !(x as Record<string, string>)[k] && k in x)) }));
  }, [sugestoes.data]);
  const [gerando, setGerando] = useState(false);
  const muda = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const gerar = async () => {
    if (f.nome.trim().length < 3) return void toast.error(t("Informe o nome do cliente."));
    if (f.cpf.replace(/\D/g, "").length < 11) return void toast.error(t("Informe o CPF do cliente."));
    if (!f.logradouro.trim()) return void toast.error(t("Informe o endereço do cliente."));
    if (variante === "representado" && !outra.nome?.trim()) return void toast.error(t("Informe o nome de quem representa o cliente."));
    if (variante === "rogo" && !outra.nome?.trim()) return void toast.error(t("Informe o nome de quem assina a rogo."));
    setGerando(true);
    try {
      const limpar = (o: Record<string, string | undefined>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v && v.trim()));
      const corpo = {
        ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "")),
        ...(variante !== "comum" ? { variante, [variante === "rogo" ? "a_rogo" : "representante"]: limpar(outra as Record<string, string | undefined>) } : {}),
        ...(Object.keys(limpar(valores)).length ? { campos: limpar(valores) } : {}),
        ...(modelo ? { modelo_honorarios: modelo } : {}),
      };
      const r = await apiClient.post<{ data: { contrato_id: number; sign_url: string; documentos: { nome: string; sign_url: string }[]; email_enviado: boolean } }>(`/api/v1/conversations/${conversationId}/contrato`, corpo);
      const { sign_url, email_enviado } = r.data;
      const documentos = r.data.documentos?.length ? r.data.documentos : [{ nome: "Contrato", sign_url }];
      if (porWhatsApp) {
        await enviar.mutateAsync({ conversation_id: conversationId, body: mensagemDoContrato(f.nome, documentos, email_enviado) });
        toast.success(t("Contrato gerado e o link de assinatura foi enviado ao cliente pelo WhatsApp."));
      } else {
        await navigator.clipboard?.writeText(sign_url).catch(() => undefined);
        toast.success(t("Contrato gerado. O primeiro link de assinatura foi copiado."));
      }
      onFechar();
    } catch (e) {
      showApiError(e);
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !gerando && onFechar()}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Gerar contrato")}</DialogTitle>
          <DialogDescription>
            {t("Os dados abaixo entram na qualificação do cliente em todos os documentos (procuração, contrato, declarações e termo).")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="gc-tipo">{t("Tipo de documento")}</Label>
          <select id="gc-tipo" className={campo} value={variante} onChange={(e) => setVariante(e.target.value as typeof variante)}>
            <option value="comum">{t("Comum — o próprio cliente assina")}</option>
            <option value="representado">{t("Neste ato representado — assina o representante (menor, incapaz…)")}</option>
            <option value="rogo">{t("A rogo — assina outra pessoa a pedido do cliente")}</option>
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-4"><Label htmlFor="gc-nome">{t("Nome completo")}</Label><Input id="gc-nome" value={f.nome} onChange={muda("nome")} /></div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="gc-sexo">{t("Sexo")}</Label>
            <select id="gc-sexo" className={campo} value={f.sexo} onChange={muda("sexo")}>
              <option value="">—</option><option value="M">{t("Masculino")}</option><option value="F">{t("Feminino")}</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="gc-cpf">CPF</Label><Input id="gc-cpf" inputMode="numeric" value={f.cpf} onChange={muda("cpf")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="gc-rg">RG</Label><Input id="gc-rg" value={f.rg} onChange={muda("rg")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="gc-nac">{t("Nacionalidade")}</Label><Input id="gc-nac" value={f.nacionalidade} onChange={muda("nacionalidade")} placeholder={t("brasileiro(a)")} /></div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="gc-ec">{t("Estado civil")}</Label>
            <select id="gc-ec" className={campo} value={f.estado_civil} onChange={muda("estado_civil")}>
              <option value="">—</option>
              {ESTADOS_CIVIS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="gc-prof">{t("Profissão")}</Label><Input id="gc-prof" value={f.profissao} onChange={muda("profissao")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="gc-cep">CEP</Label><Input id="gc-cep" inputMode="numeric" value={f.cep} onChange={muda("cep")} /></div>
          <div className="space-y-1.5 sm:col-span-4"><Label htmlFor="gc-log">{t("Logradouro")}</Label><Input id="gc-log" value={f.logradouro} onChange={muda("logradouro")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="gc-num">{t("Número")}</Label><Input id="gc-num" value={f.numero} onChange={muda("numero")} /></div>
          <div className="space-y-1.5 sm:col-span-4"><Label htmlFor="gc-comp">{t("Complemento")}</Label><Input id="gc-comp" value={f.complemento} onChange={muda("complemento")} /></div>
          <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="gc-bai">{t("Bairro")}</Label><Input id="gc-bai" value={f.bairro} onChange={muda("bairro")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="gc-cid">{t("Cidade")}</Label><Input id="gc-cid" value={f.cidade} onChange={muda("cidade")} /></div>
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="gc-uf">UF</Label>
            <select id="gc-uf" className={campo} value={f.uf} onChange={muda("uf")}>
              <option value="">—</option>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="gc-tel">{t("Telefone")}</Label><Input id="gc-tel" value={f.telefone} onChange={muda("telefone")} /></div>
          <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="gc-email">E-mail</Label><Input id="gc-email" type="email" value={f.email} onChange={muda("email")} /></div>
        </div>
        {variante !== "comum" && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">{variante === "rogo" ? t("Quem assina a rogo") : t("Quem representa o cliente")}</p>
            <p className="text-xs text-muted-foreground">{variante === "rogo" ? t("É esta pessoa que recebe o link e assina. As testemunhas e o espaço da digital saem do cadastro do escritório.") : t("É esta pessoa que recebe o link e assina pelo cliente.")}</p>
            <div className="grid gap-3 sm:grid-cols-6">
              <div className="space-y-1.5 sm:col-span-4"><Label htmlFor="gc-o-nome">{t("Nome completo")}</Label><Input id="gc-o-nome" value={outra.nome ?? ""} onChange={(e) => setOutra({ ...outra, nome: e.target.value })} /></div>
              {variante === "representado" && <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="gc-o-qual">{t("Qualidade")}</Label><Input id="gc-o-qual" value={outra.qualidade ?? ""} onChange={(e) => setOutra({ ...outra, qualidade: e.target.value })} placeholder={t("mãe, pai, tutor…")} /></div>}
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="gc-o-cpf">CPF</Label><Input id="gc-o-cpf" inputMode="numeric" value={outra.cpf ?? ""} onChange={(e) => setOutra({ ...outra, cpf: e.target.value })} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="gc-o-rg">RG</Label><Input id="gc-o-rg" value={outra.rg ?? ""} onChange={(e) => setOutra({ ...outra, rg: e.target.value })} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="gc-o-nac">{t("Nacionalidade")}</Label><Input id="gc-o-nac" value={outra.nacionalidade ?? ""} onChange={(e) => setOutra({ ...outra, nacionalidade: e.target.value })} placeholder={t("brasileiro(a)")} /></div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="gc-o-ec">{t("Estado civil")}</Label>
                <select id="gc-o-ec" className={campo} value={outra.estado_civil ?? ""} onChange={(e) => setOutra({ ...outra, estado_civil: e.target.value })}>
                  <option value="">—</option>{ESTADOS_CIVIS.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="gc-o-prof">{t("Profissão")}</Label><Input id="gc-o-prof" value={outra.profissao ?? ""} onChange={(e) => setOutra({ ...outra, profissao: e.target.value })} /></div>
              <div className="space-y-1.5 sm:col-span-6"><Label htmlFor="gc-o-end">{t("Endereço completo")}</Label><Input id="gc-o-end" value={outra.endereco ?? ""} onChange={(e) => setOutra({ ...outra, endereco: e.target.value })} placeholder={t("Rua, número, bairro, cidade/UF, CEP")} /></div>
            </div>
          </div>
        )}
        {(opcoes?.modelos_honorarios.length || opcoes?.campos.length) ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">{t("Honorários")}</p>
            {opcoes.modelos_honorarios.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="gc-modelo">{t("Modelo de honorários")}</Label>
                <select id="gc-modelo" className={campo} value={modelo} onChange={(e) => setModelo(e.target.value)}>
                  <option value="">{t("Nenhum (só o texto padrão do contrato)")}</option>
                  {opcoes.modelos_honorarios.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
            )}
            {opcoes.campos.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {opcoes.campos.map((c) => (
                  <div key={c.id} className="space-y-1.5"><Label htmlFor={`gc-v-${c.id}`}>{c.rotulo}</Label><Input id={`gc-v-${c.id}`} value={valores[c.id] ?? ""} onChange={(e) => setValores({ ...valores, [c.id]: e.target.value })} placeholder={c.padrao || "—"} /></div>
                ))}
              </div>
            )}
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={porWhatsApp} onChange={(e) => setPorWhatsApp(e.target.checked)} />
          {t("Enviar o link de assinatura pelo WhatsApp desta conversa (cópia por e-mail quando houver)")}
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={gerando}>{t("Cancelar")}</Button>
          <Button onClick={gerar} disabled={gerando}>{gerando ? t("Gerando…") : t("Gerar e enviar")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
