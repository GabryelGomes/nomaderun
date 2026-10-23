# Deploy do backend no Supabase Cloud (P-08)

> Dono: A2 Backend. Vale para o CLI fixo no `package.json` da raiz (`supabase@2.121.0`).
> Resumo: `SUPABASE_ACCESS_TOKEN=… PROJECT_REF=… SUPABASE_DB_PASSWORD=… npm run deploy` (script `supabase/scripts/deploy.sh`).

## 0. Antes de começar

- Node 22 e `npm install` na raiz (instala o CLI); Docker rodando (o CLI usa o Docker para empacotar as functions); Deno 2 para os testes (`npm i -g deno@2.5.6`).
- Confira localmente: `npm run db:reset`, `npm run db:test:psql`, `npm run functions:test`, `npm run functions:check`, `npm run e2e`.
- **Domain fora de `supabase/` (D-02/D-22):** `npm run functions:bundle-check` roda o mesmo `edge-runtime bundle` que o `supabase functions deploy` usa no Docker, gera o eszip das 8 functions, confere que o domain e o h3-js estão dentro e sobe o eszip de `finish-activity` num edge-runtime limpo (só o arquivo `.eszip` montado). Resultado em 2026-10-20: **ok** — o deploy padrão (Docker) aceita o domain do app (plano A). O que não deu para testar sem conta: o upload do eszip para a API do Supabase (o proxy deste ambiente bloqueia `api.supabase.com`), que não reprocessa os imports.

## 1. Criar o projeto

1. <https://supabase.com/dashboard> → **New project** → região **South America (São Paulo)** → anote a **senha do banco**.
2. Anote o **Project ref** (20 letras na URL `…/project/<ref>`).
3. Crie um token pessoal em **Account → Access Tokens**.

## 2. Vincular, migrations e functions

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...      # nunca commitar
export PROJECT_REF=abcdefghijklmnopqrst
export SUPABASE_DB_PASSWORD='...'
npm run deploy                            # = bash supabase/scripts/deploy.sh
```

O script faz, nesta ordem:

| Passo | Comando | Observação |
|---|---|---|
| Testes | `npm run functions:test`, `domain-copy.mjs --check`, `bundle-check.sh` | `SKIP_CHECKS=1` pula |
| Vincular | `supabase link --project-ref $PROJECT_REF -p $SUPABASE_DB_PASSWORD` | |
| Banco | `supabase db push --dry-run` e depois `supabase db push` | aplica `supabase/migrations` (PostGIS, pg_cron, RLS, RPCs, jobs, Realtime em `zones` e `notifications`) |
| Seed | `supabase db push --include-seed` **só com `WITH_SEED=1`** | dados de **demonstração** (271 zonas de Goiânia, contas `*.demo@nomaderun.app` com senhas públicas no PROGRESSO). Em produção real, não use; para a apresentação, use e troque as senhas depois |
| Auth | `supabase config push --yes` **só com `CONFIG_PUSH=1`** | veja a seção 3; rode `npx supabase config diff` antes |
| Functions | `supabase functions deploy` | as 8 functions; `verify_jwt = false` e `import_map = ./functions/deno.json` vêm do `config.toml` (D-24) |

Manual equivalente: os mesmos comandos com `npx supabase ...`.

### Secrets

Nenhum segredo próprio é necessário: o Supabase injeta `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` nas functions (`_shared/supabase.ts` só lê esses três). Se o projeto usar só as chaves novas (`sb_secret_…`) e não injetar a `SUPABASE_SERVICE_ROLE_KEY`, defina: `npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<sb_secret_...>` (nomes com prefixo `SUPABASE_` podem ser recusados pelo CLI; nesse caso ative as chaves legadas em **Project Settings → API Keys**). Nunca coloque a service role no app.

## 3. Auth (painel ou `CONFIG_PUSH=1`)

Em **Authentication → Sign In / Providers / URL Configuration / Rate Limits / Emails** (ou `CONFIG_PUSH=1`, que envia o `config.toml`):

- **E-mail e senha** ligados; senha mínima **8**; **Confirm email desligado** no MVP (D-21) — ligue se houver SMTP.
- **JWT expiry 3600 s**, rotação de refresh token ligada.
- **Site URL** `nomaderun://`; **Redirect URLs**: `nomaderun://**`, `exp://**` (Expo Go), `http://localhost:8081/**` e a URL do painel web se publicado.
- **Rate limit de login/cadastro (P-09, QA-06):** o `config.toml` usa `sign_in_sign_ups = 3` por 5 min **por IP** (≈ RNF-007). O limite soma cadastro, login **e a conferência de senha da exclusão de conta** (`account-delete` reautentica pelo Auth). Só vale no Cloud (o Auth local não vê o IP do cliente). **Para a apresentação** (banca e plateia na mesma rede saem pelo mesmo IP/NAT):
  1. Antes (no dia anterior): **Authentication → Rate Limits → "Sign-ups and sign-ins"** = **30** por 5 min (ou `sign_in_sign_ups = 30` no `config.toml` e `npx supabase config push`). Confira com 4 logins seguidos do mesmo aparelho (nenhum `429`).
  2. Não mude `token_refresh` (150) nem os demais.
  3. Depois da apresentação: volte para **3** (valor do RNF-007, D-21) e confira com `npx supabase config diff` que não sobrou diferença.
  Se travar no meio (`429` / "Muitas tentativas"), suba o limite no painel; vale na hora, sem redeploy.
