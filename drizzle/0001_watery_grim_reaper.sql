ALTER TABLE "thesis"."subjects" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "thesis"."themes" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "thesis"."subjects" ADD COLUMN "yearStart" integer NOT NULL DEFAULT 2025;--> statement-breakpoint
ALTER TABLE "thesis"."subjects" ADD COLUMN "yearEnd" integer NOT NULL DEFAULT 2026;
