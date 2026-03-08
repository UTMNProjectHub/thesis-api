import { eq, inArray } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../db";
import {
	chosenVariants,
	questions,
	questionsVariants,
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

	async getQuestionVariantsMinimal(questionId: string) {
		const variantsQuery = await db
			.select({
				id: variants.id,
				text: variants.text,
			})
			.from(variants)
			.fullJoin(questionsVariants, eq(variants.id, questionsVariants.variantId))
			.where(eq(questionsVariants.questionId, questionId));

		return variantsQuery;
	}

	async getQuestionVariants(questionId: string) {
		const variantsQuery = await db
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
			.innerJoin(
				questionsVariants,
				eq(variants.id, questionsVariants.variantId),
			)
			.where(eq(questionsVariants.questionId, questionId));

		return variantsQuery;
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

		if (questionQuery.type !== "truefalse") {
			throw status(
				400,
				"Bad Request: this method only supports truefalse and multichoice questions",
			);
		}

		switch (questionQuery.type) {
			case "truefalse":
				if (variantIds.length !== 1) {
					throw status(
						400,
						"Bad Request: truefalse question requires exactly one answer",
					);
				}
				break;
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

		const chosenVariantsArr = variantIds.map((variantId) => {
			const questionVariant = variantsQuery.find((v) => v.id === variantId);
			if (!questionVariant || !questionVariant.questionsVariantsId) {
				throw status(
					400,
					"Bad Request: could not find questionsVariants ID for variant",
				);
			}
			return {
				quizId,
				questionId,
				chosenId: questionVariant.questionsVariantsId,
			};
		});

		const _submittedVariants = await db.transaction(async (tx) => {
			const inserted = await tx
				.insert(chosenVariants)
				.values(chosenVariantsArr)
				.returning();

			await this.sessionService.addSubmitsToSessionInTransaction(
				tx,
				session.id,
				inserted.map((cv) => cv.id),
			);

			return inserted;
		});

		// Get explanations for chosen variants
		const explanations = variantIds
			.map((variantId) => {
				const variant = variantsQuery.find((v) => v.id === variantId);
				if (!variant) {
					return null;
				}
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

		// Validate question type
		const textQuestionTypes = [
			"shortanswer",
			"essay",
			"numerical",
		];
		if (!textQuestionTypes.includes(questionQuery.type)) {
			throw status(
				400,
				"Bad Request: this method only supports text-based questions",
			);
		}

		let isRight: boolean | null = null;
		let explanation: string | null = null;

		switch (questionQuery.type) {
			case "shortanswer":
				if (!answerText || answerText.trim() === "") {
					throw status(
						400,
						"Bad Request: shortanswer question requires a non-empty answer",
					);
				}
				break;

			case "essay":
				if (!answerText || answerText.trim() === "") {
					throw status(
						400,
						"Bad Request: essay question requires a non-empty answer",
					);
				}
				break;

			case "numerical": {
				if (!answerText || answerText.trim() === "") {
					throw status(
						400,
						"Bad Request: numerical question requires a non-empty answer",
					);
				}

				const numericalValue = parseFloat(answerText.trim());
				if (Number.isNaN(numericalValue)) {
					throw status(
						400,
						"Bad Request: numerical question requires a valid number",
					);
				}

				const correctVariant = variantsQuery.find((v) => v.isRight === true);
				if (correctVariant?.text) {
					const correctAnswer = parseFloat(correctVariant.text);
					const userAnswer = parseFloat(answerText.trim());
					isRight = Math.abs(correctAnswer - userAnswer) < 0.0001;

					explanation = isRight
						? correctVariant.explainRight
						: correctVariant.explainWrong;
				}

				const session = await this.sessionService.getActiveSessionOrThrow(
					userId,
					quizId,
				);

				const [submitted] = await db.transaction(async (tx) => {
					const [inserted] = await tx
						.insert(chosenVariants)
						.values({
							quizId,
							questionId,
							answer: answerText.trim(),
							isRight,
						})
						.returning();

					await this.sessionService.addSubmitsToSessionInTransaction(
						tx,
						session.id,
						[
							inserted.id,
						],
					);

					return [
						inserted,
					];
				});

				return {
					question: questionQuery,
					submittedAnswer: submitted,
					isRight,
					variants: variantsQuery,
					explanation: null,
				};
			}

			default:
				break;
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
				[
					inserted.id,
				],
			);

			return [
				inserted,
			];
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
			throw status(400, "Bad Request");
		}

		let isRight = true;
		const pairsmap = answerPairs.reduce(
			(acc, pair) => {
				acc[pair.leftMatching] = pair.rightMatching;
				return acc;
			},
			{} as Record<string, string>,
		);

		const chosenVariantsData = variantsQuery.map((variant) => {
			let correct = true;

			if (variant.leftMatching && variant.rightMatching) {
				const userRight = pairsmap[variant.leftMatching];
				if (userRight !== variant.rightMatching) {
					isRight = false;
					correct = false;
				}
			}

			return {
				quizId,
				questionId,
				chosenId: variant.variantId,
				answerLeft: variant.leftMatching,
				answerRight: pairsmap[variant.leftMatching as string] ?? null,
				isRight: correct,
			};
		});

		const [submitted] = await db.transaction(async (tx) => {
			const [inserted] = await tx
				.insert(chosenVariants)
				.values(chosenVariantsData)
				.returning();

			await this.sessionService.addSubmitsToSessionInTransaction(
				tx,
				session.id,
				[
					inserted.id,
				],
			);

			return [
				inserted,
			];
		});

		return {
			question: questionQuery,
			submittedAnswer: submitted,
			isRight,
			variants: variantsQuery,
		};
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
			// Проверяем существование вопроса
			const question = await tx.query.questions.findFirst({
				where: eq(questions.id, questionId),
			});

			if (!question) {
				throw status(404, "Question not found");
			}

			// для numerical вопросов должен быть только один правильный вариант
			if (question.type === "numerical") {
				if (variantsData.length !== 1 || !variantsData[0].isRight) {
					throw status(
						400,
						"Numerical question must have exactly one correct variant",
					);
				}
			}

			// Получаем все существующие questionsVariants для этого вопроса
			const existingQuestionsVariants =
				await tx.query.questionsVariants.findMany({
					where: eq(questionsVariants.questionId, questionId),
				});

			// Получаем ID всех связанных variants
			const variantIds = existingQuestionsVariants
				.map((qv) => qv.variantId)
				.filter((id): id is string => id !== null);

			// Проверяем, используются ли эти variants в других вопросах (ПЕРЕД удалением)
			let unusedVariantIds: string[] = [];
			if (variantIds.length > 0) {
				const allQuestionsVariants = await tx
					.select()
					.from(questionsVariants)
					.where(inArray(questionsVariants.variantId, variantIds));

				const usedVariantIds = new Set(
					allQuestionsVariants
						.map((qv) => qv.variantId)
						.filter((id): id is string => id !== null),
				);

				// Удаляем только те variants, которые больше нигде не используются
				unusedVariantIds = variantIds.filter((id) => !usedVariantIds.has(id));
			}

			// Удаляем старые questionsVariants
			if (existingQuestionsVariants.length > 0) {
				await tx
					.delete(questionsVariants)
					.where(eq(questionsVariants.questionId, questionId));
			}

			// Удаляем старые variants (если они больше нигде не используются)
			if (unusedVariantIds.length > 0) {
				await tx.delete(variants).where(inArray(variants.id, unusedVariantIds));
			}

			// Создаем новые variants и questionsVariants
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
					questionId: questionId,
					variantId: variant.id,
					isRight: variantData.isRight,
				});
			}

			return {
				success: true,
			};
		});
	}
}
