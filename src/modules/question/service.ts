import { and, eq, inArray } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../db";
import {
	chosenVariants,
	questions,
	questionsVariants,
	sessionSubmits,
	variants,
} from "../../db/schema";
import { SessionService } from "../session/service";
import type { AnswerPair } from "./types";

export class QuestionService {
	private sessionService: SessionService;

	constructor() {
		this.sessionService = new SessionService();
	}

	async getQuestion(id: string) {
		const questionQuery = await db.query.questions.findFirst({
			where: eq(questions.id, id),
		});

		if (!questionQuery) {
			throw status(404, "Not Found");
		}

		return questionQuery;
	}

	async getQuestionVariants(questionId: string) {
		return db
			.select({
				id: variants.id,
				text: variants.text,
				leftMatching: variants.leftMatching,
				rightMatching: variants.rightMatching,
				explainRight: variants.explainRight,
				explainWrong: variants.explainWrong,
				isRight: questionsVariants.isRight,
				questionId: questionsVariants.questionId,
				variantId: questionsVariants.variantId,
				questionsVariantsId: questionsVariants.id,
			})
			.from(variants)
			.innerJoin(questionsVariants, eq(variants.id, questionsVariants.variantId))
			.where(eq(questionsVariants.questionId, questionId));
	}

	/** Throws 409 if student already answered this question in the given session. */
	private async assertNoDuplicateSubmit(sessionId: string, questionId: string) {
		const duplicate = await db
			.select({ id: chosenVariants.id })
			.from(chosenVariants)
			.innerJoin(sessionSubmits, eq(sessionSubmits.submitId, chosenVariants.id))
			.where(
				and(
					eq(sessionSubmits.sessionId, sessionId),
					eq(chosenVariants.questionId, questionId),
				),
			)
			.limit(1);

		if (duplicate.length > 0) {
			throw status(409, "Question already answered in this session");
		}
	}

	async submitQuestionVariants(
		userId: string,
		quizId: string,
		questionId: string,
		variantIds: string[],
	) {
		const questionQuery = await this.getQuestion(questionId);
		const variantsQuery = await this.getQuestionVariants(questionId);
		const session = await this.sessionService.getActiveSessionOrThrow(
			userId,
			quizId,
		);

		if (
			questionQuery.type !== "truefalse" &&
			questionQuery.type !== "multichoice"
		) {
			throw status(
				400,
				"Bad Request: this method only supports truefalse and multichoice questions",
			);
		}

		if (questionQuery.type === "truefalse" && variantIds.length !== 1) {
			throw status(
				400,
				"Bad Request: truefalse question requires exactly one answer",
			);
		}

		if (questionQuery.type === "multichoice") {
			if (variantIds.length === 0) {
				throw status(400, "Bad Request: at least one answer is required");
			}
			if (questionQuery.multiAnswer === false && variantIds.length !== 1) {
				throw status(
					400,
					"Bad Request: this question requires exactly one answer",
				);
			}
		}

		const validVariantIds = variantsQuery.map((v) => v.id).filter(Boolean);
		const invalidVariants = variantIds.filter(
			(id) => !validVariantIds.includes(id),
		);
		if (invalidVariants.length > 0) {
			throw status(
				400,
				"Bad Request: some variant IDs do not belong to this question",
			);
		}

		await this.assertNoDuplicateSubmit(session.id, questionId);

		// For multichoice: all selected must be correct AND all correct must be selected
		const correctVariantIds = new Set(
			variantsQuery
				.filter((v) => v.isRight === true)
				.map((v) => v.id)
				.filter(Boolean),
		);
		const selectedSet = new Set(variantIds);
		const overallIsRight =
			[...selectedSet].every((id) => correctVariantIds.has(id)) &&
			[...correctVariantIds].every((id) => selectedSet.has(id));

		const chosenVariantsArr = variantIds.map((variantId) => {
			const questionVariant = variantsQuery.find((v) => v.id === variantId);
			if (!questionVariant?.questionsVariantsId) {
				throw status(
					400,
					"Bad Request: could not find questionsVariants ID for variant",
				);
			}
			return {
				quizId,
				questionId,
				chosenId: questionVariant.questionsVariantsId,
				isRight: questionVariant.isRight ?? false,
			};
		});

		const inserted = await db.transaction(async (tx) => {
			const rows = await tx
				.insert(chosenVariants)
				.values(chosenVariantsArr)
				.returning();

			await this.sessionService.addSubmitsToSessionInTransaction(
				tx,
				session.id,
				rows.map((cv) => cv.id),
			);

			return rows;
		});

		void inserted;

		const explanations = variantIds
			.map((variantId) => {
				const variant = variantsQuery.find((v) => v.id === variantId);
				if (!variant) return null;
				return {
					variantId: variant.id,
					variantText: variant.text,
					isRight: variant.isRight,
					explanation: variant.isRight
						? variant.explainRight
						: variant.explainWrong,
				};
			})
			.filter((item): item is NonNullable<typeof item> => item !== null);

		return {
			question: questionQuery,
			submittedVariants: explanations,
			allVariants: variantsQuery,
			isRight: overallIsRight,
		};
	}

