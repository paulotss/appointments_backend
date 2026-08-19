-- CreateEnum
CREATE TYPE "insurance_guide_status_enum" AS ENUM ('pendente', 'em_analise', 'autorizada');

-- CreateEnum
CREATE TYPE "clinical_appointment_status_enum" AS ENUM ('marcado', 'confirmado', 'em_espera', 'atendido', 'finalizado');

-- CreateEnum
CREATE TYPE "clinical_appointment_type_enum" AS ENUM ('particular', 'plano_de_saude');

-- CreateTable
CREATE TABLE "procedures" (
    "id" SERIAL NOT NULL,
    "specialty_id" INTEGER NOT NULL,
    "tiss_code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "procedures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "procedures_tiss_code_key" ON "procedures"("tiss_code");

-- CreateIndex
CREATE INDEX "procedures_specialty_id_idx" ON "procedures"("specialty_id");

-- AddForeignKey
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "health_plan_procedures" (
    "id" SERIAL NOT NULL,
    "health_plan_id" INTEGER NOT NULL,
    "procedure_id" INTEGER NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "health_plan_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "health_plan_procedures_health_plan_id_procedure_id_key" ON "health_plan_procedures"("health_plan_id", "procedure_id");

-- CreateIndex
CREATE INDEX "health_plan_procedures_procedure_id_idx" ON "health_plan_procedures"("procedure_id");

-- AddForeignKey
ALTER TABLE "health_plan_procedures" ADD CONSTRAINT "health_plan_procedures_health_plan_id_fkey" FOREIGN KEY ("health_plan_id") REFERENCES "health_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_plan_procedures" ADD CONSTRAINT "health_plan_procedures_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable insurance_guides
ALTER TABLE "insurance_guides" DROP CONSTRAINT "insurance_guides_specialty_id_fkey";

DROP INDEX "insurance_guides_specialty_id_idx";

ALTER TABLE "insurance_guides" DROP COLUMN "specialty_id";
ALTER TABLE "insurance_guides" DROP COLUMN "quantity";
ALTER TABLE "insurance_guides" ADD COLUMN "status" "insurance_guide_status_enum" NOT NULL DEFAULT 'pendente';

CREATE INDEX "insurance_guides_status_idx" ON "insurance_guides"("status");

-- CreateTable
CREATE TABLE "insurance_guide_procedures" (
    "id" SERIAL NOT NULL,
    "insurance_guide_id" INTEGER NOT NULL,
    "procedure_id" INTEGER NOT NULL,
    "authorized_quantity" INTEGER NOT NULL,
    "used_quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "insurance_guide_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "insurance_guide_procedures_insurance_guide_id_procedure_id_key" ON "insurance_guide_procedures"("insurance_guide_id", "procedure_id");

-- CreateIndex
CREATE INDEX "insurance_guide_procedures_procedure_id_idx" ON "insurance_guide_procedures"("procedure_id");

-- AddForeignKey
ALTER TABLE "insurance_guide_procedures" ADD CONSTRAINT "insurance_guide_procedures_insurance_guide_id_fkey" FOREIGN KEY ("insurance_guide_id") REFERENCES "insurance_guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_guide_procedures" ADD CONSTRAINT "insurance_guide_procedures_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "clinical_appointments" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "health_professional_id" INTEGER NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "clinical_appointment_status_enum" NOT NULL DEFAULT 'marcado',
    "type" "clinical_appointment_type_enum" NOT NULL,
    "insurance_guide_id" INTEGER,

    CONSTRAINT "clinical_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinical_appointments_patient_id_idx" ON "clinical_appointments"("patient_id");

-- CreateIndex
CREATE INDEX "clinical_appointments_health_professional_id_idx" ON "clinical_appointments"("health_professional_id");

-- CreateIndex
CREATE INDEX "clinical_appointments_scheduled_at_idx" ON "clinical_appointments"("scheduled_at");

-- CreateIndex
CREATE INDEX "clinical_appointments_status_idx" ON "clinical_appointments"("status");

-- CreateIndex
CREATE INDEX "clinical_appointments_type_idx" ON "clinical_appointments"("type");

-- CreateIndex
CREATE INDEX "clinical_appointments_insurance_guide_id_idx" ON "clinical_appointments"("insurance_guide_id");

-- AddForeignKey
ALTER TABLE "clinical_appointments" ADD CONSTRAINT "clinical_appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_appointments" ADD CONSTRAINT "clinical_appointments_health_professional_id_fkey" FOREIGN KEY ("health_professional_id") REFERENCES "health_professionals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_appointments" ADD CONSTRAINT "clinical_appointments_insurance_guide_id_fkey" FOREIGN KEY ("insurance_guide_id") REFERENCES "insurance_guides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "clinical_appointment_procedures" (
    "id" SERIAL NOT NULL,
    "clinical_appointment_id" INTEGER NOT NULL,
    "procedure_id" INTEGER NOT NULL,

    CONSTRAINT "clinical_appointment_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinical_appointment_procedures_clinical_appointment_id_procedure_id_key" ON "clinical_appointment_procedures"("clinical_appointment_id", "procedure_id");

-- CreateIndex
CREATE INDEX "clinical_appointment_procedures_procedure_id_idx" ON "clinical_appointment_procedures"("procedure_id");

-- AddForeignKey
ALTER TABLE "clinical_appointment_procedures" ADD CONSTRAINT "clinical_appointment_procedures_clinical_appointment_id_fkey" FOREIGN KEY ("clinical_appointment_id") REFERENCES "clinical_appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_appointment_procedures" ADD CONSTRAINT "clinical_appointment_procedures_procedure_id_fkey" FOREIGN KEY ("procedure_id") REFERENCES "procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
