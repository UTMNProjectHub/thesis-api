ALTER TABLE "thesis"."questions_variants" ALTER COLUMN "variantId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "thesis"."questions_variants" ALTER COLUMN "isRight" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "thesis"."questions_variants" ADD COLUMN "matchingConfig" json;