# LexSync — origem do código

O LexSync parte do **DeskcommCRM** (https://github.com/melgarafael/DeskcommCRM), de Rafael Melgaço, licença **MIT** (ver `LICENSE`, que deve ser mantida).

- Commit de origem: `0f55b591f7b29ba1c4d0623242f9c5dd141510c5` (main, 2026-11-04).
- Importado inteiro, sem alterações de código. Ficaram de fora, de propósito: `evidence/` (capturas de tela de QA), configurações de agentes de IA do projeto original (`.claude/`, `.agents/`, `.codex/`, `.cursor/`) e `FUNDING.yml`/`dependabot.yml`.
- `CLAUDE.md` e `AGENTS.md` do projeto original ficam em `docs/upstream/` (não valem como instruções deste repositório).
- Os workflows de CI do original ficam em `.github/workflows-upstream/`, **desativados** (o GitHub só executa `.github/workflows/`). Ative um por um quando for adaptá-los.
- Para trazer atualizações do original: `git remote add upstream https://github.com/melgarafael/DeskcommCRM.git` e `git fetch upstream`.

## O que é nosso (não existe no original)
- `sales-bridge/` — a ponte com o painel e o sistema dos escritórios (ver o README dela).
- `docker-compose.sales.yml` — sobe a ponte junto do compose do Deskcomm.
- `scripts/sales/sincronizar-upstream.sh` e `.upstream-base` — atualização a partir do original.

## Como atualizar a partir do original
```bash
bash scripts/sales/sincronizar-upstream.sh --verificar   # só mostra o que mudou
bash scripts/sales/sincronizar-upstream.sh               # aplica (sem commitar); em conflito deixa marcadores
```
Regra de ouro: **não edite arquivos do Deskcomm quando der para evitar**. Tudo o que é do Sales entra em arquivos novos (`sales-bridge/`, `scripts/sales/`…), que o original nunca toca. Se for indispensável mexer num arquivo do original, mantenha a alteração mínima e saiba que ela pode gerar um conflito na próxima atualização.
