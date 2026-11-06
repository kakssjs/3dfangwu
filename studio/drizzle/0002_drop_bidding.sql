DROP TABLE "bids" CASCADE;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "bid_deadline";--> statement-breakpoint
DROP TYPE "public"."bid_status";