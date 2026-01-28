# Lista de Verificação de Implantação (Vercel)

O erro "Server-side exception" (500) geralmente ocorre quando variáveis de ambiente essenciais estão faltando no ambiente de produção (Vercel), fazendo com que o Middleware ou o Server Side Rendering falhem ao inicializar serviços (como o Supabase).

## 1. Variáveis de Ambiente Obrigatórias
Verifique se as seguintes variáveis estão configuradas nas **Settings > Environment Variables** do seu projeto na Vercel.

| Variável | Descrição | Exemplo de Valor |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública anônima | `eyJxh...` |
| `APP_URL` | URL da aplicação em produção | `https://creatyev2-web.vercel.app` |
| `DATABASE_URL` | Connection String do Prisma (Transaction Mode) | `postgres://...?pgbouncer=true` |
| `DIRECT_URL` | Connection String do Prisma (Session Mode) | `postgres://...` |

> **Nota Crítica**: O arquivo `src/middleware.ts` usa `process.env.NEXT_PUBLIC_SUPABASE_URL!` com uma asserção de não-nulo (!). Se essa variável não estiver na Vercel, o middleware falhará em **todas as requisições**, causando o erro que você está vendo.

## 2. Configuração do Instagram (Se aplicável)
Para o login com Instagram funcionar em produção, as variáveis e configurações no painel da Meta devem corresponder à URL da Vercel.

| Variável | Valor em Produção |
|---|---|
| `IG_REDIRECT_URI` | `https://creatyev2-web.vercel.app/api/instagram/callback` |

*   **Meta for Developers**: Adicione a URL da Vercel nas configurações de "OAuth Redirect URIs" do seu App no painel da Meta.

## 3. Próximos Passos
1.  Acesse o painel da Vercel.
2.  Vá em **Settings** -> **Environment Variables**.
3.  Adicione as variáveis faltantes (copie do seu `.env` local, mas ajuste as URLs).
4.  Vá em **Deployments**, clique nos três pontos do último deploy e selecione **Redeploy** (para que as novas variáveis tenham efeito).
