# Gerar contrato (ZapSign) — instalação

O botão **Gerar contrato** do cabeçalho da conversa pede o contrato ao painel do Sales, que cadastra o cliente, monta todos os documentos do kit e
os envia ao ZapSign. O link de assinatura volta e segue ao cliente pelo WhatsApp da conversa (o ZapSign manda a cópia por e-mail).

Variáveis (no `.env` do Deskcomm, na VPS):

- `SALES_PAINEL_URL` — endereço público do painel de assinaturas (ex.: `https://painel.dominio.com.br`).
- `CONTRATOS_SEGREDO` — 32+ caracteres; **o mesmo valor** que vai no `painel.env` do Ubuntu.

Na conversa aparecem as linhas "Contrato enviado para assinatura" e, quando o cliente assina, "Contrato assinado" (conferido a cada 20 s enquanto houver contrato pendente).
Arquivos do fork: `lib/sales/contratos.ts`, `app/api/v1/conversations/[id]/contrato/route.ts`, `components/inbox/GerarContrato.tsx`, `hooks/inbox/useAcompanharContratos.ts`.
