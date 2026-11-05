# Imagem própria do Deskcomm (Sales & Associados)

O LexSync é o DeskcommCRM original + a nossa aparência (`app/tema-sales.css`) + a ponte. Cada push na `main` que mude o app
constrói a imagem do APP e a publica em `ghcr.io/edufoliveira01-lang/deskcomm-sales:<versão-do-original>-sales.<n>`
(workflow **Imagem do Deskcomm**). O worker e o scheduler continuam sendo as imagens do original.

## Colocar na VPS (uma vez)
1. No GitHub → *Packages* → `deskcomm-sales` → *Package settings* → **Change visibility → Public** (o código é do original, MIT; evita login no servidor).
2. No `.env` do Deskcomm: `APP_IMAGE="ghcr.io/edufoliveira01-lang/deskcomm-sales:<versão>"` (a mais recente das tags `X.Y.Z-sales.N`).
3. `cd ~/DeskcommCRM && docker compose -f docker-compose.prod.yml -f docker-compose.cloudflared.yml --env-file .env pull app && docker compose -f docker-compose.prod.yml -f docker-compose.cloudflared.yml --env-file .env up -d app`

## Atualizar a aparência
Altere o CSS aqui, publique, espere o workflow terminar e repita o passo 2 e 3 com a tag nova.
⚠️ Não use o botão **Atualizar agora** do Deskcomm enquanto estiver na imagem própria: ele voltaria à imagem do original.

## Receber atualizações do original
`UPSTREAM_REF=vX.Y.Z bash scripts/sales/sincronizar-upstream.sh` (veja `UPSTREAM.md`), confira, commite: a imagem nova sai sozinha.
