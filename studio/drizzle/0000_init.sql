CREATE TYPE "public"."bid_status" AS ENUM('submitted', 'selected', 'not-selected');--> statement-breakpoint
CREATE TYPE "public"."contractor_status" AS ENUM('pending', 'verified', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('zh-CN', 'en');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('open', 'awarded', 'closed');--> statement-breakpoint
CREATE TYPE "public"."renovation_type" AS ENUM('new-home', 'old-home', 'partial');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('homeowner', 'contractor');--> statement-breakpoint
CREATE TABLE "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"contractor_id" uuid NOT NULL,
	"price_cny" integer NOT NULL,
	"labour_cny" integer,
	"materials_cny" integer,
	"management_fee_cny" integer,
	"duration_days" integer NOT NULL,
	"earliest_start" date NOT NULL,
	"main_materials" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"status" "bid_status" DEFAULT 'submitted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractor_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"kind" text NOT NULL,
	"licence_number" text NOT NULL,
	"qualifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"city" text NOT NULL,
	"districts" text[] NOT NULL,
	"renovation_types" "renovation_type"[] NOT NULL,
	"years_in_business" integer NOT NULL,
	"team_size" integer NOT NULL,
	"max_concurrent_projects" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"past_projects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "contractor_status" DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"city" text NOT NULL,
	"district" text NOT NULL,
	"floor_area_m2" double precision NOT NULL,
	"layout" text DEFAULT '' NOT NULL,
	"renovation_type" "renovation_type" NOT NULL,
	"style" text DEFAULT '' NOT NULL,
	"budget_min_cny" integer NOT NULL,
	"budget_max_cny" integer NOT NULL,
	"desired_start" date NOT NULL,
	"bid_deadline" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"status" "project_status" DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_budget_range" CHECK ("projects"."budget_min_cny" <= "projects"."budget_max_cny")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "role" NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"language" "language" DEFAULT 'zh-CN' NOT NULL,
	"consent_version" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_contractor_id_users_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_profiles" ADD CONSTRAINT "contractor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bids_one_per_contractor" ON "bids" USING btree ("project_id","contractor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bids_one_selected" ON "bids" USING btree ("project_id") WHERE "bids"."status" = 'selected';--> statement-breakpoint
CREATE INDEX "projects_open_by_place" ON "projects" USING btree ("status","city","district");