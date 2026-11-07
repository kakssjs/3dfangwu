CREATE TABLE "email_challenges" (
	"key" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"ready" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_quotas" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "email_challenges_expiry" ON "email_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "email_quotas_expiry" ON "email_quotas" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");