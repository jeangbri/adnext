# TASK_BROADCAST_V2 - Implementar Sistema de Broadcast V2 (Messenger)

## Objetivo
Implementar um novo sistema de envio Messenger Broadcast totalmente compatível com as novas regras da Meta, mantendo o sistema atual funcional sem regressões. A nova arquitetura deve coexistir com o sistema atual e ser ativada gradualmente via feature flag.

## Feature Flag
- [x] Criar `NEXT_PUBLIC_BROADCAST_V2` em `.env` (ou similar)
- [x] Usar feature flag no frontend e backend para alternar entre sistemas.

## Banco de Dados
- [x] Adicionar tabela `messenger_templates`
- [x] Adicionar tabela `broadcast_jobs_v2`
- [x] Adicionar tabela `broadcast_logs_v2`
- [x] Rodar migração

## Backend (Core Logic)
- [x] Criar diretório `apps/web/src/lib/messenger/broadcast-v2/`
- [x] Implementar `template-registry.ts`: Gerenciamento de templates (CRUD, aprovação).
- [x] Implementar `policy-engine.ts`: Validação de regras de envio (24h vs fora, utility).
- [x] Implementar `message-classifier.ts`: Detecção de conteúdo de marketing (palavras proibidas).
- [x] Implementar `compliance-guard.ts`: Pipeline de validação centralizada.
- [x] Implementar `utility-sender.ts`: Envio de mensagens 'utility'.
- [x] Implementar `broadcast-runner-v2.ts`: Processamento de jobs via cron.

## API Endpoints
- [x] `POST /api/messenger/send-utility`: Endpoint para envio utility.
- [x] `GET /api/broadcast/runner-v2`: Endpoint para rodar o runner (cron).

## Frontend (UI/UX)
- [x] Atualizar criação de broadcast para suportar V2.
- [x] Bloquear textarea livre fora da janela de 24h.
- [x] Adicionar seleção de template aprovado e contexto utility.
- [x] Exibir opções baseadas na feature flag.

## Testes & Validação
- [x] Teste: Envio dentro de 24h (texto livre).
- [x] Teste: Envio fora de 24h com template utility aprovado.
- [x] Teste: Bloqueio de envio fora de 24h com marketing.
- [x] Teste: Bloqueio de envio fora de 24h sem template.
- [x] Teste: Rollback automático (fallback para V1 se erro).

## Segurança
- [x] Validar aprovação de template.
- [x] Validar categoria Utility.
- [x] Enforce Utility fora da janela de 24h.

