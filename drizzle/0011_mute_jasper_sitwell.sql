ALTER TABLE "thesis"."chosen_variants" ALTER COLUMN "answer" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "thesis"."chosen_variants" ADD COLUMN "answerLeft" text;--> statement-breakpoint
ALTER TABLE "thesis"."chosen_variants" ADD COLUMN "answerRight" text;