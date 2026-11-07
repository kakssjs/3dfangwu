CREATE TABLE "reference_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"title_en" text,
	"source" text NOT NULL,
	"source_url" text NOT NULL,
	"license" text NOT NULL,
	"attribution" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"source_version" text,
	"source_hash" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "reference_entries_kind_valid" CHECK ("reference_entries"."kind" in ('business', 'building', 'floorplan', 'material', 'region'))
);
--> statement-breakpoint
CREATE INDEX "reference_entries_kind" ON "reference_entries" USING btree ("kind");