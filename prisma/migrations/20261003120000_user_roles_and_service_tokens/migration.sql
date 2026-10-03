CREATE TYPE "user_role" AS ENUM ('PATIENT', 'PROFESSIONAL', 'RECEPTIONIST', 'ADMIN');

CREATE TYPE "service_token_scope" AS ENUM ('CALLS_WRITE', 'AGENT_DATA_READ');

ALTER TABLE "users" ADD COLUMN "role" "user_role" NOT NULL DEFAULT 'RECEPTIONIST';

UPDATE "users" SET "role" = 'ADMIN' WHERE "is_admin" = true;

ALTER TABLE "users" DROP COLUMN "is_admin";

ALTER TABLE "users" ADD COLUMN "patient_id" INTEGER;
ALTER TABLE "users" ADD COLUMN "health_professional_id" INTEGER;

CREATE UNIQUE INDEX "users_patient_id_key" ON "users"("patient_id");
CREATE UNIQUE INDEX "users_health_professional_id_key" ON "users"("health_professional_id");

ALTER TABLE "users"
ADD CONSTRAINT "users_patient_id_fkey"
FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "users"
ADD CONSTRAINT "users_health_professional_id_fkey"
FOREIGN KEY ("health_professional_id") REFERENCES "health_professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "service_access_tokens" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "jti" VARCHAR(64) NOT NULL,
    "scopes" "service_token_scope"[],
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER NOT NULL,

    CONSTRAINT "service_access_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_access_tokens_token_hash_key" ON "service_access_tokens"("token_hash");
CREATE UNIQUE INDEX "service_access_tokens_jti_key" ON "service_access_tokens"("jti");
CREATE INDEX "service_access_tokens_created_by_id_idx" ON "service_access_tokens"("created_by_id");

ALTER TABLE "service_access_tokens"
ADD CONSTRAINT "service_access_tokens_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
