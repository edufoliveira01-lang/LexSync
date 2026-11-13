#!/usr/bin/env bash
# Atualiza sozinho o Deskcomm quando sai uma imagem nova (app + worker), sem ninguém rodar o atualizar.sh.
#
# Pensado para um ambiente de TESTE (um segundo Deskcomm), para o desenvolvimento não esperar o clique de ninguém.
# Em produção, prefira rodar o atualizar.sh à mão no momento certo.
#
#   ./atualizar-auto.sh            confere e atualiza se houver imagem nova
#   ./atualizar-auto.sh --so-ver   só diz o que faria (não atualiza)
#
# Como funciona: lê o número do build atual no .env (APP_IMAGE), procura os próximos números no registro (o número da execução
# tem buracos: execuções canceladas ou com falha não geram imagem) e, se achar um build com app E worker publicados, chama o
# atualizar.sh desse número. Sem credencial nova: usa o mesmo login do GitHub Container Registry que o `docker pull` já usa.
set -euo pipefail
cd "$(dirname "$0")"

REPO=ghcr.io/edufoliveira01-lang
BASE=1.101.0-sales          # versão do original em que nos baseamos (a mesma do atualizar.sh)
ALCANCE=12                  # quantos números à frente procurar
SO_VER=0; [[ "${1:-}" == "--so-ver" ]] && SO_VER=1

ATUAL="$(grep -E '^APP_IMAGE=' .env | sed -E 's/.*-sales\.([0-9]+)$/\1/')"
[[ "$ATUAL" =~ ^[0-9]+$ ]] || { echo "Não consegui ler o build atual do .env (APP_IMAGE)."; exit 1; }

existe() { docker manifest inspect "$1" >/dev/null 2>&1; }

MELHOR=""
for ((n = ATUAL + 1; n <= ATUAL + ALCANCE; n++)); do
  if existe "$REPO/deskcomm-sales:$BASE.$n" && existe "$REPO/deskcomm-sales-worker:$BASE.$n"; then MELHOR="$n"; fi
done

if [[ -z "$MELHOR" ]]; then
  echo "$(date '+%F %T') build $ATUAL é o mais novo."
  exit 0
fi

echo "$(date '+%F %T') build novo: $MELHOR (em uso: $ATUAL)"
if (( SO_VER )); then exit 0; fi
exec ./atualizar.sh "$MELHOR"
