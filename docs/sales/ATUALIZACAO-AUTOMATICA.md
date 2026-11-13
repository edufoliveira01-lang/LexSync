# Atualização automática do Deskcomm (ambiente de teste)

Para o desenvolvimento não esperar alguém rodar o `atualizar.sh` a cada imagem nova.

> Use num **ambiente de teste** (um segundo Deskcomm). Em produção, atualize à mão, no horário certo.

## Instalar (uma vez, no servidor de teste)

```bash
cd ~/DeskcommCRM
curl -fsSL https://raw.githubusercontent.com/edufoliveira01-lang/LexSync/main/scripts/sales/atualizar-auto.sh -o atualizar-auto.sh
chmod +x atualizar-auto.sh
./atualizar-auto.sh --so-ver        # confere o que faria
```

Se o repositório for privado, copie o arquivo `scripts/sales/atualizar-auto.sh` à mão para `~/DeskcommCRM/`.

## Agendar (a cada 3 minutos)

```bash
( crontab -l 2>/dev/null; echo '*/3 * * * * cd $HOME/DeskcommCRM && ./atualizar-auto.sh >> atualizar-auto.log 2>&1' ) | crontab -
```

Ver o que ele fez: `tail -f ~/DeskcommCRM/atualizar-auto.log`. Voltar uma versão: `./atualizar.sh voltar`.
Parar: `crontab -e` e apagar a linha.
