# Bancada de pré-visualização do tema

Reproduz a tela do Inbox com a MESMA estrutura de classes do Deskcomm e o CSS real (Tailwind do app + `app/tema-sales.css`), para
conferir o visual sem subir a imagem. Não faz parte do app.

```bash
mkdir /tmp/bancada && cd /tmp/bancada
npm init -y >/dev/null && npm i tailwindcss@4.3.3 @tailwindcss/cli@4.3.3
sed -e 's#@source "../#@source "/CAMINHO/DO/LEXSYNC/#' /CAMINHO/DO/LEXSYNC/app/globals.css > globals.css
node_modules/.bin/tailwindcss -i globals.css -o app.css
cp /CAMINHO/DO/LEXSYNC/app/tema-sales*.css . && cp /CAMINHO/DO/LEXSYNC/docs/sales/bancada/gerar.py . && python3 gerar.py
# abra inbox-light.html / inbox-dark.html no navegador (ou capture com o Playwright)
```
