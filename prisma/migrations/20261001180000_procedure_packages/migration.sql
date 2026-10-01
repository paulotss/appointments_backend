-- CreateEnum
CREATE TYPE "clinical_appointment_procedure_origin_enum" AS ENUM ('particular', 'pacote', 'plano_de_saude');

-- CreateEnum
CREATE TYPE "patient_package_status_enum" AS ENUM ('ativo', 'esgotado', 'cancelado');

-- AlterEnum
ALTER TYPE "clinical_appointment_type_enum" ADD VALUE 'misto';

-- AlterEnum
ALTER TYPE "financial_entry_type_enum" ADD VALUE 'pacote_procedimento';

-- CreateTable
CREATE TABLE "procedure_packages" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procedure_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedure_package_items" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "procedure_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "procedure_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_packages" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "package_id" INTEGER NOT NULL,
    "status" "patient_package_status_enum" NOT NULL DEFAULT 'ativo',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_package_items" (
    "id" SERIAL NOT NULL,
    "patient_package_id" INTEGER NOT NULL,
    "procedure_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "used_quantity" INTEGER NOT NULL DEFAULT 0,
    "unit_value" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "patient_package_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "clinical_appointment_procedures"
ADD COLUMN "origin" "clinical_appointment_procedure_origin_enum" NOT NULL DEFAULT 'particular',
ADD COLUMN "patient_package_item_id" INTEGER,
ADD COLUMN "insurance_guide_id" INTEGER;

-- AlterTable
ALTER TABLE "financial_entries"
ADD COLUMN "patient_package_id" INTEGER;

-- Backfill origin and insurance guide from existing appointments
UPDATE "clinical_appointment_procedures" AS cap
SET "origin" = CASE ca."type"
    WHEN 'plano_de_saude' THEN 'plano_de_saude'::"clinical_appointment_procedure_origin_enum"
    ELSE 'particular'::"clinical_appointment_procedure_origin_enum"
END
FROM "clinical_appointments" AS ca
WHERE cap."clinical_appointment_id" = ca."id";

UPDATE "clinical_appointment_procedures" AS cap
SET "insurance_guide_id" = sub."insurance_guide_id"
FROM (
    SELECT cag."clinical_appointment_id", MIN(cag."insurance_guide_id") AS "insurance_guide_id"
    FROM "clinical_appointment_guides" AS cag
    INNER JOIN "clinical_appointments" AS ca ON ca."id" = cag."clinical_appointment_id"
    WHERE ca."type" = 'plano_de_saude'
    GROUP BY cag."clinical_appointment_id"
) AS sub
WHERE cap."clinical_appointment_id" = sub."clinical_appointment_id";

ALTER TABLE "clinical_appointment_procedures"
ALTER COLUMN "origin" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "procedure_package_items_package_id_procedure_id_key" ON "procedure_package_items"("package_id", "procedure_id");

-- CreateIndex
CREATE INDEX "procedure_package_items_procedure_id_idx" ON "procedure_package_items"("procedure_id");

-- CreateIndex
CREATE INDEX "patient_packages_patient_id_idx" ON "patient_packages"("patient_id");

-- CreateIndex
CREATE INDEX "patient_packages_package_id_idx" ON "patient_packages"("package_id");

-- CreateIndex
CREATE INDEX "patient_packages_status_idx" ON "patient_packages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "patient_package_items_patient_package_id_procedure_id_key" ON "patient_package_items"("patient_package_id", "procedure_id");

-- CreateIndex
CREATE INDEX "patient_package_items_procedure_id_idx" ON "patient_package_items"("procedure_id");

-- CreateIndex
CREATE INDEX "clinical_appointment_procedures_patient_package_item_id_idx" ON "clinical_appointment_procedures"("patient_package_item_id");

-- CreateIndex
CREATE INDEX "clinical_appointment_procedures_insurance_guide_id_idx" ON "clinical_appointment_procedures"("insurance_guide_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_entries_patient_package_id_key" ON "financial_entries"("patient_package_id");

-- AddForeignKey
ALTER TABLE "procedure_package_items" ADD CONSTRAINT "procedure_package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "procedure_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_package_items" ADD CONSTRAINT "procedure_package_items_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_packages" ADD CONSTRAINT "patient_packages_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_packages" ADD CONSTRAINT "patient_packages_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "procedure_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_package_items" ADD CONSTRAINT "patient_package_items_patient_package_id_fkey" FOREIGN KEY ("patient_package_id") REFERENCES "patient_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_package_items" ADD CONSTRAINT "patient_package_items_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_appointment_procedures" ADD CONSTRAINT "clinical_appointment_procedures_patient_package_item_id_fkey" FOREIGN KEY ("patient_package_item_id") REFERENCES "patient_package_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_appointment_procedures" ADD CONSTRAINT "clinical_appointment_procedures_insurance_guide_id_fkey" FOREIGN KEY ("insurance_guide_id") REFERENCES "insurance_guides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_patient_package_id_fkey" FOREIGN KEY ("patient_package_id") REFERENCES "patient_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
