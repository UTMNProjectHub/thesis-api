import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import {
	chosenVariants,
	questions,
	questionsVariants,
	questionSubmissions,
	quizAnswerDialogs,
	sessionSubmits,
	variants,
	quizAnswerDialogMessages,
} from "../../db/schema";
import { status } from "elysia";
import { amqpClient } from "../../amqp/client";
import { QUEUES } from "../../amqp/queues";
import { QuizAnswerDialogMessage } from "../../amqp/types";

export class QuestionChatService {
	async getMessages(
		questionId: string,
		userId: string,
		sessionId: string,
	) {
		const submission = await db.query.questionSubmissions.findFirst({
			where: and(
				eq(questionSubmissions.questionId, questionId),
				eq(questionSubmissions.sessionId, sessionId),
			),
			with: { quizAnswerDialog: true },
		});

		if (!submission) return { dialogId: null, messages: [] };
		const dialog = submission.quizAnswerDialog;
		if (!dialog) return { dialogId: null, messages: [] };
		if (dialog.userId !== userId) throw status(403, "Forbidden");

		const messages = await db.query.quizAnswerDialogMessages.findMany({
			where: eq(quizAnswerDialogMessages.dialogId, dialog.id),
			orderBy: (m, { asc }) => [asc(m.sequenceNo)],
		});

		return { dialogId: dialog.id, messages };
	}

	async submitMessage(
		questionId: string,
		userId: string,
		sessionId: string,
		text: string,
	) {
		const questionSubmission = await db.query.questionSubmissions.findFirst({
			where: and(
				eq(questionSubmissions.questionId, questionId),
				eq(questionSubmissions.sessionId, sessionId),
			),
			with: {
				quizAnswerDialog: true,
				session: true,
			},
		});

		if (!questionSubmission) {
			throw status(400, "Bad Request");
		}

		let dialogId = questionSubmission.quizAnswerDialog?.id ?? null;

		if (!dialogId) {
			const question = await db.query.questions.findFirst({
				where: eq(questions.id, questionId),
			});

			if (!question) {
				throw status(404, "Question not found");
			}

			const chosenVariantsSnapshot = await db
				.select({
					id: chosenVariants.id,
					chosenId: chosenVariants.chosenId,
					answer: chosenVariants.answer,
					explanation: chosenVariants.explanation,
					answerLeft: chosenVariants.answerLeft,
					answerRight: chosenVariants.answerRight,
					isRight: chosenVariants.isRight,
				})
				.from(chosenVariants)
				.innerJoin(
					sessionSubmits,
					eq(sessionSubmits.submitId, chosenVariants.id),
				)
				.where(
					and(
						eq(chosenVariants.questionId, questionId),
						eq(sessionSubmits.sessionId, sessionId),
					),
				);

			const chosenVariantIds = chosenVariantsSnapshot
				.map((item) => item.chosenId)
				.filter((id): id is string => id !== null);

			const variantRows = chosenVariantIds.length
				? await db
						.select({
							id: questionsVariants.id,
							variantId: questionsVariants.variantId,
							text: variants.text,
							explainRight: variants.explainRight,
							explainWrong: variants.explainWrong,
						})
						.from(questionsVariants)
						.innerJoin(variants, eq(variants.id, questionsVariants.variantId))
						.where(and(eq(questionsVariants.questionId, questionId)))
				: [];

			const chosenVariantsWithExplanations = chosenVariantsSnapshot.map(
				(item) => {
					const variantRow = item.chosenId
						? variantRows.find((row) => row.id === item.chosenId)
						: undefined;

					return {
						...item,
						explanation:
							item.explanation ??
							(variantRow
								? item.isRight
									? variantRow.explainRight
									: variantRow.explainWrong
								: null),
						answer: item.answer ?? variantRow?.text ?? null,
						explainRight: variantRow?.explainRight ?? null,
						explainWrong: variantRow?.explainWrong ?? null,
					};
				},
			);

			const dialog = await db
				.insert(quizAnswerDialogs)
				.values({
					sessionId,
					questionSubmissionId: questionSubmission.id,
					quizId: questionSubmission.session.quizId,
					userId,
					questionId,
					contextSnapshot: {
						questionText: question.text,
						questionType: question.type,
						chosenVariants: chosenVariantsWithExplanations,
						userMessage: text,
					},
				})
				.returning();

			dialogId = dialog[0].id;
		}

		const [message] = await db.transaction(async (tx) => {
			const [lockedDialog] = await tx
				.select({ id: quizAnswerDialogs.id })
				.from(quizAnswerDialogs)
				.where(eq(quizAnswerDialogs.id, dialogId))
				.for("update");

			if (!lockedDialog) {
				throw status(404, "Dialog not found");
			}

			const lastMessage = await tx.query.quizAnswerDialogMessages.findFirst({
				where: eq(quizAnswerDialogMessages.dialogId, dialogId),
				orderBy: (messages, { desc }) => [desc(messages.sequenceNo)],
			});

			const msg = await tx
				.insert(quizAnswerDialogMessages)
				.values({
					dialogId,
					userId,
					role: "user",
					content: text,
					sequenceNo: lastMessage ? lastMessage.sequenceNo + 1 : 1,
				})
				.returning();

			return msg;
		});

		await amqpClient.publishToQueue(QUEUES.QUIZ_ANSWER_DIALOG_MESSAGE, {
			dialogId,
			userId,
			messageId: message.id,
		} as QuizAnswerDialogMessage);
	}
}
