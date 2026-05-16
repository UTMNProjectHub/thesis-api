ALTER TABLE "thesis"."quiz_answer_dialogs" ALTER COLUMN "contextSnapshot" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "thesis"."faqs" ADD COLUMN "createdAt" timestamp DEFAULT now() NOT NULL;