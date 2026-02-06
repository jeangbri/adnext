# Implement Conversation Flows for AdNext Rules

## Context
The user wants to evolve the existing automation rule system to support multi-step conversational flows. Currently, rules are "Match -> Action -> End". The new system will allow "Match -> Action -> Wait for Input -> Check Condition -> Next Step".

## 1. Database Schema
Update `apps/web/prisma/schema.prisma`:

### New Model: `ConversationState`
```prisma
model ConversationState {
  id           String   @id @default(uuid())
  pageId       String
  senderPsid   String
  projectId    String? // Optional
  ruleId       String
  stepId       String   // Current step ID in the flow JSON
  status       String   // "waiting_input" | "finished"
  expectedType String   // "keyword" | "number" | "any"
  metadata     Json?    // Extra data
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  page         MessengerPage @relation(fields: [pageId], references: [pageId]) 
  // rule         AutomationRule @relation(fields: [ruleId], references: [id]) // Optional linking

  @@unique([pageId, senderPsid])
  @@index([expiresAt])
}
```

### Update Model: `AutomationRule`
Add `flow` field:
```prisma
model AutomationRule {
  // ... existing fields
  flow          Json?    // { enabled: boolean, steps: Step[] }
}
```

## 2. Types & Logic (`apps/web/src/lib/messenger-service.ts`)

### Types
Define Flow structure:
```typescript
type FlowStep = {
  id: string; // "step_1"
  type: "question";
  message: string; // Question text
  expectedType?: "keyword" | "number" | "any";
  conditions: FlowCondition[];
  fallback?: { message: string };
  expirationSeconds?: number;
};

type FlowCondition = {
  match: string; // The answer expected
  nextStep?: string; // ID of next step
  actions?: any[]; // Actions to execute if matched
};

type FlowConfig = {
  enabled: boolean;
  steps: FlowStep[];
};
```

### Logic Updates given `matchAndExecute`:

1.  **Intercept**: At the start of `matchAndExecute`, check for active `ConversationState`.
    *   `prisma.conversationState.findUnique({ where: { pageId_senderPsid: ... } })`
    *   If found:
        *   Check expiration. If `expiresAt < now`, delete and continue to normal rules.
        *   Call `processConditionalStep(state, text)`.
        *   Return (do not process normal rules).

2.  **Process Step** (`processConditionalStep`):
    *   Fetch Rule to get the `flow` config.
    *   Find current step in `flow.steps` using `state.stepId`.
    *   Compare `text` against `step.conditions`.
    *   **Match Found**:
        *   Execute condition actions (if any).
        *   If `nextStep`: Update `state.stepId` and `expiresAt` (reset timer). Send next step question.
        *   If `nextStep` is null/End: Delete state.
    *   **No Match**:
        *   Send `step.fallback.message`.
        *   Keep state (maybe decrement retries?).

3.  **Start Flow**:
    *   In `executeRule` (or after finding `matchedRule`):
    *   If `matchedRule.flow?.enabled` is true:
        *   Execute initial actions (if any).
        *   **Start State**: Create `ConversationState` pointing to `flow.steps[0].id`.
        *   Send Step 1 Message.
        *   Stop.

## 3. Frontend (`apps/web/src/app/(dashboard)/workflows/_components/rule-editor.tsx`)

*   Add a Switch/Toggle: "Enable Conversation Flow".
*   If Enabled:
    *   Show "Flow Designer" UI.
    *   List of Steps (Add/Remove).
    *   For each Step:
        *   ID (auto or edit).
        *   Message (Question).
        *   Expected Type (Select).
        *   Conditions Editor (Dynamic list: Value -> Next Step -> Actions).
        *   Fallback Message.

## 4. Migration & Compatibility
*   Run `npx prisma migrate dev --name add_conversation_states` (or `db push` if prototype).
*   Ensure old rules (flow=null) work as before.

## 5. Execution Plan
1.  **Schema**: Modify `schema.prisma`.
2.  **Migrate**: Apply DB changes.
3.  **Backend**: Implement `ConversationState` logic in `messenger-service.ts`.
4.  **Frontend**: Update `rule-editor.tsx`.
5.  **Test**: Verify flow.