- **Troca de senha com reautenticação:** `secure_password_change = true` (QA-06) — vai no `config push`; no painel: **Authentication → Providers → Email → Secure password change**.
- **Conta inativada sem acesso (QA-07):** a migration `20261022120000_qa_hardening.sql` faz `alter role authenticator set pgrst.db_pre_request = 'public.check_request'` e `notify pgrst, 'reload config'`. Depois do `db push`, confira no SQL Editor: `select setconfig from pg_db_role_setting s join pg_roles r on r.oid = s.setrole where r.rolname = 'authenticator';` deve listar `pgrst.db_pre_request=public.check_request`. Se o Cloud recusar o `alter role`, rode a linha no SQL Editor (as policies restritivas continuam barrando a conta inativa de qualquer forma).
- **Linhas por resposta (QA-04):** `max_rows = 2000` em `[api]` (painel: **Project Settings → Data API → Max rows**). O `/zones` não depende disso (usa `zones_in_bbox_json`).
- **SMTP (opcional):** o envio padrão do Supabase tem limite baixo (poucos e-mails por hora) e serve só para testes. Para recuperação de senha confiável, configure um SMTP (Resend, SendGrid, Brevo) em **Authentication → Emails → SMTP Settings**; o modelo em pt-BR é `supabase/templates/recovery.html`. No plano gratuito sem SMTP o Supabase recusa trocar o modelo e o `config push` falha inteiro; por isso a seção `[auth.email.template.recovery]` do `config.toml` fica comentada — descomente só depois de configurar o SMTP.
- Google/Apple só com credenciais reais (P-06).

## 4. Conferir

```bash
curl -i "https://$PROJECT_REF.supabase.co/functions/v1/zones?bbox=-49.3,-16.8,-49.2,-16.7"   # 401 UNAUTHORIZED (sem token) = function no ar
npx supabase migration list            # todas as migrations aplicadas no remoto
npx supabase db advisors --linked      # segurança e desempenho
```

Depois, rode o e2e contra o Cloud (cria e apaga uma conta de teste; precisa da service role, use só no seu terminal):

```bash
API_URL=https://$PROJECT_REF.supabase.co ANON_KEY=<publishable/anon> SERVICE_ROLE_KEY=<service role> \
  deno run --allow-net --allow-env --allow-read --config supabase/functions/deno.json supabase/scripts/e2e.ts
```
(o trecho de RN-010 do e2e usa a conta de moderador de demonstração: só passa com `WITH_SEED=1`).

No app (`apps/mobile/.env`): `EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co` e `EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable/anon>`.

## 5. Se o deploy das functions falhar por causa do domain (plano B da D-02)

Sintoma: erro de módulo não encontrado em `apps/mobile/src/domain/...` no deploy, ou uso de `--use-api` (bundling no servidor do Supabase, que só recebe os arquivos de `supabase/`).

```bash
npm run domain:copy            # copia o domain para supabase/functions/_shared/domain_copy e aponta a ponte para a cópia
npm run functions:test         # o teste domain_bridge confere que a cópia é idêntica ao domain
npm run functions:bundle-check # no plano B monta só supabase/ (prova que a cópia é autossuficiente)
npm run deploy                 # ou USE_API=1 npm run deploy (sem Docker)
npm run domain:copy:restore    # volta ao plano A depois do deploy (não commite a cópia sem combinar com a coordenação)
```

Mudou o domain? Rode `npm run domain:copy` de novo antes do próximo deploy (`npm run domain:copy:check` falha se a cópia estiver velha; o `deploy.sh` roda essa checagem).

## 6. Jobs e Realtime

- Os 4 jobs do pg_cron (RN-004, RN-005, RN-006, RN-014) são criados pela migration; confira em **Database → Cron Jobs** (horários em UTC = Brasília + 3 h).
- Realtime: `zones` (mapa) e `notifications` (central, P-13) estão na publicação `supabase_realtime`; a RLS vale para quem assina.
