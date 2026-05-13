-- CreateEnum
CREATE TYPE "call_record_status_enum" AS ENUM ('pending', 'registered', 'cancelled');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "extension" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "users_extension_key" ON "users"("extension");

-- CreateTable
CREATE TABLE "calls" (
    "id" SERIAL NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origin" VARCHAR(255) NOT NULL,
    "extension" INTEGER NOT NULL,
    "status" VARCHAR(100) NOT NULL,
    "record_status" "call_record_status_enum" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "user_id" INTEGER,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
