CREATE TABLE "call_insights" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "call_insights_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"agent" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"fallback_used" boolean DEFAULT false NOT NULL,
	"fallback_reason" text,
	"call_outcome_ids" jsonb NOT NULL,
	"insight" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_outcomes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "call_outcomes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"agent" text NOT NULL,
	"caller_name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"intent" text NOT NULL,
	"outcome" text NOT NULL,
	"appointment" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"transcript" text DEFAULT '' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "call_outcomes_agent_created_idx" ON "call_outcomes" USING btree ("agent","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);