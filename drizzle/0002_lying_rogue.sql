ALTER TABLE "thesis"."chosen_variants" ALTER COLUMN "chosenId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "thesis"."chosen_variants" ADD COLUMN "answer" json;--> statement-breakpoint
ALTER TABLE "thesis"."chosen_variants" ADD COLUMN "isRight" boolean;--> statement-breakpoint
ALTER TABLE "thesis"."questions" ADD COLUMN "multiAnswer" boolean;