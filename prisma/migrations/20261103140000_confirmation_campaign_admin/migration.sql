ALTER TYPE "service_token_scope" ADD VALUE 'CLINIC_REGISTRY_READ';

CREATE TYPE "contact_origin" AS ENUM ('IN_PERSON', 'PHONE', 'WHATSAPP');
CREATE TYPE "contact_subject_role" AS ENUM ('PATIENT', 'GUARDIAN');
CREATE TYPE "contact_verification_status" AS ENUM ('INFORMED', 'VERIFIED');
CREATE TYPE "contact_verification_procedure" AS ENUM (
  'DOCUMENT_PRESENTED',
  'CALLBACK',
  'IN_PERSON_CONFIRMATION',
  'GUARDIAN_PRESENT',
  'RECORDED_PROCEDURE'
);
CREATE TYPE "campaign_source_key" AS ENUM ('SAUDEVIANET', 'HIGIA');
CREATE TYPE "campaign_admin_status" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED');
CREATE TYPE "campaign_recipient_state" AS ENUM ('ELIGIBLE', 'PENDING', 'UNAVAILABLE');
CREATE TYPE "confirmation_audit_action" AS ENUM (
  'CONTACT_INFORMED',
  'CONTACT_VERIFIED',
  'CONTACT_REVOKED',
  'AUTHORIZATION_RECORDED',
  'AUTHORIZATION_REVOKED',
  'ASSOCIATION_RECORDED',
  'CAMPAIGN_CREATED',
  'CAMPAIGN_UPDATED',
  'CAMPAIGN_SUBMITTED',
  'CAMPAIGN_APPROVED',
  'CAMPAIGN_REOPENED'
);

