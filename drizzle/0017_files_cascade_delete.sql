ALTER TABLE "thesis"."faqs" DROP CONSTRAINT "faqs_fileId_files_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."references_faq" DROP CONSTRAINT "references_faq_fileId_files_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."references_question" DROP CONSTRAINT "references_question_fileId_files_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."references_quiz" DROP CONSTRAINT "references_quiz_fileId_files_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."references_subject" DROP CONSTRAINT "references_subject_fileId_files_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."references_summary" DROP CONSTRAINT "references_summary_fileId_files_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."references_theme" DROP CONSTRAINT "references_theme_fileId_files_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."summaries" DROP CONSTRAINT "summaries_fileId_files_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."faqs" ADD CONSTRAINT "faqs_fileId_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "thesis"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis"."references_faq" ADD CONSTRAINT "references_faq_fileId_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "thesis"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis"."references_question" ADD CONSTRAINT "references_question_fileId_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "thesis"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis"."references_quiz" ADD CONSTRAINT "references_quiz_fileId_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "thesis"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis"."references_subject" ADD CONSTRAINT "references_subject_fileId_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "thesis"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis"."references_summary" ADD CONSTRAINT "references_summary_fileId_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "thesis"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis"."references_theme" ADD CONSTRAINT "references_theme_fileId_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "thesis"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis"."summaries" ADD CONSTRAINT "summaries_fileId_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "thesis"."files"("id") ON DELETE cascade ON UPDATE no action;