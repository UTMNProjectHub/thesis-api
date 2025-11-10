ALTER TABLE "thesis"."chosen_variants" DROP CONSTRAINT "chosen_variants_quizId_quizes_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."quiz_session" DROP CONSTRAINT "quiz_session_quizId_quizes_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."quizes_questions" DROP CONSTRAINT "quizes_questions_quizId_quizes_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."references_quiz" DROP CONSTRAINT "references_quiz_quizId_quizes_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."users_quizes" DROP CONSTRAINT "users_quizes_quizId_quizes_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."chosen_variants" ADD CONSTRAINT "chosen_variants_quizId_quizes_id_fk" FOREIGN KEY ("quizId") REFERENCES "thesis"."quizes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "thesis"."quiz_session" ADD CONSTRAINT "quiz_session_quizId_quizes_id_fk" FOREIGN KEY ("quizId") REFERENCES "thesis"."quizes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "thesis"."quizes_questions" ADD CONSTRAINT "quizes_questions_quizId_quizes_id_fk" FOREIGN KEY ("quizId") REFERENCES "thesis"."quizes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "thesis"."references_quiz" ADD CONSTRAINT "references_quiz_quizId_quizes_id_fk" FOREIGN KEY ("quizId") REFERENCES "thesis"."quizes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "thesis"."users_quizes" ADD CONSTRAINT "users_quizes_quizId_quizes_id_fk" FOREIGN KEY ("quizId") REFERENCES "thesis"."quizes"("id") ON DELETE cascade ON UPDATE cascade;