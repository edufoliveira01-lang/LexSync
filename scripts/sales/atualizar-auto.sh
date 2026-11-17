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
BASE=1.116.0-sales          # versão do original em que nos baseamos (a mesma do atualizar.sh)
ALCANCE=12                  # quantos números à frente procurar
MINIMO_GB=8                 # abaixo disso, limpa antes de procurar build novo (o atualizar.sh exige 5 GB para baixar)
SO_VER=0; [[ "${1:-}" == "--so-ver" ]] && SO_VER=1

ATUAL="$(grep -E '^APP_IMAGE=' .env | sed -E 's/.*-sales\.([0-9]+)$/\1/')"
[[ "$ATUAL" =~ ^[0-9]+$ ]] || { echo "Não consegui ler o build atual do .env (APP_IMAGE)."; exit 1; }

livre_gb() { df -BG --output=avail / | tail -1 | tr -dc '0-9'; }

# Apaga só o que nenhum contêiner usa (imagens antigas, camadas soltas, cache de build). Contêineres em execução,
# volumes (banco, arquivos) e a imagem atual ficam intactos.
limpar() {
  local antes; antes="$(livre_gb)"
  docker image prune -a -f >/dev/null 2>&1 || true
  docker builder prune -a -f >/dev/null 2>&1 || true
  docker container prune -f >/dev/null 2>&1 || true
  echo "$(date '+%F %T') limpeza: ${antes} GB -> $(livre_gb) GB livres"
}

# Espaço apertando: limpa já, para o atualizar.sh não recusar por falta de disco.
if (( $(livre_gb) < MINIMO_GB )) && (( ! SO_VER )); then limpar; fi

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
# Atualiza e, se deu certo, limpa as imagens antigas (a nova já está em uso, a anterior vira lixo).
./atualizar.sh "$MELHOR" && limpar
