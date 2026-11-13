"use client";

import { TemplatesClient } from "./TemplatesClient";

/** A tela de Respostas rápidas. Compartilhada pela página e pelo preview de desenvolvimento (o cabeçalho mora no cliente, junto das ações). */
export function RespostasRapidasTela(props: React.ComponentProps<typeof TemplatesClient>) {
  return (
    <div className="flex h-full flex-col">
      <TemplatesClient {...props} />
    </div>
  );
}
