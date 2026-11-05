# Ponte Sales & Associados ↔ DeskcommCRM

Serviço pequeno e **separado** que liga o painel e o sistema dos escritórios ao DeskcommCRM **sem alterar o código dele** (por isso as atualizações do original continuam entrando por `scripts/sales/sincronizar-upstream.sh`).

Ele fala com o banco do Deskcomm (Supabase) com a chave de serviço e chama as mesmas funções SQL que o painel de administração do Deskcomm usa.

## O que faz
| Chamada | Quem chama | O que acontece |
|---|---|---|
| `POST /v1/offices` | painel Sales | cria a empresa (`fn_create_tenant_with_owner`), cria o usuário administrador sem e-mail de convite e o vincula como admin (`fn_accept_team_invite`). Repetir não duplica. |
| `GET /v1/offices/:slug` | painel Sales | status da empresa |
| `POST /v1/offices/:slug/suspend` | painel Sales | suspende (`fn_suspender_organizacao`, tipo administrativa) |
| `POST /v1/offices/:slug/reactivate` | painel Sales | reativa (`fn_reativar_organizacao`) |
| `GET /sso?t=…` | navegador, vindo do sistema do escritório | entrada direta: valida o token, confere que a pessoa é membro e envia o navegador ao `/auth/confirm` do Deskcomm com um código de uso único |

## Segurança
- Chamadas `/v1/*` são assinadas (HMAC-SHA256 com `SALES_BRIDGE_SECRET`, janela de 5 minutos). A assinatura cobre método, caminho e corpo.
- A entrada direta usa um token de 60 segundos e uso único, assinado com uma **chave própria de cada escritório** (derivada do segredo geral): o sistema de um escritório nunca recebe o segredo geral nem consegue entrar em outro escritório.
- `SALES_ACTOR_ID` precisa ser o UUID de um administrador da plataforma com escopo `full` no Deskcomm (é quem consta como autor das criações/suspensões).
- A ponte não guarda nada: o estado fica no banco do Deskcomm.

## Variáveis
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SALES_BRIDGE_SECRET` (≥ 32 caracteres), `SALES_ACTOR_ID`, `DESKCOMM_PUBLIC_URL` (ex.: `https://atendimento.saleseassociados.com.br`), `PORT` (3900).

## Subir
`docker compose -f docker-compose.yml -f docker-compose.sales.yml up -d sales-bridge`, e publique a porta 3900 num subdomínio (Cloudflare Tunnel/Nginx).

## Testes
`cd sales-bridge && npm install && npm test`

## Ainda precisa ser validado no piloto
Os testes usam um Supabase falso. Na primeira instalação real, confira: (1) criar um escritório de teste pelo painel; (2) o administrador aparece na equipe da empresa; (3) a entrada direta cai logada (se o Deskcomm exigir confirmação extra na tela `/auth/confirm`, o botão "Continuar" aparece e basta um clique); (4) suspender e reativar.
