CREATE TABLE "thesis"."quiz_session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quizId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"timeStart" timestamp,
	"timeEnd" timestamp
);
--> statement-breakpoint
CREATE TABLE "thesis"."session_submits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sessionId" uuid NOT NULL,
	"submitId" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "thesis"."chosen_variants" DROP CONSTRAINT "chosen_variants_userId_users_id_fk";
--> statement-breakpoint
ALTER TABLE "thesis"."quiz_session" ADD CONSTRAINT "quiz_session_quizId_quizes_id_fk" FOREIGN KEY ("quizId") REFERENCES "thesis"."quizes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis"."quiz_session" ADD CONSTRAINT "quiz_session_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "thesis"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis"."session_submits" ADD CONSTRAINT "session_submits_sessionId_quiz_session_id_fk" FOREIGN KEY ("sessionId") REFERENCES "thesis"."quiz_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis"."session_submits" ADD CONSTRAINT "session_submits_submitId_chosen_variants_id_fk" FOREIGN KEY ("submitId") REFERENCES "thesis"."chosen_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis"."chosen_variants" DROP COLUMN "userId";