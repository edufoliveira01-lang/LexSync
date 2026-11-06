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
import { useSugestoesDoContrato } from "@/hooks/inbox/useOpcoesDoContrato";
import { useSendMessage } from "@/hooks/inbox/useSendMessage";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

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

export function mensagemDoContrato(nome: string, documentos: { nome: string; sign_url: string }[], comEmail: boolean): string {
  const primeiro = nome.trim().split(/\s+/)[0] || "";
  const lista = documentos.length === 1
    ? (documentos[0]?.sign_url ?? "")
    : documentos.map((d, i) => `${i + 1}) ${d.nome}:\n${d.sign_url}`).join("\n\n");
  const quantos = documentos.length > 1 ? `os ${documentos.length} documentos abaixo (cada um leva menos de 1 minuto)` : "o documento abaixo";
  return `Olá${primeiro ? `, ${primeiro}` : ""}! Para darmos andamento, precisamos que você assine ${quantos}, de forma segura, direto pelo celular:\n\n${lista}${comEmail ? "\n\nEnviamos uma cópia também para o seu e-mail." : ""}`;
}

function FormularioDoContrato({ conversationId, nomeInicial, telefoneInicial, emailInicial, onFechar }: Dados & { onFechar: () => void }) {
  const t = useT();
  const enviar = useSendMessage();
  const [f, setF] = useState({
    nome: nomeInicial, cpf: "", rg: "", sexo: "" as "" | "M" | "F", nacionalidade: "", estado_civil: "", profissao: "",
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
    email: emailInicial ?? "", telefone: telefoneInicial ?? "",
  });
  const [porWhatsApp, setPorWhatsApp] = useState(true);
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
    setGerando(true);
    try {
      const corpo = { ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "")) };
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
