# ENV VAR CLEANUP INSTRUCTIONS

PASSO OBRIGATÓRIO NA VERCEL:

1. Acesse o painel da Vercel > Settings > Environment Variables
2. **DELETE** a variável `PRISMA_CLIENT_ENGINE_TYPE`.
3. Verifique se existe alguma outra variável começando com `PRISMA_` e delete se houver.
4. Mantenha apenas:
   - `DATABASE_URL`
   - `DIRECT_URL` (se estiver usando)
   - `NEXT_PUBLIC_SUPABASE_...` e outras do app.

DEPOIS DISSO, FAÇA O REDEPLOY.
