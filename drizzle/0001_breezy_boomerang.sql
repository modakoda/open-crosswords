CREATE TABLE "solve_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"puzzle_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"progress" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "solve_states_puzzle_user_unq" UNIQUE("puzzle_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "puzzles" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "solve_states" ADD CONSTRAINT "solve_states_puzzle_id_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "public"."puzzles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solve_states" ADD CONSTRAINT "solve_states_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puzzles" ADD CONSTRAINT "puzzles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "puzzles_user_idx" ON "puzzles" USING btree ("user_id");