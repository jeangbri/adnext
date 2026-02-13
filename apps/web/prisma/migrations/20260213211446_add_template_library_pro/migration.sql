-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "flowDefinition" JSONB;

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessengerPage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "pageAccessToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT,
    "userId" TEXT,
    "getStartedPayload" TEXT,
    "iceBreakers" JSONB,
    "defaultRuleId" TEXT,

    CONSTRAINT "MessengerPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "psid" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "profilePicUrl" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageText" TEXT,
    "tags" JSONB,
    "pageId" TEXT,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "matchType" TEXT NOT NULL,
    "keywords" TEXT[],
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "normalizeAccents" BOOLEAN NOT NULL DEFAULT true,
    "matchOperator" TEXT NOT NULL,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 0,
    "schedule" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pageId" TEXT,
    "triggerType" TEXT NOT NULL DEFAULT 'MESSAGE_ANY',
    "triggerConfig" JSONB,
    "flow" JSONB,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationState" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "senderPsid" TEXT NOT NULL,
    "projectId" TEXT,
    "ruleId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expectedType" TEXT NOT NULL,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationAction" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "delayMs" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AutomationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "contactId" TEXT,
    "pageId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "incomingText" TEXT,
    "matchedRuleId" TEXT,
    "actionType" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "rawEvent" JSONB,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaignId" TEXT,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleExecution" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "pageId" TEXT,
    "lastExecutedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timesExecuted" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RuleExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastCampaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "audienceType" TEXT NOT NULL,
    "audienceFilter" JSONB,
    "sendMode" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "policyMode" TEXT NOT NULL,
    "tag" TEXT,
    "messageType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "totalSkipped" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BroadcastCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "userPsid" TEXT NOT NULL,
    "contactId" TEXT,
    "status" TEXT NOT NULL,
    "skipReason" TEXT,
    "metaMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "BroadcastRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "psid" TEXT NOT NULL,
    "lastUserMessageAt" TIMESTAMP(3),
    "lastPageMessageAt" TIMESTAMP(3),
    "lastInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageEvent" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "psid" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "payloadJson" JSONB,
    "ruleId" TEXT,
    "workflowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentEvent" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "message" TEXT,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramFollower" (
    "id" TEXT NOT NULL,
    "igUserId" TEXT NOT NULL,
    "username" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramFollower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledExecution" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "psid" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "nextIndex" INTEGER NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "refLogId" TEXT,
    "replyToCommentId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessengerTemplate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "pageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "metaTemplateId" TEXT,
    "contentJson" JSONB NOT NULL,
    "variablesJson" JSONB,
    "policy" TEXT NOT NULL DEFAULT '24H',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessengerTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateLog" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "policyUsed" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastJobV2" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "policyType" TEXT NOT NULL,
    "templateId" TEXT,
    "status" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastJobV2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastLogV2" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userPsid" TEXT NOT NULL,
    "templateId" TEXT,
    "messageCategory" TEXT,
    "lastInteractionAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "metaResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BroadcastLogV2_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_userId_slug_key" ON "Project"("userId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "MessengerPage_pageId_key" ON "MessengerPage"("pageId");

-- CreateIndex
CREATE INDEX "MessengerPage_userId_idx" ON "MessengerPage"("userId");

-- CreateIndex
CREATE INDEX "MessengerPage_projectId_idx" ON "MessengerPage"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MessengerPage_userId_pageId_key" ON "MessengerPage"("userId", "pageId");

-- CreateIndex
CREATE INDEX "Contact_pageId_idx" ON "Contact"("pageId");

-- CreateIndex
CREATE INDEX "Contact_workspaceId_idx" ON "Contact"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_pageId_psid_key" ON "Contact"("pageId", "psid");

-- CreateIndex
CREATE INDEX "AutomationRule_workspaceId_isActive_idx" ON "AutomationRule"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "AutomationRule_pageId_triggerType_idx" ON "AutomationRule"("pageId", "triggerType");

-- CreateIndex
CREATE INDEX "ConversationState_expiresAt_idx" ON "ConversationState"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationState_pageId_senderPsid_key" ON "ConversationState"("pageId", "senderPsid");

-- CreateIndex
CREATE INDEX "AutomationAction_ruleId_order_idx" ON "AutomationAction"("ruleId", "order");

-- CreateIndex
CREATE INDEX "MessageLog_pageId_createdAt_idx" ON "MessageLog"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageLog_contactId_idx" ON "MessageLog"("contactId");

-- CreateIndex
CREATE INDEX "RuleExecution_pageId_lastExecutedAt_idx" ON "RuleExecution"("pageId", "lastExecutedAt");

