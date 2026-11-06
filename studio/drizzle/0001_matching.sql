CREATE TYPE "public"."invitation_status" AS ENUM('invited', 'declined', 'quoted', 'selected', 'not-selected');--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"contractor_id" uuid NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" "invitation_status" DEFAULT 'invited' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"decline_reason" text,
	"price_cny" integer,
	"labour_cny" integer,
	"materials_cny" integer,
	"management_fee_cny" integer,
	"duration_days" integer,
	"earliest_start" date,
	"main_materials" text DEFAULT '' NOT NULL,
	"quote_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_quote_complete" CHECK ("invitations"."status" not in ('quoted', 'selected') or ("invitations"."price_cny" is not null and "invitations"."duration_days" is not null and "invitations"."earliest_start" is not null))
);
--> statement-breakpoint
ALTER TABLE "contractor_profiles" ADD COLUMN "styles" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "contractor_profiles" ADD COLUMN "price_min_cny_per_m2" integer;--> statement-breakpoint
ALTER TABLE "contractor_profiles" ADD COLUMN "price_max_cny_per_m2" integer;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_contractor_id_users_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_one_per_contractor" ON "invitations" USING btree ("project_id","contractor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_one_selected" ON "invitations" USING btree ("project_id") WHERE "invitations"."status" = 'selected';--> statement-breakpoint
CREATE INDEX "invitations_by_contractor" ON "invitations" USING btree ("contractor_id","status");--> statement-breakpoint
ALTER TABLE "contractor_profiles" ADD CONSTRAINT "contractor_price_band" CHECK (("contractor_profiles"."price_min_cny_per_m2" is null) = ("contractor_profiles"."price_max_cny_per_m2" is null) and ("contractor_profiles"."price_min_cny_per_m2" is null or "contractor_profiles"."price_min_cny_per_m2" <= "contractor_profiles"."price_max_cny_per_m2"));