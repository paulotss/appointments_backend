-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "call_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "appointments_call_id_key" ON "appointments"("call_id");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
