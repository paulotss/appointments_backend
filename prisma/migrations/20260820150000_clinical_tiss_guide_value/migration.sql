-- AlterEnum
ALTER TYPE "clinical_appointment_status_enum" ADD VALUE 'falta';

-- AlterTable clinical_appointments
ALTER TABLE "clinical_appointments" ADD COLUMN "ends_at" TIMESTAMP(3);

UPDATE "clinical_appointments"
SET "ends_at" = "scheduled_at" + INTERVAL '30 minutes'
WHERE "ends_at" IS NULL;

ALTER TABLE "clinical_appointments" ALTER COLUMN "ends_at" SET NOT NULL;

CREATE INDEX "clinical_appointments_ends_at_idx" ON "clinical_appointments"("ends_at");

-- AlterTable health_plan_procedures
ALTER TABLE "health_plan_procedures" ADD COLUMN "tiss_code" VARCHAR(20);

UPDATE "health_plan_procedures" AS hpp
SET "tiss_code" = p."tiss_code"
FROM "procedures" AS p
WHERE hpp."procedure_id" = p."id";

ALTER TABLE "health_plan_procedures" ALTER COLUMN "tiss_code" SET NOT NULL;

CREATE UNIQUE INDEX "health_plan_procedures_health_plan_id_tiss_code_key"
  ON "health_plan_procedures"("health_plan_id", "tiss_code");

-- AlterTable procedures
DROP INDEX "procedures_tiss_code_key";

ALTER TABLE "procedures" DROP COLUMN "tiss_code";

-- AlterTable insurance_guide_procedures
ALTER TABLE "insurance_guide_procedures" ADD COLUMN "value" DECIMAL(10, 2);

UPDATE "insurance_guide_procedures" AS igp
SET "value" = src."value"
FROM (
  SELECT
    igp2."id",
    COALESCE(hpp."value", p."value") AS "value"
  FROM "insurance_guide_procedures" AS igp2
  INNER JOIN "insurance_guides" AS ig
    ON ig."id" = igp2."insurance_guide_id"
  INNER JOIN "procedures" AS p
    ON p."id" = igp2."procedure_id"
  LEFT JOIN "health_plan_procedures" AS hpp
    ON hpp."health_plan_id" = ig."health_plan_id"
   AND hpp."procedure_id" = igp2."procedure_id"
) AS src
WHERE igp."id" = src."id";

ALTER TABLE "insurance_guide_procedures" ALTER COLUMN "value" SET NOT NULL;
