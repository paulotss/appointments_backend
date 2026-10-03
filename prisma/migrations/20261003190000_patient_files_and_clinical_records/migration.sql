-- CreateEnum
CREATE TYPE "patient_file_kind" AS ENUM ('MEDICAL_ORDER', 'PRESCRIPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "patient_file_origin" AS ENUM ('UPLOAD', 'GENERATED');

-- CreateTable
CREATE TABLE "patient_files" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "kind" "patient_file_kind" NOT NULL,
    "origin" "patient_file_origin" NOT NULL,
    "title" VARCHAR(200),
    "original_name" VARCHAR(255),
    "storage_key" VARCHAR(500),
    "mime_type" VARCHAR(100),
    "size_bytes" INTEGER,
    "content" JSONB,
    "created_by_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_clinical_charts" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "allergies" TEXT,
    "chronic_conditions" TEXT,
    "current_medications" TEXT,
    "personal_history" TEXT,
    "family_history" TEXT,
    "habits" TEXT,
    "updated_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_clinical_charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_evolutions" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "health_professional_id" INTEGER NOT NULL,
    "clinical_appointment_id" INTEGER,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "subjective" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "assessment" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_evolutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_clinical_charts_patient_id_key" ON "patient_clinical_charts"("patient_id");

-- CreateIndex
CREATE INDEX "patient_files_patient_id_idx" ON "patient_files"("patient_id");

-- CreateIndex
CREATE INDEX "patient_files_created_by_user_id_idx" ON "patient_files"("created_by_user_id");

-- CreateIndex
CREATE INDEX "clinical_evolutions_patient_id_idx" ON "clinical_evolutions"("patient_id");

-- CreateIndex
CREATE INDEX "clinical_evolutions_health_professional_id_idx" ON "clinical_evolutions"("health_professional_id");

-- CreateIndex
CREATE INDEX "clinical_evolutions_clinical_appointment_id_idx" ON "clinical_evolutions"("clinical_appointment_id");

-- AddForeignKey
ALTER TABLE "patient_files" ADD CONSTRAINT "patient_files_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_files" ADD CONSTRAINT "patient_files_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_clinical_charts" ADD CONSTRAINT "patient_clinical_charts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_clinical_charts" ADD CONSTRAINT "patient_clinical_charts_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_evolutions" ADD CONSTRAINT "clinical_evolutions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_evolutions" ADD CONSTRAINT "clinical_evolutions_health_professional_id_fkey" FOREIGN KEY ("health_professional_id") REFERENCES "health_professionals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_evolutions" ADD CONSTRAINT "clinical_evolutions_clinical_appointment_id_fkey" FOREIGN KEY ("clinical_appointment_id") REFERENCES "clinical_appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
