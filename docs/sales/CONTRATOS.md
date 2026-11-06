# Gerar contrato (ZapSign) — instalação

O botão **Gerar contrato** do cabeçalho da conversa pede o contrato ao painel do Sales, que cadastra o cliente, monta todos os documentos do kit e
os envia ao ZapSign. O link de assinatura volta e segue ao cliente pelo WhatsApp da conversa (o ZapSign manda a cópia por e-mail).

Variáveis (no `.env` do Deskcomm, na VPS):

- `SALES_PAINEL_URL` — endereço público do painel de assinaturas (ex.: `https://painel.dominio.com.br`).
- `CONTRATOS_SEGREDO` — 32+ caracteres; **o mesmo valor** que vai no `painel.env` do Ubuntu.

Na conversa aparecem as linhas "Contrato enviado para assinatura" e, quando o cliente assina, "Contrato assinado" (conferido a cada 20 s enquanto houver contrato pendente).
Arquivos do fork: `lib/sales/contratos.ts`, `app/api/v1/conversations/[id]/contrato/route.ts`, `components/inbox/GerarContrato.tsx`, `hooks/inbox/useAcompanharContratos.ts`.

## Depois da assinatura (sales.18)

- **Padrão da empresa:** Configurações → Empresa → "Contratos: depois da assinatura" (`organizations.settings.sales.apos_assinatura`): mover o negócio para uma etapa (mesmo funil do negócio aberto), etiqueta no contato e fechar a conversa.
- **Por contrato:** no formulário "Gerar contrato" o atendente pode trocar isso; a escolha viaja escondida na linha "Contrato enviado…" e é aplicada quando a assinatura é detectada.
- **Formulário preenchido:** nome, telefone, e-mail e os campos do negócio (CPF, RG, endereço…) reconhecidos pelo nome (`lib/sales/sugerir-dados.ts`).
- **PDF assinado:** o sistema do escritório o guarda na pasta do cliente (categoria "Contrato assinado").
- Arquivos: `lib/sales/apos-assinatura.ts`, `app/api/v1/sales/contrato-opcoes/route.ts`, `app/api/v1/conversations/[id]/contrato/dados/route.ts`, `components/inbox/EscolhaAposAssinatura.tsx`, `app/app/settings/tenant/_contrato.tsx`.
