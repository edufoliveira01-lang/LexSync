#!/usr/bin/env bash
# Traz para o LexSync as atualizações do DeskcommCRM original, sem perder o que é nosso.
#
#   bash scripts/sales/sincronizar-upstream.sh            # aplica no diretório de trabalho (sem commitar)
#   bash scripts/sales/sincronizar-upstream.sh --verificar # só mostra o que mudou no original desde a última sincronização
#
# Como funciona: o LexSync guarda em `.upstream-base` o commit do original em que está baseado. O script busca
# o original, calcula o diff entre esse commit e o mais novo e o aplica aqui (git apply --3way), ignorando o que
# o LexSync propositalmente não importa. O que é só nosso (sales-bridge/, scripts/sales/, UPSTREAM.md…) não existe
# no original e nunca é tocado. Em conflito, o git deixa marcadores nos arquivos: resolva, rode os testes e commite.
set -Eeuo pipefail
UPSTREAM_URL="${UPSTREAM_URL:-https://github.com/melgarafael/DeskcommCRM.git}"
UPSTREAM_REF="${UPSTREAM_REF:-main}"
RAIZ="$(git rev-parse --show-toplevel)"; cd "$RAIZ"
[ -f .upstream-base ] || { echo "ERRO: falta o arquivo .upstream-base (commit do original em que o LexSync se baseia)." >&2; exit 1; }
BASE="$(tr -d '[:space:]' < .upstream-base)"
VERIFICAR=0; [ "${1:-}" = "--verificar" ] && VERIFICAR=1
if [ "$VERIFICAR" = 0 ] && [ -n "$(git status --porcelain)" ]; then echo "ERRO: há alterações não commitadas. Commite ou guarde antes de sincronizar." >&2; exit 1; fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git init -q "$TMP/o"; git -C "$TMP/o" remote add origin "$UPSTREAM_URL"
for fundo in 100 500 2000; do
  git -C "$TMP/o" fetch -q --depth="$fundo" origin "$UPSTREAM_REF"
  git -C "$TMP/o" cat-file -e "$BASE^{commit}" 2>/dev/null && break
done
git -C "$TMP/o" cat-file -e "$BASE^{commit}" 2>/dev/null || { echo "ERRO: o commit-base $BASE não está nos últimos 2000 commits do original. Sincronize manualmente." >&2; exit 1; }
NOVO="$(git -C "$TMP/o" rev-parse "FETCH_HEAD^{commit}")"
if [ "$BASE" = "$NOVO" ]; then echo "Já está em dia com o original ($NOVO)."; exit 0; fi

# Mesmos caminhos que a importação deixou de fora (ver UPSTREAM.md).
EXCLUIR=(':(exclude)evidence' ':(exclude).claude' ':(exclude).agents' ':(exclude).codex' ':(exclude).cursor' ':(exclude)CLAUDE.md' ':(exclude)AGENTS.md' ':(exclude).github/workflows' ':(exclude).github/FUNDING.yml' ':(exclude).github/dependabot.yml')
echo "Original: $BASE → $NOVO"
git -C "$TMP/o" diff --stat "$BASE" "$NOVO" -- . "${EXCLUIR[@]}" | tail -n 25
[ "$VERIFICAR" = 1 ] && exit 0

# Traz os objetos do original para cá: com a versão antiga dos arquivos em mãos, o git faz mescla de 3 vias de verdade
# (e deixa marcadores de conflito) mesmo nos arquivos que o LexSync alterou.
git fetch -q --no-tags --update-shallow "$TMP/o" "$BASE" "$NOVO" 2>/dev/null || true
git -C "$TMP/o" diff --binary "$BASE" "$NOVO" -- . "${EXCLUIR[@]}" > "$TMP/mudancas.patch"
if [ -s "$TMP/mudancas.patch" ]; then
  # Aplica no que já é nosso, com mescla de 3 vias (usa o blob do original quando o arquivo existe no índice).
  git apply --3way --index "$TMP/mudancas.patch" || { echo; echo "ATENÇÃO: houve conflitos. Resolva os arquivos marcados (git status), rode os testes e commite." >&2; CONFLITO=1; }
fi
# Arquivos que o LexSync guarda em outro lugar.
mkdir -p docs/upstream .github/workflows-upstream
for f in CLAUDE.md AGENTS.md; do git -C "$TMP/o" show "$NOVO:$f" > "docs/upstream/${f%.md}.upstream.md" 2>/dev/null || true; done
git -C "$TMP/o" ls-tree -r --name-only "$NOVO" -- .github/workflows | while read -r w; do git -C "$TMP/o" show "$NOVO:$w" > ".github/workflows-upstream/$(basename "$w")"; done
echo "$NOVO" > .upstream-base
git add .upstream-base docs/upstream .github/workflows-upstream
echo
echo "Pronto: $BASE → $NOVO aplicado e preparado (sem commit)."
echo "Confira com 'git diff --cached --stat', rode os testes e commite com: git commit -m \"chore: atualiza o DeskcommCRM para ${NOVO:0:7}\""
[ "${CONFLITO:-0}" = 1 ] && exit 2 || exit 0
