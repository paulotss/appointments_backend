-- AlterTable
ALTER TABLE "billing_batches" ADD COLUMN "batch_number" VARCHAR(40);

UPDATE "billing_batches"
SET "batch_number" = id::text || '-' || to_char("created_at" AT TIME ZONE 'UTC', 'YYYYMMDD')
WHERE "batch_number" IS NULL;

ALTER TABLE "billing_batches" ALTER COLUMN "batch_number" SET NOT NULL;

CREATE UNIQUE INDEX "billing_batches_batch_number_key" ON "billing_batches"("batch_number");

-- AlterTable
UPDATE "insurance_guides"
SET "guide_number" = NULL
WHERE "guide_number" IS NOT NULL AND btrim("guide_number") = '';

UPDATE "insurance_guides" AS g
SET "guide_number" = NULL
WHERE g."guide_number" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "insurance_guides" AS older
    WHERE older."guide_number" = g."guide_number"
      AND older.id < g.id
  );

CREATE UNIQUE INDEX "insurance_guides_guide_number_key" ON "insurance_guides"("guide_number");