CREATE TABLE "contact_verifications" (
  "id" VARCHAR(40) NOT NULL,
  "patient_ref" VARCHAR(128) NOT NULL,
  "recipient_ref" VARCHAR(128) NOT NULL,
  "informed_phone_ref" VARCHAR(128) NOT NULL,
  "verified_phone_ref" VARCHAR(128),
  "role" "contact_subject_role" NOT NULL,
  "legal_guardian_verified" BOOLEAN NOT NULL DEFAULT false,
  "origin" "contact_origin" NOT NULL,
  "procedure" "contact_verification_procedure",
  "status" "contact_verification_status" NOT NULL DEFAULT 'INFORMED',
  "evidence_ref" VARCHAR(64),
  "recorded_by_user_id" INTEGER NOT NULL,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verified_by_user_id" INTEGER,
  "verified_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "revoked_by_user_id" INTEGER,
  CONSTRAINT "contact_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_authorizations" (
  "id" VARCHAR(40) NOT NULL,
  "patient_ref" VARCHAR(128) NOT NULL,
  "recipient_ref" VARCHAR(128) NOT NULL,
  "purpose" VARCHAR(64) NOT NULL,
  "channel" VARCHAR(64) NOT NULL,
  "legal_basis" VARCHAR(64) NOT NULL,
  "evidence_ref" VARCHAR(64),
  "valid_from" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "recorded_by_user_id" INTEGER NOT NULL,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "revoked_by_user_id" INTEGER,
  CONSTRAINT "contact_authorizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_subject_associations" (
  "id" VARCHAR(64) NOT NULL,
  "patient_ref" VARCHAR(128) NOT NULL,
  "higia_patient_id" INTEGER,
  "associated_by_user_id" INTEGER NOT NULL,
  "associated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contact_subject_associations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "confirmation_campaigns" (
  "id" SERIAL NOT NULL,
  "campaign_date" DATE NOT NULL,
  "source" "campaign_source_key" NOT NULL,
  "status" "campaign_admin_status" NOT NULL DEFAULT 'DRAFT',
  "appointments_analyzed" INTEGER NOT NULL DEFAULT 0,
  "eligible_recipients" INTEGER NOT NULL DEFAULT 0,
  "pending_verifications" INTEGER NOT NULL DEFAULT 0,
  "unavailable_recipients" INTEGER NOT NULL DEFAULT 0,
  "created_by_user_id" INTEGER NOT NULL,
  "approved_by_user_id" INTEGER,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "confirmation_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "confirmation_campaign_items" (
  "id" SERIAL NOT NULL,
  "campaign_id" INTEGER NOT NULL,
  "appointment_ref" VARCHAR(96) NOT NULL,
  "patient_ref" VARCHAR(128),
  "recipient_ref" VARCHAR(128),
  "informed_phone_ref" VARCHAR(128),
  "recipient_state" "campaign_recipient_state" NOT NULL,
  "reason_code" VARCHAR(64),
  CONSTRAINT "confirmation_campaign_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "confirmation_campaign_events" (
  "id" SERIAL NOT NULL,
  "campaign_id" INTEGER NOT NULL,
  "action" "confirmation_audit_action" NOT NULL,
  "actor_user_id" INTEGER NOT NULL,
  "from_status" "campaign_admin_status",
  "to_status" "campaign_admin_status",
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "confirmation_campaign_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "confirmation_audit_events" (
  "id" SERIAL NOT NULL,
  "action" "confirmation_audit_action" NOT NULL,
  "subject_type" VARCHAR(32) NOT NULL,
  "subject_id" VARCHAR(64) NOT NULL,
  "patient_ref" VARCHAR(128),
  "actor_user_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "confirmation_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_verifications_patient_ref_status_idx" ON "contact_verifications"("patient_ref", "status");
CREATE INDEX "contact_verifications_recorded_by_user_id_idx" ON "contact_verifications"("recorded_by_user_id");
CREATE INDEX "contact_authorizations_patient_ref_idx" ON "contact_authorizations"("patient_ref");
CREATE INDEX "contact_authorizations_recorded_by_user_id_idx" ON "contact_authorizations"("recorded_by_user_id");
CREATE UNIQUE INDEX "contact_subject_associations_patient_ref_key" ON "contact_subject_associations"("patient_ref");
CREATE INDEX "contact_subject_associations_higia_patient_id_idx" ON "contact_subject_associations"("higia_patient_id");
CREATE INDEX "contact_subject_associations_associated_by_user_id_idx" ON "contact_subject_associations"("associated_by_user_id");
CREATE UNIQUE INDEX "confirmation_campaigns_campaign_date_source_key" ON "confirmation_campaigns"("campaign_date", "source");
CREATE INDEX "confirmation_campaigns_status_idx" ON "confirmation_campaigns"("status");
CREATE INDEX "confirmation_campaigns_created_by_user_id_idx" ON "confirmation_campaigns"("created_by_user_id");
CREATE UNIQUE INDEX "confirmation_campaign_items_campaign_id_appointment_ref_key" ON "confirmation_campaign_items"("campaign_id", "appointment_ref");
CREATE INDEX "confirmation_campaign_items_recipient_state_idx" ON "confirmation_campaign_items"("recipient_state");
CREATE INDEX "confirmation_campaign_events_campaign_id_created_at_idx" ON "confirmation_campaign_events"("campaign_id", "created_at");
CREATE INDEX "confirmation_campaign_events_actor_user_id_idx" ON "confirmation_campaign_events"("actor_user_id");
CREATE INDEX "confirmation_audit_events_patient_ref_created_at_idx" ON "confirmation_audit_events"("patient_ref", "created_at");
CREATE INDEX "confirmation_audit_events_subject_type_subject_id_idx" ON "confirmation_audit_events"("subject_type", "subject_id");
CREATE INDEX "confirmation_audit_events_actor_user_id_idx" ON "confirmation_audit_events"("actor_user_id");

ALTER TABLE "contact_verifications"
  ADD CONSTRAINT "contact_verifications_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "contact_verifications_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "contact_verifications_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contact_authorizations"
  ADD CONSTRAINT "contact_authorizations_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "contact_authorizations_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contact_subject_associations"
  ADD CONSTRAINT "contact_subject_associations_higia_patient_id_fkey" FOREIGN KEY ("higia_patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "contact_subject_associations_associated_by_user_id_fkey" FOREIGN KEY ("associated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "confirmation_campaigns"
  ADD CONSTRAINT "confirmation_campaigns_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "confirmation_campaigns_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "confirmation_campaign_items"
  ADD CONSTRAINT "confirmation_campaign_items_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "confirmation_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "confirmation_campaign_events"
  ADD CONSTRAINT "confirmation_campaign_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "confirmation_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "confirmation_campaign_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "confirmation_audit_events"
  ADD CONSTRAINT "confirmation_audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
