CREATE TABLE "thesis"."question_submissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sessionId" uuid NOT NULL,
	"questionId" uuid NOT NULL,
	"isRight" boolean,
	"submittedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "question_submissions_session_question_unique" UNIQUE("sessionId","questionId")
);
--> statement-breakpoint
ALTER TABLE "thesis"."question_submissions" ADD CONSTRAINT "question_submissions_sessionId_quiz_session_id_fk" FOREIGN KEY ("sessionId") REFERENCES "thesis"."quiz_session"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "thesis"."question_submissions" ADD CONSTRAINT "question_submissions_questionId_questions_id_fk" FOREIGN KEY ("questionId") REFERENCES "thesis"."questions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
INSERT INTO "thesis"."question_submissions" ("id", "sessionId", "questionId", "isRight", "submittedAt")
SELECT gen_random_uuid(), ss."sessionId", cv."questionId", bool_and(cv."isRight"), now()
FROM "thesis"."session_submits" ss
JOIN "thesis"."chosen_variants" cv ON cv."id" = ss."submitId"
GROUP BY ss."sessionId", cv."questionId"
ON CONFLICT ON CONSTRAINT "question_submissions_session_question_unique" DO NOTHING;