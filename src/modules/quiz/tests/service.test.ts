import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockFindFirstQuiz = mock();
const mockFindManyQuizesQuestions = mock();
const mockFindManyQuizSession = mock();
const mockFindFirstQuizSession = mock();
const mockFindManySessionSubmits = mock();
const mockInsert = mock();
const mockUpdate = mock();
const mockSelect = mock();
const mockDelete = mock();

const mockDb = {
	query: {
		quizes: {
			findFirst: mockFindFirstQuiz,
			findMany: mock(),
		},
		quizesQuestions: {
			findMany: mockFindManyQuizesQuestions,
		},
		quizSession: {
			findFirst: mockFindFirstQuizSession,
			findMany: mockFindManyQuizSession,
		},
		sessionSubmits: {
			findMany: mockFindManySessionSubmits,
		},
	},
	insert: mockInsert,
	update: mockUpdate,
	select: mockSelect,
	delete: mockDelete,
	transaction: mock(),
};

mock.module("../../../db", () => ({
	db: mockDb,
}));

mock.module("drizzle-orm", () => ({
	eq: mock((...args: unknown[]) => ({ eq: args })),
	and: mock((...args: unknown[]) => ({ and: args })),
	isNull: mock((f: unknown) => ({ isNull: f })),
	inArray: mock((...args: unknown[]) => ({ inArray: args })),
	count: mock(() => ({ count: true })),
}));

import { QuizService } from "../service";

