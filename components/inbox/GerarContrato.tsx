"use client";

import { useState } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { useCreateNote } from "@/hooks/inbox/useCreateNote";
import { useT } from "@/hooks/i18n/useT";
import { MARCA_DE_EVENTO } from "@/lib/inbox/evento-na-conversa-marca";

/**
 * Fork Sales — botão "Gerar contrato" do cabeçalho da conversa.
 *
 * Abre um formulário curto com os dados do contrato (já preenchidos com o que
 * o contato tem). Por enquanto o envio para assinatura (ZapSign) ainda não está
 * ligado: o pedido fica registrado NA conversa, como linha do histórico, para
 * a equipe ver quem preparou o contrato e com quais dados.
 */
const TIPOS = ["Previdenciário", "Acidentário", "Trabalhista", "Outro"] as const;
const ROTULO_DO_TIPO = (t: (x: string) => string): Record<(typeof TIPOS)[number], string> => ({
  Previdenciário: t("Previdenciário"),
  Acidentário: t("Acidentário"),
  Trabalhista: t("Trabalhista"),
  Outro: t("Outro"),
});

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

function FormularioDoContrato({
  conversationId,
  nomeInicial,
  telefoneInicial,
  emailInicial,
  onFechar,
}: Dados & { onFechar: () => void }) {
  const t = useT();
  const [nome, setNome] = useState(nomeInicial);
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState(telefoneInicial ?? "");
  const [email, setEmail] = useState(emailInicial ?? "");
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>("Previdenciário");
  const [honorarios, setHonorarios] = useState("");
  const [obs, setObs] = useState("");
  const nota = useCreateNote();

  const gerar = () => {
    if (!nome.trim()) {
      toast.error(t("Informe o nome do cliente."));
      return;
    }
    const linhas = [
      `Contrato (${tipo}) preparado para ${nome.trim()}`,
      cpf.trim() && `CPF ${cpf.trim()}`,
      honorarios.trim() && `honorários ${honorarios.trim()}`,
      "aguardando envio para assinatura",
    ].filter(Boolean);
    nota.mutate(
      { conversation_id: conversationId, body: `${MARCA_DE_EVENTO}${linhas.join(" · ")}${obs.trim() ? ` — ${obs.trim()}` : ""}` },
      {
        onSuccess: () => {
          toast.success(t("Contrato registrado na conversa. O envio para assinatura será ligado em breve."));
          onFechar();
        },
      },
    );
  };

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && onFechar()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Gerar contrato")}</DialogTitle>
            <DialogDescription>
              {t("Confira os dados do cliente. O envio para assinatura eletrônica será conectado em seguida.")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="gc-nome">{t("Nome do cliente")}</Label>
              <Input id="gc-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gc-cpf">CPF</Label>
              <Input id="gc-cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gc-tel">{t("Telefone")}</Label>
              <Input id="gc-tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="gc-email">E-mail</Label>
              <Input id="gc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gc-tipo">{t("Tipo de contrato")}</Label>
              <select
                id="gc-tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as (typeof TIPOS)[number])}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TIPOS.map((x) => (
                  <option key={x} value={x}>
                    {ROTULO_DO_TIPO(t)[x]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gc-hon">{t("Honorários")}</Label>
              <Input id="gc-hon" value={honorarios} onChange={(e) => setHonorarios(e.target.value)} placeholder="R$ 0,00" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="gc-obs">{t("Observações")}</Label>
              <Textarea id="gc-obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onFechar}>
              {t("Cancelar")}
            </Button>
            <Button onClick={gerar} disabled={nota.isPending}>
              {t("Gerar contrato")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
