CREATE TYPE "public"."journey_stage" AS ENUM('requirements', 'design', 'matching', 'contract', 'construction', 'acceptance', 'after-sales');--> statement-breakpoint
CREATE TYPE "public"."task_owner" AS ENUM('agent-1', 'agent-2', 'you');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'doing', 'done', 'failed', 'escalated');--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"contractor_id" uuid,
	"task" text NOT NULL,
	"stage" "journey_stage",
	"language" "language" DEFAULT 'zh-CN' NOT NULL,
	"from" "task_owner" NOT NULL,
	"to" "task_owner" NOT NULL,
	"inputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected" text NOT NULL,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"due" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"usage" jsonb DEFAULT '{"inputTokens":0,"outputTokens":0,"images":0}'::jsonb NOT NULL,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_contractor_id_users_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_by_due" ON "tasks" USING btree ("status","due");--> statement-breakpoint
CREATE INDEX "tasks_by_project" ON "tasks" USING btree ("project_id");