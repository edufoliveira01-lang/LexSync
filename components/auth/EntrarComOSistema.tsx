"use client";

import { useEffect, useState } from "react";

import { useT } from "@/hooks/i18n/useT";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lembrarSistema, origemDoSistema, sistemaLembrado } from "@/lib/auth/enderecoDoSistema";

/**
 * Login único sem copiar senha: a pessoa entra no sistema do escritório (Sales) com a senha de lá, e o sistema a traz de volta já
 * autenticada por um link assinado de uso único. A senha nunca passa por este servidor.
 */
export function EntrarComOSistema() {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [endereco, setEndereco] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const lembrado = sistemaLembrado();
    if (lembrado) setEndereco(lembrado.replace(/^https:\/\//, ""));
  }, []);

  const ir = (e: React.FormEvent) => {
    e.preventDefault();
    const origem = origemDoSistema(endereco);
    if (!origem) {
      setErro(t("Informe o endereço do sistema do seu escritório, por exemplo: sistema.seuescritorio.com.br"));
      return;
    }
    lembrarSistema(origem);
    window.location.assign(`${origem}/atendimento`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        {t("ou")}
        <span className="h-px flex-1 bg-border" />
      </div>
      {!aberto ? (
        <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => setAberto(true)}>
          {t("Entrar com o sistema do escritório")}
        </Button>
      ) : (
        <form onSubmit={ir} className="space-y-2" noValidate>
          <Label htmlFor="endereco-sistema">{t("Endereço do sistema do escritório")}</Label>
          <Input
            id="endereco-sistema"
            inputMode="url"
            autoComplete="url"
            autoFocus
            placeholder="sistema.seuescritorio.com.br"
            value={endereco}
            onChange={(ev) => {
              setEndereco(ev.target.value);
              setErro(null);
            }}
          />
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <Button type="submit" variant="outline" size="lg" className="w-full">
            {t("Continuar no sistema")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("Você entra com a senha do sistema e volta aqui já conectado. A senha não passa por este site.")}
          </p>
        </form>
      )}
    </div>
  );
}
