-- AlterEnum
ALTER TYPE "service_token_scope" ADD VALUE 'CONFIRMATION_RESULTS_WRITE';

-- AlterTable
ALTER TABLE "confirmation_campaigns" ADD COLUMN     "response_deadline_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "confirmation_approval_snapshots" (
    "revision" CHAR(64) NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "confirmation_approval_snapshots_pkey" PRIMARY KEY ("revision")
);

-- CreateTable
CREATE TABLE "confirmation_responses" (
    "execution_key" CHAR(64) NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "revision" CHAR(64) NOT NULL,
    "appointment_ref" VARCHAR(128) NOT NULL,
    "appointment_time" VARCHAR(8) NOT NULL,
    "response_deadline_at" TIMESTAMPTZ(3) NOT NULL,
    "account_id" INTEGER NOT NULL,
    "inbox_id" INTEGER NOT NULL,
    "conversation_id" INTEGER,
    "transport_status" VARCHAR(32) NOT NULL,
    "delivery_status" VARCHAR(16),
    "response_status" VARCHAR(32) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "confirmation_responses_pkey" PRIMARY KEY ("execution_key")
);

-- CreateTable
CREATE TABLE "confirmation_response_events" (
    "event_id" CHAR(64) NOT NULL,
    "execution_key" CHAR(64) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "confirmation_response_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "confirmation_response_pending" (
    "id" UUID NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "execution_key" CHAR(64) NOT NULL,
    "reason" VARCHAR(64) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 0,
    "assigned_user_id" INTEGER,
    "resolution" VARCHAR(32),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "confirmation_response_pending_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmation_response_actions" (
    "id" SERIAL NOT NULL,
    "pending_id" UUID NOT NULL,
    "actor_user_id" INTEGER NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "resolution" VARCHAR(32),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "confirmation_response_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "confirmation_responses_campaign_id_idx" ON "confirmation_responses"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "confirmation_response_events_execution_key_sequence_key" ON "confirmation_response_events"("execution_key", "sequence");

-- CreateIndex
CREATE INDEX "confirmation_response_pending_campaign_id_status_idx" ON "confirmation_response_pending"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "confirmation_response_actions_pending_id_created_at_idx" ON "confirmation_response_actions"("pending_id", "created_at");
