# Base jurídica — fichas, valores e atualização automática por fontes oficiais

## O que é
- **Fichas** (`lib/sales/base-juridica/fichas.ts`): um tema por ficha (hoje: BPC), com requisitos, alegações do INSS, teses, prazos, fonte, data e validade.
- **Valores** (`valores.ts`): salário mínimo por vigência + calculadora de renda por pessoa.
- **Ferramentas do agente**: `crm_consultar_base_juridica` e `crm_calcular_renda_per_capita`.
- **Rotina automática** (`atualizar.ts`): lê as fontes oficiais, propõe mudanças com trecho literal, confere o trecho no texto baixado, grava a nova versão e guarda o histórico.

## Fontes oficiais aceitas (só https)
`*.gov.br` (Planalto, Diário Oficial `in.gov.br`, INSS, Previdência, Trabalho), `*.jus.br` (STF, STJ, TST, TRFs, TNU, CNJ), `*.leg.br` (Câmara, Senado).
Blogs, sites de escritório e portais jurídicos privados NÃO entram.

## Regras da atualização automática
1. Mudança sem trecho literal conferido no texto da fonte oficial é descartada.
2. Campos críticos (`prazos`, `requisitos`) exigem trechos conferidos de DUAS fontes diferentes; os demais, de uma.
3. O que muda fica "pendente de revisão": o agente continua usando a ficha, mas responde com ressalva.
4. Antes e depois ficam em `sales_base_juridica_historico` (reverter = regravar o `antes` em `sales_base_juridica_fichas`).
5. Salário mínimo: valor + trecho conferido na página oficial citada; fora de 90%–125% do atual é recusado.

## Criar as tabelas (uma vez, no SQL do Supabase)
```sql
create table if not exists public.sales_base_juridica_fichas (
  tema text primary key,
  conteudo jsonb not null,
  status text not null default 'pendente_revisao',
  revisado_em date not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por text not null default 'sistema'
);
create table if not exists public.sales_base_juridica_valores (
  chave text not null,
  vigente_desde date not null,
  valor numeric not null,
  fonte text not null,
  revisado_em date not null,
  confirmado boolean not null default false,
  primary key (chave, vigente_desde)
);
create table if not exists public.sales_base_juridica_historico (
  id bigserial primary key,
  tema text not null,
  antes jsonb,
  depois jsonb,
  mudancas jsonb,
  fontes jsonb,
  motivo text,
  em timestamptz not null default now(),
  ciencia_em timestamptz
);
alter table public.sales_base_juridica_fichas enable row level security;
alter table public.sales_base_juridica_valores enable row level security;
alter table public.sales_base_juridica_historico enable row level security;
```
(Sem políticas: só o servidor, com a chave de serviço, lê e escreve. Sem as tabelas, vale a base que vai no código.)

## Ligar a rotina (VPS, arquivo `.env` do Deskcomm)
```
BASE_JURIDICA_AUTO=1
BASE_JURIDICA_ANTHROPIC_KEY=<chave da API da Anthropic>
# opcionais
BASE_JURIDICA_MODEL=claude-sonnet-5-5
BASE_JURIDICA_INTERVALO_HORAS=24
```
Depois: `docker compose ... up -d app`. A primeira rodada sai 3 minutos após subir. Acompanhe: `docker logs deskcommcrm-app-1 2>&1 | grep base-juridica`.

## Ver o que a rotina mudou
```sql
select em, tema, mudancas from sales_base_juridica_historico order by em desc limit 20;
```