describe("QuizService", () => {
	let quizService: QuizService;

	beforeEach(() => {
		quizService = new QuizService();
		mockFindFirstQuiz.mockReset();
		mockFindManyQuizesQuestions.mockReset();
		mockFindManyQuizSession.mockReset();
		mockFindFirstQuizSession.mockReset();
		mockFindManySessionSubmits.mockReset();
		mockInsert.mockReset();
		mockUpdate.mockReset();
		mockSelect.mockReset();
		mockDelete.mockReset();
		mockDb.transaction.mockReset();
		mockDb.query.quizes.findMany.mockReset();
	});

	// ── getQuizById ──────────────────────────────────────────────────────────────

	describe("getQuizById", () => {
		it("should return quiz with questionCount", async () => {
			mockFindFirstQuiz.mockResolvedValue({
				id: "quiz-1",
				name: "Test Quiz",
				quizesQuestions: [{}, {}, {}],
			});

			const result = await quizService.getQuizById("quiz-1");

			expect(result.id).toBe("quiz-1");
			expect(result.questionCount).toBe(3);
			expect(result.quizesQuestions).toBeUndefined();
		});

		it("should throw 404 when quiz not found", async () => {
			mockFindFirstQuiz.mockResolvedValue(null);

			try {
				await quizService.getQuizById("missing");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
				expect(error.response).toBe("Not Found");
			}
		});
	});

	// ── updateQuiz ───────────────────────────────────────────────────────────────

	describe("updateQuiz", () => {
		it("should update quiz fields and return updated", async () => {
			const quiz = { id: "quiz-1", name: "Old Name" };
			const updated = { id: "quiz-1", name: "New Name" };
			mockFindFirstQuiz.mockResolvedValue(quiz);
			mockUpdate.mockReturnValue({
				set: mock().mockReturnValue({
					where: mock().mockReturnValue({
						returning: mock().mockResolvedValue([updated]),
					}),
				}),
			});

			const result = await quizService.updateQuiz("quiz-1", { name: "New Name" });

			expect(result).toEqual(updated);
		});

		it("should throw 404 when quiz not found", async () => {
			mockFindFirstQuiz.mockResolvedValue(null);

			try {
				await quizService.updateQuiz("missing", { name: "X" });
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
			}
		});
	});

	// ── getQuestionsByQuizId ─────────────────────────────────────────────────────

	describe("getQuestionsByQuizId", () => {
		it("should return array of questions mapped from quizesQuestions", async () => {
			const q1 = { id: "q1", text: "Q1", type: "multichoice" };
			const q2 = { id: "q2", text: "Q2", type: "essay" };
			mockFindManyQuizesQuestions.mockResolvedValue([
				{ question: q1 },
				{ question: q2 },
			]);

			const result = await quizService.getQuestionsByQuizId("quiz-1");

			expect(result).toEqual([q1, q2]);
		});

		it("should return empty array when no questions", async () => {
			mockFindManyQuizesQuestions.mockResolvedValue([]);

			const result = await quizService.getQuestionsByQuizId("quiz-1");

			expect(result).toEqual([]);
		});
	});

	// ── getQuestionsWithVariantsByQuizId ─────────────────────────────────────────

	describe("getQuestionsWithVariantsByQuizId", () => {
		it("should map variants from nested questionsVariants", async () => {
			mockFindManyQuizesQuestions.mockResolvedValue([
				{
					question: {
						id: "q1",
						text: "Question",
						type: "multichoice",
						multiAnswer: false,
						questionsVariants: [
							{
								id: "qv1",
								questionId: "q1",
								variantId: "v1",
								isRight: true,
								variant: {
									id: "v1",
									text: "Answer A",
									leftMatching: null,
									rightMatching: null,
									explainRight: "Correct",
									explainWrong: "Wrong",
								},
							},
						],
					},
				},
			]);

			const result = await quizService.getQuestionsWithVariantsByQuizId("quiz-1");

			expect(result).toHaveLength(1);
			expect(result[0].variants).toHaveLength(1);
			expect(result[0].variants[0].text).toBe("Answer A");
			expect(result[0].variants[0].isRight).toBe(true);
			expect(result[0].variants[0].questionsVariantsId).toBe("qv1");
		});

		it("should handle questions with no variants", async () => {
			mockFindManyQuizesQuestions.mockResolvedValue([
				{
					question: {
						id: "q1",
						text: "Essay",
						type: "essay",
						multiAnswer: null,
						questionsVariants: [],
					},
				},
			]);

			const result = await quizService.getQuestionsWithVariantsByQuizId("quiz-1");

			expect(result[0].variants).toEqual([]);
		});
	});

	// ── getQuizesByThemeId ───────────────────────────────────────────────────────

	describe("getQuizesByThemeId", () => {
		it("should return quizzes with questionCount", async () => {
			mockDb.query.quizes.findMany.mockResolvedValue([
				{
					id: "quiz-1",
					type: "classic",
					name: "Quiz 1",
					description: null,
					themeId: 5,
					createdAt: new Date("2025-01-01"),
					quizesQuestions: [{}, {}],
				},
			]);

			const result = await quizService.getQuizesByThemeId(5);

			expect(result).toHaveLength(1);
			expect(result[0].questionCount).toBe(2);
			expect(result[0].id).toBe("quiz-1");
		});
	});

	// ── deleteQuiz ───────────────────────────────────────────────────────────────

	describe("deleteQuiz", () => {
		it("should delete quiz and related data in a transaction", async () => {
			const deleteMock = mock().mockResolvedValue(undefined);
			const whereMock = mock().mockReturnValue(undefined);

			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					query: {
						quizSession: {
							findMany: mock().mockResolvedValue([{ id: "s1" }, { id: "s2" }]),
						},
					},
					delete: mock().mockReturnValue({ where: whereMock }),
				};
				return await fn(tx);
			});

			await quizService.deleteQuiz("quiz-1");

			expect(mockDb.transaction).toHaveBeenCalledTimes(1);
		});

		it("should handle quiz with no sessions", async () => {
			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					query: {
						quizSession: {
							findMany: mock().mockResolvedValue([]),
						},
					},
					delete: mock().mockReturnValue({ where: mock().mockResolvedValue(undefined) }),
				};
				return await fn(tx);
			});

			await quizService.deleteQuiz("quiz-1");

			expect(mockDb.transaction).toHaveBeenCalledTimes(1);
		});
	});

	// ── getQuizUserSessions ──────────────────────────────────────────────────────

	describe("getQuizUserSessions", () => {
		it("should aggregate percentSolved and percentRight correctly", async () => {
			mockFindManyQuizesQuestions.mockResolvedValue([{}, {}, {}, {}]); // 4 questions

			mockSelect.mockReturnValue({
				from: mock().mockReturnValue({
					innerJoin: mock().mockReturnValue({
						leftJoin: mock().mockReturnValue({
							leftJoin: mock().mockReturnValue({
								where: mock().mockResolvedValue([
									{
										userId: "user-1",
										fullName: "Alice",
										email: "alice@example.com",
										sessionId: "s1",
										timeStart: new Date("2025-01-01"),
										timeEnd: new Date("2025-01-01"),
										submitId: "sub-1",
										isRight: true,
									},
									{
										userId: "user-1",
										fullName: "Alice",
										email: "alice@example.com",
										sessionId: "s1",
										timeStart: new Date("2025-01-01"),
										timeEnd: new Date("2025-01-01"),
										submitId: "sub-2",
										isRight: false,
									},
								]),
							}),
						}),
					}),
				}),
			});

			const result = await quizService.getQuizUserSessions("quiz-1");

			expect(result).toHaveLength(1);
			expect(result[0].userId).toBe("user-1");
			expect(result[0].sessions).toHaveLength(1);
			// 2 submits out of 4 questions = 50%
			expect(result[0].sessions[0].percentSolved).toBe(50);
			// 1 right out of 2 submits = 50%
			expect(result[0].sessions[0].percentRight).toBe(50);
		});

		it("should set percentSolved=0 when no submits in session", async () => {
			mockFindManyQuizesQuestions.mockResolvedValue([{}, {}]); // 2 questions

			mockSelect.mockReturnValue({
				from: mock().mockReturnValue({
					innerJoin: mock().mockReturnValue({
						leftJoin: mock().mockReturnValue({
							leftJoin: mock().mockReturnValue({
								where: mock().mockResolvedValue([
									{
										userId: "user-1",
										fullName: "Bob",
										email: "bob@example.com",
										sessionId: "s1",
										timeStart: new Date(),
										timeEnd: null,
										submitId: null,
										isRight: null,
									},
								]),
							}),
						}),
					}),
				}),
			});

			const result = await quizService.getQuizUserSessions("quiz-1");

			expect(result[0].sessions[0].percentSolved).toBe(0);
			expect(result[0].sessions[0].percentRight).toBe(0);
		});

		it("should group sessions by user", async () => {
			mockFindManyQuizesQuestions.mockResolvedValue([{}]);

			mockSelect.mockReturnValue({
				from: mock().mockReturnValue({
					innerJoin: mock().mockReturnValue({
						leftJoin: mock().mockReturnValue({
							leftJoin: mock().mockReturnValue({
								where: mock().mockResolvedValue([
									{
										userId: "user-1",
										fullName: "Alice",
										email: "alice@example.com",
										sessionId: "s1",
										timeStart: new Date(),
										timeEnd: null,
										submitId: null,
										isRight: null,
									},
									{
										userId: "user-2",
										fullName: "Bob",
										email: "bob@example.com",
										sessionId: "s2",
										timeStart: new Date(),
										timeEnd: null,
										submitId: null,
										isRight: null,
									},
								]),
							}),
						}),
					}),
				}),
			});

			const result = await quizService.getQuizUserSessions("quiz-1");

			expect(result).toHaveLength(2);
		});
	});
});
