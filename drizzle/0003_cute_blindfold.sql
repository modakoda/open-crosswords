CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sign_in_attempt" (
	"identifier" text PRIMARY KEY NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"last_failed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limit_last_request_idx" ON "rate_limit" USING btree ("last_request");--> statement-breakpoint
CREATE INDEX "sign_in_attempt_last_failed_at_idx" ON "sign_in_attempt" USING btree ("last_failed_at");