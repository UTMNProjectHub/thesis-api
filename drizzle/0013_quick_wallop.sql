CREATE TABLE "thesis"."faqs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"themeId" integer NOT NULL,
	"difficultyLevel" varchar NOT NULL,
	"num_questions" integer NOT NULL,
	"fileId" uuid NOT NULL,
	"summaryId" integer
);
--> statement-breakpoint
ALTER TABLE "thesis"."faqs" ADD CONSTRAINT "faqs_themeId_themes_id_fk" FOREIGN KEY ("themeId") REFERENCES "thesis"."themes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis"."faqs" ADD CONSTRAINT "faqs_fileId_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "thesis"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis"."faqs" ADD CONSTRAINT "faqs_summaryId_summaries_id_fk" FOREIGN KEY ("summaryId") REFERENCES "thesis"."summaries"("id") ON DELETE no action ON UPDATE no action;