ALTER TABLE "thesis"."chosen_variants" DROP CONSTRAINT "chosen_variants_questionId_questions_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."chosen_variants" DROP CONSTRAINT "chosen_variants_chosenId_questions_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."chosen_variants" ADD CONSTRAINT "chosen_variants_questionId_questions_id_fk" FOREIGN KEY ("questionId") REFERENCES "thesis"."questions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "thesis"."chosen_variants" ADD CONSTRAINT "chosen_variants_chosenId_questions_variants_id_fk" FOREIGN KEY ("chosenId") REFERENCES "thesis"."questions_variants"("id") ON DELETE cascade ON UPDATE cascade;