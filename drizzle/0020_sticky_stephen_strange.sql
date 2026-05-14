CREATE TABLE "thesis"."quiz_answer_dialog_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dialogId" uuid NOT NULL,
	"userId" uuid,
	"role" varchar NOT NULL,
	"content" text NOT NULL,
	"sequenceNo" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "quiz_answer_dialog_messages_dialog_sequence_unique" UNIQUE("dialogId","sequenceNo")
);
--> statement-breakpoint
CREATE TABLE "thesis"."quiz_answer_dialogs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"questionSubmissionId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"sessionId" uuid NOT NULL,
	"quizId" uuid NOT NULL,
	"questionId" uuid NOT NULL,
	"contextSnapshot" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_answer_dialogs_question_submission_unique" UNIQUE("questionSubmissionId")
);
--> statement-breakpoint
ALTER TABLE "thesis"."quiz_answer_dialog_messages" ADD CONSTRAINT "quiz_answer_dialog_messages_dialogId_quiz_answer_dialogs_id_fk" FOREIGN KEY ("dialogId") REFERENCES "thesis"."quiz_answer_dialogs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "thesis"."quiz_answer_dialog_messages" ADD CONSTRAINT "quiz_answer_dialog_messages_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "thesis"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "thesis"."quiz_answer_dialogs" ADD CONSTRAINT "quiz_answer_dialogs_questionSubmissionId_question_submissions_id_fk" FOREIGN KEY ("questionSubmissionId") REFERENCES "thesis"."question_submissions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "thesis"."quiz_answer_dialogs" ADD CONSTRAINT "quiz_answer_dialogs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "thesis"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "thesis"."quiz_answer_dialogs" ADD CONSTRAINT "quiz_answer_dialogs_sessionId_quiz_session_id_fk" FOREIGN KEY ("sessionId") REFERENCES "thesis"."quiz_session"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "thesis"."quiz_answer_dialogs" ADD CONSTRAINT "quiz_answer_dialogs_quizId_quizes_id_fk" FOREIGN KEY ("quizId") REFERENCES "thesis"."quizes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "thesis"."quiz_answer_dialogs" ADD CONSTRAINT "quiz_answer_dialogs_questionId_questions_id_fk" FOREIGN KEY ("questionId") REFERENCES "thesis"."questions"("id") ON DELETE cascade ON UPDATE cascade;