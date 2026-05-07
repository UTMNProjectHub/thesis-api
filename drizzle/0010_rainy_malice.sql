ALTER TABLE "thesis"."variants" ADD COLUMN "leftMatching" text;--> statement-breakpoint
ALTER TABLE "thesis"."variants" ADD COLUMN "rightMatching" text;--> statement-breakpoint
ALTER TABLE "thesis"."questions_variants" DROP COLUMN "matchingConfig";