	async submitQuestionText(
		userId: string,
		quizId: string,
		questionId: string,
		answerText: string,
	) {
		const questionQuery = await this.getQuestion(questionId);
		const variantsQuery = await this.getQuestionVariants(questionId);
		const session = await this.sessionService.getActiveSessionOrThrow(
			userId,
			quizId,
		);

		const textQuestionTypes = ["shortanswer", "essay", "numerical"];
		if (!textQuestionTypes.includes(questionQuery.type)) {
			throw status(
				400,
				"Bad Request: this method only supports text-based questions",
			);
		}

		if (!answerText || answerText.trim() === "") {
			throw status(400, "Bad Request: answer cannot be empty");
		}

		if (questionQuery.type === "numerical") {
			const numericalValue = parseFloat(answerText.trim());
			if (Number.isNaN(numericalValue)) {
				throw status(
					400,
					"Bad Request: numerical question requires a valid number",
				);
			}
		}

		await this.assertNoDuplicateSubmit(session.id, questionId);

		let isRight: boolean | null = null;
		let explanation: string | null = null;

		if (questionQuery.type === "numerical") {
			const correctVariant = variantsQuery.find((v) => v.isRight === true);
			if (correctVariant?.text) {
				const correctAnswer = parseFloat(correctVariant.text);
				const userAnswer = parseFloat(answerText.trim());
				isRight = Math.abs(correctAnswer - userAnswer) < 0.0001;
				explanation = isRight
					? correctVariant.explainRight
					: correctVariant.explainWrong;
			}
		}

		const [submitted] = await db.transaction(async (tx) => {
			const [inserted] = await tx
				.insert(chosenVariants)
				.values({
					quizId,
					questionId,
					answer: answerText.trim(),
					explanation,
					isRight,
				})
				.returning();

			await this.sessionService.addSubmitsToSessionInTransaction(
				tx,
				session.id,
				[inserted.id],
			);

			return [inserted];
		});

		return {
			question: questionQuery,
			submittedAnswer: submitted,
			isRight,
			explanation,
			variants: variantsQuery,
		};
	}

	async submitQuestionPairs(
		userId: string,
		quizId: string,
		questionId: string,
		answerPairs: Array<AnswerPair>,
	) {
		const questionQuery = await this.getQuestion(questionId);
		const variantsQuery = await this.getQuestionVariants(questionId);
		const session = await this.sessionService.getActiveSessionOrThrow(
			userId,
			quizId,
		);

		if (questionQuery.type !== "matching") {
			throw status(
				400,
				"Bad Request: this method only supports matching questions",
			);
		}

		await this.assertNoDuplicateSubmit(session.id, questionId);

		const pairsMap = answerPairs.reduce(
			(acc, pair) => {
				acc[pair.leftMatching] = pair.rightMatching;
				return acc;
			},
			{} as Record<string, string>,
		);

		let overallIsRight = true;
		const chosenVariantsData = variantsQuery.map((variant) => {
			let pairIsRight = true;

			if (variant.leftMatching && variant.rightMatching) {
				const userRight = pairsMap[variant.leftMatching];
				if (userRight !== variant.rightMatching) {
					overallIsRight = false;
					pairIsRight = false;
				}
			}

			return {
				quizId,
				questionId,
				chosenId: variant.variantId,
				answerLeft: variant.leftMatching,
				answerRight: pairsMap[variant.leftMatching as string] ?? null,
				isRight: pairIsRight,
			};
		});

		const insertedRows = await db.transaction(async (tx) => {
			const rows = await tx
				.insert(chosenVariants)
				.values(chosenVariantsData)
				.returning();

			// Link ALL inserted rows to the session
			await this.sessionService.addSubmitsToSessionInTransaction(
				tx,
				session.id,
				rows.map((cv) => cv.id),
			);

			return rows;
		});

		return {
			question: questionQuery,
			isRight: overallIsRight,
			pairsGraded: insertedRows.map((cv) => ({
				leftMatching: cv.answerLeft ?? "",
				rightMatching: cv.answerRight ?? "",
				isRight: cv.isRight ?? false,
			})),
		};
	}

