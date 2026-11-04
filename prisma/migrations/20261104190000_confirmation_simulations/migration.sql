ALTER TYPE "service_token_scope" ADD VALUE 'CONFIRMATION_SIMULATE';

CREATE TABLE "confirmation_simulations" (
  "id" UUID NOT NULL,
  "campaign_id" INTEGER NOT NULL,
  "revision" CHAR(64) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'RUNNING',
  "claim_hash" CHAR(64) NOT NULL,
  "lease_until" TIMESTAMP(3) NOT NULL,
  "service_token_id" INTEGER NOT NULL,
  "report" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "confirmation_simulations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "confirmation_simulations_status_check" CHECK ("status" IN ('RUNNING', 'COMPLETED', 'INVALIDATED')),
  CONSTRAINT "confirmation_simulations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "confirmation_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "confirmation_simulations_service_token_id_fkey" FOREIGN KEY ("service_token_id") REFERENCES "service_access_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "confirmation_simulations_campaign_id_revision_key" ON "confirmation_simulations"("campaign_id", "revision");
