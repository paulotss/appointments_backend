CREATE TABLE "confirmation_send_releases" (
 "campaign_id" INTEGER PRIMARY KEY REFERENCES "confirmation_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "revision" CHAR(64) NOT NULL, "item_ids" INTEGER[] NOT NULL,
 "paused" BOOLEAN NOT NULL DEFAULT false, "version" INTEGER NOT NULL DEFAULT 1,
 "actor_user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "updated_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "confirmation_send_release_events" (
 "id" SERIAL PRIMARY KEY,
 "campaign_id" INTEGER NOT NULL REFERENCES "confirmation_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "revision" CHAR(64) NOT NULL, "item_ids" INTEGER[] NOT NULL,
 "action" VARCHAR(16) NOT NULL, "version" INTEGER NOT NULL,
 "actor_user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "confirmation_send_release_events_campaign_id_created_at_idx" ON "confirmation_send_release_events"("campaign_id", "created_at");