	async regradeSubmission(
		submissionId: string,
		isRight: boolean,
		explanation?: string,
	) {
		const existing = await db.query.chosenVariants.findFirst({
			where: eq(chosenVariants.id, submissionId),
		});

		if (!existing) {
			throw status(404, "Submission not found");
		}

		const updateData: { isRight: boolean; explanation?: string } = { isRight };
		if (explanation !== undefined) {
			updateData.explanation = explanation;
		}

		const [updated] = await db
			.update(chosenVariants)
			.set(updateData)
			.where(eq(chosenVariants.id, submissionId))
			.returning();

		return updated;
	}

	async updateQuestion(
		id: string,
		data: {
			text?: string;
			type?: string;
			multiAnswer?: boolean | null;
		},
	) {
		const question = await db.query.questions.findFirst({
			where: eq(questions.id, id),
		});

		if (!question) {
			throw status(404, "Not Found");
		}

		const updateData: {
			text?: string;
			type?: string;
			multiAnswer?: boolean | null;
		} = {};

		if (data.text !== undefined) updateData.text = data.text;
		if (data.type !== undefined) updateData.type = data.type;
		if (data.multiAnswer !== undefined)
			updateData.multiAnswer = data.multiAnswer;

		const [updated] = await db
			.update(questions)
			.set(updateData)
			.where(eq(questions.id, id))
			.returning();

		return updated;
	}

	async updateQuestionVariants(
		questionId: string,
		variantsData: Array<{
			text: string;
			leftMatching: string | null;
			rightMatching: string | null;
			explainRight: string;
			explainWrong: string;
			isRight: boolean;
		}>,
	) {
		return await db.transaction(async (tx) => {
			const question = await tx.query.questions.findFirst({
				where: eq(questions.id, questionId),
			});

			if (!question) {
				throw status(404, "Question not found");
			}

			if (question.type === "numerical") {
				if (variantsData.length !== 1 || !variantsData[0].isRight) {
					throw status(
						400,
						"Numerical question must have exactly one correct variant",
					);
				}
			}

			// Get existing questionsVariants
			const existingQV = await tx.query.questionsVariants.findMany({
				where: eq(questionsVariants.questionId, questionId),
			});

			const existingVariantIds = existingQV
				.map((qv) => qv.variantId)
				.filter((id): id is string => id !== null);

			// Delete questionsVariants for this question
			if (existingQV.length > 0) {
				await tx
					.delete(questionsVariants)
					.where(eq(questionsVariants.questionId, questionId));
			}

			// Delete variants not used by any other question
			if (existingVariantIds.length > 0) {
				const stillUsed = await tx
					.select({ variantId: questionsVariants.variantId })
					.from(questionsVariants)
					.where(inArray(questionsVariants.variantId, existingVariantIds));

				const stillUsedIds = new Set(
					stillUsed.map((r) => r.variantId).filter(Boolean),
				);
				const toDelete = existingVariantIds.filter(
					(id) => !stillUsedIds.has(id),
				);

				if (toDelete.length > 0) {
					await tx.delete(variants).where(inArray(variants.id, toDelete));
				}
			}

			// Insert new variants and link them
			for (const variantData of variantsData) {
				const [variant] = await tx
					.insert(variants)
					.values({
						text: variantData.text,
						leftMatching: variantData.leftMatching,
						rightMatching: variantData.rightMatching,
						explainRight: variantData.explainRight,
						explainWrong: variantData.explainWrong,
					})
					.returning();

				await tx.insert(questionsVariants).values({
					questionId,
					variantId: variant.id,
					isRight: variantData.isRight,
				});
			}

			return { success: true };
		});
	}
}
