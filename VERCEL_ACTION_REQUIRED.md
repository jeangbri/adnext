[Vercel Env Var Action Required]

O erro "Invalid client engine type, please use 'library'" indica que o Prisma está configurado para esperar uma biblioteca (Library) mas a variável de ambiente `PRISMA_CLIENT_ENGINE_TYPE=binary` está forçando ele a procurar um binário que não existe no bundle.

**SOLUÇÃO:**

1. Acesse o painel da **Vercel** > Settings > Environment Variables.
2. DELETE a variável `PRISMA_CLIENT_ENGINE_TYPE`.
   (Ou mude o valor dela para `library`).
3. Vá em **Deployments**, clique nos 3 pontos (...) do último deploy e selecione **Redeploy**.

Isso fará o Prisma usar o padrão "library", para o qual já configuramos a inclusão correta dos arquivos.
