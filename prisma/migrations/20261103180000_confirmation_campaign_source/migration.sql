-- Origem automática da campanha. Não altera campanhas já aprovadas.
ALTER TYPE "confirmation_audit_action" ADD VALUE 'ITEM_RECLASSIFIED';

CREATE TYPE "campaign_consultation_state" AS ENUM (
  'NOT_CONNECTED',
  'READY',
  'EMPTY',
  'PARTIAL',
  'FAILED'
);

ALTER TABLE "confirmation_campaigns"
  ADD COLUMN "consultation_state" "campaign_consultation_state" NOT NULL DEFAULT 'NOT_CONNECTED',
  ADD COLUMN "consultation_reason" VARCHAR(64);

ALTER TABLE "confirmation_campaign_items"
  ALTER COLUMN "appointment_ref" TYPE VARCHAR(128),
  ADD COLUMN "professional_ref" VARCHAR(64),
  ADD COLUMN "appointment_time" VARCHAR(8),
  ADD COLUMN "agenda_ref" VARCHAR(64),
  ADD COLUMN "source_resolution" VARCHAR(32),
  ADD COLUMN "is_minor" BOOLEAN;
