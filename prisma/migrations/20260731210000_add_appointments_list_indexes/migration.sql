-- CreateIndex
CREATE INDEX "appointments_date_idx" ON "appointments"("date");

-- CreateIndex
CREATE INDEX "appointments_attendant_id_date_idx" ON "appointments"("attendant_id", "date");

-- CreateIndex
CREATE INDEX "appointments_specialty_id_date_idx" ON "appointments"("specialty_id", "date");

-- CreateIndex
CREATE INDEX "appointments_contact_method_date_idx" ON "appointments"("contact_method", "date");

-- CreateIndex
CREATE INDEX "appointments_scheduled_date_idx" ON "appointments"("scheduled", "date");

-- CreateIndex
CREATE INDEX "appointments_first_time_date_idx" ON "appointments"("first_time", "date");
