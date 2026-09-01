-- AlterTable
ALTER TABLE "insurance_guides" ADD COLUMN "authorization_date" DATE;

-- Backfill: data de autorização estimada como validade menos o prazo do plano
UPDATE "insurance_guides" AS ig
SET "authorization_date" = (ig."expiration_date" - (hp."submission_deadline_days" * INTERVAL '1 day'))::date
FROM "health_plans" AS hp
WHERE hp."id" = ig."health_plan_id";

UPDATE "insurance_guides"
SET "authorization_date" = "expiration_date"
WHERE "authorization_date" IS NULL;

ALTER TABLE "insurance_guides" ALTER COLUMN "authorization_date" SET NOT NULL;
