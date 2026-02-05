# Configuração do Broadcast Runner

Para que o sistema de Broadcast funcione corretamente e envie mensagens agendadas ou em lote, é necessário que o endpoint `/api/broadcast/runner` seja chamado frequentemente (recomendado: a cada 1 minuto).

## Limitações do Plano Vercel Hobby

O plano gratuito da Vercel (Hobby) permite Cron Jobs apenas **uma vez por dia**. Isso não é suficiente para um sistema de broadcast em tempo real. Por isso, configurei o `vercel.json` para rodar diariamente apenas para evitar erros de deploy.

## Solução Recomendada: Cron Externo Gratuito

Para obter execução a cada minuto gratuitamente, utilize um serviço externo como **cron-job.org** ou **EasyCron**.

### Passo a Passo (cron-job.org):

1. Crie uma conta gratuita em [cron-job.org](https://cron-job.org/).
2. Clique em "Create Cronjob".
3. **URL**: Digite a URL completa do seu endpoint runner.
   - Exemplo: `https://sua-app.vercel.app/api/broadcast/runner?key=SEU_RUNNER_SECRET`
   - *Nota*: Você pode encontrar o `RUNNER_SECRET` no seu arquivo `.env` ou nas configurações da Vercel.
4. **Execution Schedule**: Selecione "Every minute" (Todos os minutos).
5. Salve.

Isso garantirá que seu sistema processe campanhas e filas de envio rapidamente, sem depender das limitações da Vercel.
