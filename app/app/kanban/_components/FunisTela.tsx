"use client";

import { FunisClient } from "../_client";

type Props = React.ComponentProps<typeof FunisClient>;

/** A tela de Funis. Compartilhada pela página e pelo preview de desenvolvimento (o cabeçalho mora no cliente, junto das ações). */
export function FunisTela(props: Props) {
  return (
    <div className="flex h-full flex-col">
      <FunisClient {...props} />
    </div>
  );
}
