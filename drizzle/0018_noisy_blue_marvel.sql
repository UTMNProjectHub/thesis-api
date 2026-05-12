ALTER TABLE "thesis"."faqs" DROP CONSTRAINT "faqs_summaryId_summaries_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."references_summary" DROP CONSTRAINT "references_summary_summaryId_summaries_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."quizes" ADD COLUMN "summaryId" integer;--> statement-breakpoint
ALTER TABLE "thesis"."faqs" ADD CONSTRAINT "faqs_summaryId_summaries_id_fk" FOREIGN KEY ("summaryId") REFERENCES "thesis"."summaries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis"."quizes" ADD CONSTRAINT "quizes_summaryId_summaries_id_fk" FOREIGN KEY ("summaryId") REFERENCES "thesis"."summaries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis"."references_summary" ADD CONSTRAINT "references_summary_summaryId_summaries_id_fk" FOREIGN KEY ("summaryId") REFERENCES "thesis"."summaries"("id") ON DELETE cascade ON UPDATE no action;