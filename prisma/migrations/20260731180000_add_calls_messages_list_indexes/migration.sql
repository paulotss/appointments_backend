-- CreateIndex
CREATE INDEX "calls_received_at_idx" ON "calls"("received_at");

-- CreateIndex
CREATE INDEX "calls_record_status_idx" ON "calls"("record_status");

-- CreateIndex
CREATE INDEX "calls_user_id_idx" ON "calls"("user_id");

-- CreateIndex
CREATE INDEX "calls_status_idx" ON "calls"("status");

-- CreateIndex
CREATE INDEX "calls_received_at_record_status_idx" ON "calls"("received_at", "record_status");

-- CreateIndex
CREATE INDEX "calls_user_id_received_at_idx" ON "calls"("user_id", "received_at");

-- CreateIndex
CREATE INDEX "messages_finish_at_idx" ON "messages"("finish_at");

-- CreateIndex
CREATE INDEX "messages_record_status_idx" ON "messages"("record_status");

-- CreateIndex
CREATE INDEX "messages_user_id_idx" ON "messages"("user_id");

-- CreateIndex
CREATE INDEX "messages_finish_at_record_status_idx" ON "messages"("finish_at", "record_status");

-- CreateIndex
CREATE INDEX "messages_user_id_finish_at_idx" ON "messages"("user_id", "finish_at");
