"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";
import { ArrowsClockwise, CheckCircle, CircleNotch, Phone, ShieldCheck } from "@/lib/ui/icons";

type Tipo = "qr" | "oficial";

/**
 * "Nova conexão" em três passos, como pedir um cadastro guiado em vez de um botão que já sai criando:
 *   1. Tipo — por QR Code (o número do celular do escritório) ou pela API oficial da Meta;
 *   2. Nome — como a equipe vai chamar este número (ex.: "Atendimento Previdenciário"), ANTES do QR Code;
 *   3. QR Code — o diálogo de pareamento que já existia (abre quando o passo 2 termina).
 *
 * A API oficial não nasce aqui (precisa de credencial da Meta): o passo 1 só leva para a aba dela.
 */
export function NovaConexaoSheet({
  aberto,
  onFechar,
  criando,
  servicoAtivo,
  onCriar,
  onEscolherOficial,
}: {
  aberto: boolean;
  onFechar: () => void;
  criando: boolean;
  /** O serviço do WhatsApp está configurado nesta instalação? Sem ele não há como gerar QR. */
  servicoAtivo: boolean;
  onCriar: (nome: string) => void;
  onEscolherOficial: () => void;
}) {
  const t = useT();
  const [passo, setPasso] = useState<1 | 2>(1);
  const [tipo, setTipo] = useState<Tipo>("qr");
  const [nome, setNome] = useState("");

  const fechar = () => {
    setPasso(1);
    setTipo("qr");
    setNome("");
    onFechar();
  };

  const nomeLimpo = nome.trim();
  const etapas = [t("Tipo"), t("Nome"), t("QR Code")];

  return (
    <Sheet open={aberto} onOpenChange={(v) => (v ? undefined : fechar())}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 bg-surface p-0 sm:max-w-xl" data-testid="nova-conexao">
        <div className="border-b border-border px-6 pb-4 pt-6">
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
            {t("Conexão")}
          </p>
          <SheetTitle className="text-2xl font-semibold tracking-tight">{t("Nova conexão")}</SheetTitle>
          <SheetDescription className="mt-1">
            {passo === 1
              ? t("Escolha por onde o escritório vai atender o cliente.")
              : t("Dê um nome a este número. Depois você gera o QR Code.")}
          </SheetDescription>
        </div>

        <div className="grid grid-cols-3 gap-2 px-6 pt-4" aria-label={t("Etapas")}>
          {etapas.map((rotulo, i) => (
            <div key={rotulo}>
              <div className={cn("h-1 rounded-full", i < passo ? "bg-accent" : "bg-border")} />
              <p className={cn("mt-1.5 text-[11px] font-medium", i < passo ? "text-foreground" : "text-muted-foreground")}>
                {String(i + 1).padStart(2, "0")} {rotulo}
              </p>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {passo === 1 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t("Como você quer conectar?")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <OpcaoDeTipo
                  ativo={tipo === "qr"}
                  onClick={() => setTipo("qr")}
                  icone={<Phone size={20} aria-hidden />}
                  titulo={t("Conexão via QR Code")}
                  texto={t("Use o WhatsApp do celular do escritório. É o caminho mais simples e indicado para a maioria dos casos.")}
                  selo={t("Recomendado")}
                />
                <OpcaoDeTipo
                  ativo={tipo === "oficial"}
                  onClick={() => setTipo("oficial")}
                  icone={<ShieldCheck size={20} aria-hidden />}
                  titulo={t("API oficial (Meta)")}
                  texto={t("WhatsApp Business direto da Meta. Mais estável e com mais recursos, mas exige uma conta da Meta aprovada.")}
                  selo={t("Oficial")}
                />
              </div>
              {!servicoAtivo && tipo === "qr" && (
                <p className="rounded-md border border-warning bg-warning-bg p-3 text-sm text-warning-fg">
                  {t("O serviço do WhatsApp não está configurado nesta instalação, por isso ainda não dá para gerar o QR Code.")}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="nome-da-conexao" className="text-sm font-medium">
                  {t("Nome da conexão")}
                </label>
                <Input
                  id="nome-da-conexao"
                  autoFocus
                  value={nome}
                  maxLength={80}
                  placeholder={t("Ex.: Atendimento Previdenciário")}
                  onChange={(e) => setNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nomeLimpo && !criando) onCriar(nomeLimpo);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {t("É assim que a equipe vai reconhecer este número nas conversas e nos relatórios. Você pode mudar depois.")}
                </p>
              </div>

              <div className="rounded-md border border-border bg-surface p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {t("Antes de gerar o QR Code")}
                </p>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                  <li>{t("Tenha o celular em mãos, com o WhatsApp aberto.")}</li>
                  <li>{t("Toque nos 3 pontinhos (menu), no canto de cima.")}</li>
                  <li>{t("Escolha Dispositivos conectados.")}</li>
                  <li>{t("Toque em Conectar dispositivo.")}</li>
                  <li>{t("Quando o QR Code aparecer aqui, aponte a câmera do celular para ele.")}</li>
                </ol>
              </div>

              <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                {t("Uma conexão por número: evite conectar o mesmo número duas vezes, isso pode causar erros mesmo que uma delas esteja fora do ar.")}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <span className="text-xs text-muted-foreground">
            {t("Passo")} {passo} {t("de")} 3
          </span>
          <div className="flex gap-2">
            {passo === 2 ? (
              <Button variant="outline" onClick={() => setPasso(1)} disabled={criando}>
                {t("Voltar")}
              </Button>
            ) : (
              <Button variant="outline" onClick={fechar}>
                {t("Cancelar")}
              </Button>
            )}
            {passo === 1 ? (
              <Button
                onClick={() => {
                  if (tipo === "oficial") {
                    fechar();
                    onEscolherOficial();
                  } else setPasso(2);
                }}
                disabled={tipo === "qr" && !servicoAtivo}
              >
                {t("Continuar")}
              </Button>
            ) : (
              <Button disabled={!nomeLimpo || criando || !servicoAtivo} onClick={() => onCriar(nomeLimpo)}>
                {criando ? <CircleNotch size={14} className="animate-spin" aria-hidden /> : <ArrowsClockwise size={14} aria-hidden />}
                {t("Gerar QR Code")}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function OpcaoDeTipo({
  ativo,
  onClick,
  icone,
  titulo,
  texto,
  selo,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: React.ReactNode;
  titulo: string;
  texto: string;
  selo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "relative flex flex-col gap-2 rounded-md border bg-surface p-4 text-left transition",
        ativo ? "border-accent bg-accent-50" : "border-border hover:border-accent-300",
      )}
    >
      {ativo && <CheckCircle size={18} weight="fill" className="absolute right-3 top-3 text-accent" aria-hidden />}
      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-accent">{icone}</span>
      <span className="text-sm font-semibold">{titulo}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">{texto}</span>
      <span className="mt-1 w-fit rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{selo}</span>
    </button>
  );
}
