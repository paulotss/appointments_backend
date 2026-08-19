-- CreateTable
CREATE TABLE "clinical_appointment_guides" (
    "id" SERIAL NOT NULL,
    "clinical_appointment_id" INTEGER NOT NULL,
    "insurance_guide_id" INTEGER NOT NULL,

    CONSTRAINT "clinical_appointment_guides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinical_appointment_guides_clinical_appointment_id_insurance_guide_id_key" ON "clinical_appointment_guides"("clinical_appointment_id", "insurance_guide_id");

-- CreateIndex
CREATE INDEX "clinical_appointment_guides_insurance_guide_id_idx" ON "clinical_appointment_guides"("insurance_guide_id");

-- AddForeignKey
ALTER TABLE "clinical_appointment_guides" ADD CONSTRAINT "clinical_appointment_guides_clinical_appointment_id_fkey" FOREIGN KEY ("clinical_appointment_id") REFERENCES "clinical_appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_appointment_guides" ADD CONSTRAINT "clinical_appointment_guides_insurance_guide_id_fkey" FOREIGN KEY ("insurance_guide_id") REFERENCES "insurance_guides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate existing single-guide links
INSERT INTO "clinical_appointment_guides" ("clinical_appointment_id", "insurance_guide_id")
SELECT "id", "insurance_guide_id"
FROM "clinical_appointments"
WHERE "insurance_guide_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "clinical_appointments" DROP CONSTRAINT "clinical_appointments_insurance_guide_id_fkey";

-- DropIndex
DROP INDEX "clinical_appointments_insurance_guide_id_idx";

-- AlterTable
ALTER TABLE "clinical_appointments" DROP COLUMN "insurance_guide_id";
