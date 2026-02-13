# TASK_MESSENGER_UPDATE - Mensageria Avançada Compliance Meta

## Objetivo
Atualizar o sistema de mensageria para total conformidade com as novas políticas da Meta (2025), implementando "Smart Broadcast", delays assíncronos via Redis, isolamento por página e fluxo condicional, sem quebrar funcionalidades legadas.

## 1. Core Logic (Libs)
- [ ] **Policy Engine** (`src/lib/messenger/policy-engine.ts`):
    - Classificação de mensagens (24h vs Utility/Template).
    - Validação de janelas de interação.
- [ ] **Template System** (`src/lib/messenger/templates.ts`):
    - Builders para Utility, Follow-up, Reminder.
    - Seleção automática de estratégia de envio.

## 2. Infraestrutura de Delays (Async)
- [ ] Instalar `@upstash/redis` (se necessário).
- [ ] **Delay Queue** (`src/lib/queue/delay-queue.ts`):
    - Implementar agendamento de delays (zadd/zrange).
    - Estrutura de jobs: `{ pageId, userId, ruleId, stepIndex, context }`.

## 3. Automation Runner (Worker)
- [ ] **API Endpoint** (`src/app/api/messenger/runner/route.ts`):
    - Processamento de filas de delay vencidos.
    - Reavaliação de política antes do envio (Smart Resume).
    - Execução do próximo passo do fluxo.

## 4. Updates no Messenger Service
- [ ] **Refatorar `messenger-service.ts`**:
    - Integrar `PolicyEngine`.
    - Substituir `setTimeout` por `DelayQueue.enqueue`.
    - Implementar lógica de "Smart Send" (auto-convert to template if needed).

## 5. Broadcast & Fluxos
- [ ] **Smart Broadcast**:
    - Validar policy antes de cada envio em massa.
    - Fallback para Template fora da janela de 24h.
- [ ] **Condicionais**:
    - Suporte a nós de decisão (`wait_for_reply`, `if/else`).

## 6. Logs & Observabilidade
- [ ] Estruturar logs detalhados para auditoria de compliance.

## 7. Testes
- [ ] Teste unitário do Policy Engine.
- [ ] Teste de integração do Delay Queue.

## 8. Finalização
- [ ] Validar variáveis de ambiente (Redis).
- [ ] Reiniciar servidor.
