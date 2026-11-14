# Runner próprio: o build da imagem rodando na nossa VPS

O GitHub cobra minutos de build em repositório privado. Com um **runner próprio**, o mesmo workflow (`.github/workflows/imagem-sales.yml`) roda na nossa VPS: sem custo de minutos. O GitHub só orquestra.

## Antes de começar: a VPS aguenta?

O build do Next dentro do Docker é pesado e **compete com o sistema em produção** (que roda na mesma máquina). Confira na VPS:

```bash
free -h          # ideal: 8 GB ou mais; abaixo de 4 GB o build pode ser morto por falta de memória
df -h /var/lib/docker   # ideal: 40 GB livres ou mais
nproc            # 2+ núcleos
docker buildx version
```

Se a VPS for pequena, crie swap ou considere pagar o excedente do GitHub (cerca de US$ 0,008 por minuto).

## Instalar (você, na VPS)

1. No GitHub: repositório **LexSync → Settings → Actions → Runners → New self-hosted runner**. Copie só o valor que vem depois de `--token` (vale 1 hora).
2. Na VPS, como root, dentro da pasta do projeto:

```bash
RUNNER_TOKEN='COLE_O_TOKEN_AQUI' bash scripts/instalar-runner-github.sh
```

O script confere Docker, RAM e disco, cria o usuário `ghrunner`, instala o runner como serviço, registra com a etiqueta `deskcomm` e agenda uma limpeza semanal do cache do Docker. O token não é gravado.

3. Em **Settings → Actions → Runners**, o `vps-deskcomm` deve aparecer **Idle** (verde).

## Depois (eu)

Com o runner online, eu troco `runs-on: ubuntu-latest` por `runs-on: [self-hosted, deskcomm]` nos jobs `app` e `worker`, disparo o workflow à mão e acompanho o resultado. **Não troco antes**: sem runner online o job fica na fila para sempre.

## Cuidados

- **Só com repositório privado.** Runner próprio em repositório público é perigoso (qualquer pessoa pode disparar código na sua VPS). Se o repositório voltar a ser público, remova o runner antes.
- **Um runner = um job por vez.** O `app` e o `worker` passam a rodar um depois do outro (o build fica mais lento, mas não estoura a memória).
- **Horário:** build pesado deixa o atendimento mais lento. Prefira publicar fora do pico.
- **Disco:** a limpeza semanal remove cache antigo; se o disco apertar, `docker builder prune -af`.

## Remover

Em Settings → Actions → Runners, abra o runner → **Remove** → copie o token de remoção:

```bash
RUNNER_TOKEN='TOKEN_DE_REMOCAO' bash scripts/instalar-runner-github.sh --remover
```
