-- CreateTable
CREATE TABLE "insurance_guide_documents" (
    "id" SERIAL NOT NULL,
    "insurance_guide_id" INTEGER NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_guide_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insurance_guide_documents_insurance_guide_id_idx" ON "insurance_guide_documents"("insurance_guide_id");

-- AddForeignKey
ALTER TABLE "insurance_guide_documents" ADD CONSTRAINT "insurance_guide_documents_insurance_guide_id_fkey" FOREIGN KEY ("insurance_guide_id") REFERENCES "insurance_guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