-- CreateIndex
CREATE INDEX "RuleExecution_ruleId_idx" ON "RuleExecution"("ruleId");

-- CreateIndex
CREATE INDEX "BroadcastCampaign_workspaceId_pageId_status_idx" ON "BroadcastCampaign"("workspaceId", "pageId", "status");

-- CreateIndex
CREATE INDEX "BroadcastCampaign_scheduledAt_idx" ON "BroadcastCampaign"("scheduledAt");

-- CreateIndex
CREATE INDEX "BroadcastRecipient_campaignId_status_idx" ON "BroadcastRecipient"("campaignId", "status");

-- CreateIndex
CREATE INDEX "BroadcastRecipient_workspaceId_pageId_createdAt_idx" ON "BroadcastRecipient"("workspaceId", "pageId", "createdAt");

-- CreateIndex
CREATE INDEX "BroadcastRecipient_userPsid_idx" ON "BroadcastRecipient"("userPsid");

-- CreateIndex
CREATE INDEX "Conversation_pageId_lastInteractionAt_idx" ON "Conversation"("pageId", "lastInteractionAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_pageId_psid_key" ON "Conversation"("pageId", "psid");

-- CreateIndex
CREATE INDEX "MessageEvent_pageId_direction_createdAt_idx" ON "MessageEvent"("pageId", "direction", "createdAt");

-- CreateIndex
CREATE INDEX "MessageEvent_pageId_source_idx" ON "MessageEvent"("pageId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "CommentEvent_commentId_key" ON "CommentEvent"("commentId");

-- CreateIndex
CREATE INDEX "CommentEvent_pageId_postId_idx" ON "CommentEvent"("pageId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramFollower_igUserId_accountId_key" ON "InstagramFollower"("igUserId", "accountId");

-- CreateIndex
CREATE INDEX "ScheduledExecution_status_runAt_idx" ON "ScheduledExecution"("status", "runAt");

-- CreateIndex
CREATE INDEX "ScheduledExecution_pageId_psid_idx" ON "ScheduledExecution"("pageId", "psid");

-- CreateIndex
CREATE INDEX "MessengerTemplate_pageId_category_idx" ON "MessengerTemplate"("pageId", "category");

-- CreateIndex
CREATE INDEX "TemplateLog_templateId_status_idx" ON "TemplateLog"("templateId", "status");

-- CreateIndex
CREATE INDEX "BroadcastJobV2_pageId_status_idx" ON "BroadcastJobV2"("pageId", "status");

-- CreateIndex
CREATE INDEX "BroadcastJobV2_scheduledAt_idx" ON "BroadcastJobV2"("scheduledAt");

-- CreateIndex
CREATE INDEX "BroadcastLogV2_jobId_status_idx" ON "BroadcastLogV2"("jobId", "status");

-- CreateIndex
CREATE INDEX "BroadcastLogV2_userPsid_idx" ON "BroadcastLogV2"("userPsid");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessengerPage" ADD CONSTRAINT "MessengerPage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessengerPage" ADD CONSTRAINT "MessengerPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessengerPage" ADD CONSTRAINT "MessengerPage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessengerPage" ADD CONSTRAINT "MessengerPage_defaultRuleId_fkey" FOREIGN KEY ("defaultRuleId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MessengerPage"("pageId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MessengerPage"("pageId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MessengerPage"("pageId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationAction" ADD CONSTRAINT "AutomationAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MessengerPage"("pageId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "BroadcastCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleExecution" ADD CONSTRAINT "RuleExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleExecution" ADD CONSTRAINT "RuleExecution_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleExecution" ADD CONSTRAINT "RuleExecution_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MessengerPage"("pageId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastCampaign" ADD CONSTRAINT "BroadcastCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastCampaign" ADD CONSTRAINT "BroadcastCampaign_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MessengerPage"("pageId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastRecipient" ADD CONSTRAINT "BroadcastRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "BroadcastCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MessengerPage"("pageId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageEvent" ADD CONSTRAINT "MessageEvent_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MessengerPage"("pageId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentEvent" ADD CONSTRAINT "CommentEvent_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MessengerPage"("pageId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramFollower" ADD CONSTRAINT "InstagramFollower_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InstagramAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessengerTemplate" ADD CONSTRAINT "MessengerTemplate_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MessengerPage"("pageId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateLog" ADD CONSTRAINT "TemplateLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessengerTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastJobV2" ADD CONSTRAINT "BroadcastJobV2_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MessengerPage"("pageId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastJobV2" ADD CONSTRAINT "BroadcastJobV2_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessengerTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastLogV2" ADD CONSTRAINT "BroadcastLogV2_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BroadcastJobV2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
