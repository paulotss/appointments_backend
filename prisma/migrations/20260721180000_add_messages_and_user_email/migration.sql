-- AlterTable
ALTER TABLE "users" ADD COLUMN "email" VARCHAR(150);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateTable
CREATE TABLE "messages" (
    "id" SERIAL NOT NULL,
    "finish_at" TIMESTAMP(3) NOT NULL,
    "recipient" VARCHAR(30) NOT NULL,
    "user_id" INTEGER,
    "note" TEXT,
    "record_status" "call_record_status_enum" NOT NULL DEFAULT 'pending',
    "interaction_id" VARCHAR(64) NOT NULL,
    "content" JSONB,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "message_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "appointments_message_id_key" ON "appointments"("message_id");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
