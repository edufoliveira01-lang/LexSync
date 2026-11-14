#!/usr/bin/env bash
# Instala (ou remove) o "runner" do GitHub Actions nesta VPS, para o build da imagem rodar AQUI e não nos minutos pagos do GitHub.
#
# Uso (como root):
#   RUNNER_TOKEN='<token do GitHub>' bash scripts/instalar-runner-github.sh            # instala
#   RUNNER_TOKEN='<token de remoção>' bash scripts/instalar-runner-github.sh --remover # remove
#
# O token vem de: GitHub → repositório → Settings → Actions → Runners → "New self-hosted runner" (copie só o valor depois de --token).
# Ele vale por 1 hora e NÃO é gravado em lugar nenhum por este script.
#
# Variáveis opcionais: REPO (edufoliveira01-lang/LexSync), RUNNER_USER (ghrunner), RUNNER_DIR (/opt/actions-runner),
# RUNNER_NAME (vps-deskcomm), RUNNER_LABELS (deskcomm).
set -euo pipefail

REPO="${REPO:-edufoliveira01-lang/LexSync}"
USUARIO="${RUNNER_USER:-ghrunner}"
DIR="${RUNNER_DIR:-/opt/actions-runner}"
NOME="${RUNNER_NAME:-vps-deskcomm}"
ETIQUETAS="${RUNNER_LABELS:-deskcomm}"

falha() { echo "ERRO: $*" >&2; exit 1; }
aviso() { echo "AVISO: $*" >&2; }
info() { echo "==> $*"; }

[ "$(id -u)" -eq 0 ] || falha "rode como root (sudo)."
[ -n "${RUNNER_TOKEN:-}" ] || falha "defina RUNNER_TOKEN (veja o cabeçalho deste arquivo)."

# ---------- remover ----------
if [ "${1:-}" = "--remover" ]; then
  [ -d "$DIR" ] || falha "não achei $DIR."
  info "Parando e removendo o serviço."
  (cd "$DIR" && ./svc.sh stop || true && ./svc.sh uninstall || true)
  sudo -u "$USUARIO" bash -c "cd '$DIR' && ./config.sh remove --token '$RUNNER_TOKEN'" || aviso "o GitHub não aceitou o token de remoção; remova o runner em Settings → Actions → Runners."
  info "Pronto. A pasta $DIR e o usuário $USUARIO ficaram; apague à mão se quiser."
  exit 0
fi

# ---------- pré-requisitos ----------
command -v docker >/dev/null 2>&1 || falha "Docker não está instalado."
docker buildx version >/dev/null 2>&1 || falha "docker buildx não está disponível (instale o plugin docker-buildx)."
command -v curl >/dev/null 2>&1 || falha "curl não está instalado."

mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
[ "$mem_kb" -ge 3500000 ] || aviso "menos de 4 GB de RAM: o build do Next pode ser morto por falta de memória (crie swap ou use outra máquina)."
livre_gb="$(df -BG --output=avail /var/lib/docker 2>/dev/null | tail -1 | tr -dc '0-9' || echo 0)"
[ "${livre_gb:-0}" -ge 20 ] || aviso "menos de 20 GB livres em /var/lib/docker (${livre_gb:-?} GB): o build enche o disco."

case "$(uname -m)" in
  x86_64) ARQ="x64" ;;
  aarch64|arm64) ARQ="arm64" ;;
  *) falha "arquitetura $(uname -m) não suportada por este script." ;;
esac

# ---------- usuário ----------
id "$USUARIO" >/dev/null 2>&1 || { info "Criando o usuário $USUARIO."; useradd -m -s /bin/bash "$USUARIO"; }
usermod -aG docker "$USUARIO"

# ---------- runner ----------
VERSAO="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest | grep -oE '"tag_name": *"v[0-9.]+"' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')"
[ -n "$VERSAO" ] || falha "não consegui descobrir a versão mais recente do runner."
info "Runner $VERSAO ($ARQ) em $DIR."

mkdir -p "$DIR"
chown "$USUARIO":"$USUARIO" "$DIR"
if [ ! -x "$DIR/config.sh" ]; then
  curl -fsSL -o "/tmp/actions-runner.tar.gz" "https://github.com/actions/runner/releases/download/v${VERSAO}/actions-runner-linux-${ARQ}-${VERSAO}.tar.gz"
  sudo -u "$USUARIO" tar xzf /tmp/actions-runner.tar.gz -C "$DIR"
  rm -f /tmp/actions-runner.tar.gz
fi
"$DIR/bin/installdependencies.sh" >/dev/null 2>&1 || aviso "installdependencies.sh falhou; siga se o runner abrir normalmente."

if [ -f "$DIR/.runner" ]; then
  info "Este runner já está registrado; só garantindo o serviço."
else
  info "Registrando no GitHub ($REPO) com a etiqueta '$ETIQUETAS'."
  sudo -u "$USUARIO" bash -c "cd '$DIR' && ./config.sh --unattended --replace --url 'https://github.com/$REPO' --token '$RUNNER_TOKEN' --name '$NOME' --labels '$ETIQUETAS' --work _work"
fi

(cd "$DIR" && ./svc.sh install "$USUARIO" 2>/dev/null || true && ./svc.sh start)

# ---------- limpeza semanal do cache do Docker (para o disco não encher) ----------
cat > /etc/cron.weekly/limpa-docker-runner <<'CRON'
#!/bin/sh
docker builder prune -af --filter "until=168h" >/dev/null 2>&1
docker image prune -af --filter "until=336h" >/dev/null 2>&1
CRON
chmod +x /etc/cron.weekly/limpa-docker-runner

info "Pronto. Confira em GitHub → Settings → Actions → Runners: '$NOME' deve aparecer como Idle (verde)."
(cd "$DIR" && ./svc.sh status | head -5) || true
