import { beforeEach, describe, expect, it, mock } from "bun:test";

// Session service is mocked at the instance level (not module level) to avoid
// poisoning the session test's module registry with an empty class.
const mockGetActiveSessionOrThrow = mock();
const mockAddSubmitsToSessionInTransaction = mock();

const mockFindFirstQuestion = mock();
const mockFindFirstChosenVariant = mock();
const mockSelect = mock();
const mockInsert = mock();
const mockUpdate = mock();

const mockDb = {
	query: {
		questions: {
			findFirst: mockFindFirstQuestion,
		},
		chosenVariants: {
			findFirst: mockFindFirstChosenVariant,
		},
		questionsVariants: {
			findMany: mock(),
		},
	},
	select: mockSelect,
	insert: mockInsert,
	update: mockUpdate,
	transaction: mock(),
};

mock.module("../../../db", () => ({
	db: mockDb,
}));

mock.module("drizzle-orm", () => ({
	eq: mock((...args: unknown[]) => ({ eq: args })),
	and: mock((...args: unknown[]) => ({ and: args })),
	inArray: mock((...args: unknown[]) => ({ inArray: args })),
}));

import { QuestionService } from "../service";

const makeSession = () => ({ id: "session-1", userId: "user-1", quizId: "quiz-1" });

const makeVariant = (id: string, isRight: boolean, overrides = {}) => ({
	id,
	text: `Variant ${id}`,
	leftMatching: null,
	rightMatching: null,
	explainRight: "Correct!",
	explainWrong: "Wrong!",
	isRight,
	questionId: "q1",
	variantId: id,
	questionsVariantsId: `qv-${id}`,
	...overrides,
});

describe("QuestionService", () => {
	let questionService: QuestionService;

	beforeEach(() => {
		questionService = new QuestionService();
		// Override the session service dependency at the instance level so we can
		// control it per-test without polluting the global module registry.
		(questionService as any).sessionService = {
			getActiveSessionOrThrow: mockGetActiveSessionOrThrow,
			addSubmitsToSessionInTransaction: mockAddSubmitsToSessionInTransaction,
		};
		mockFindFirstQuestion.mockReset();
		mockFindFirstChosenVariant.mockReset();
		mockSelect.mockReset();
		mockInsert.mockReset();
		mockUpdate.mockReset();
		mockDb.transaction.mockReset();
		mockGetActiveSessionOrThrow.mockReset();
		mockAddSubmitsToSessionInTransaction.mockReset();
	});

	// Helper: mock no duplicate submit (empty result)
	const mockNoDuplicate = () => {
		mockSelect.mockReturnValueOnce({
			from: mock().mockReturnValue({
				innerJoin: mock().mockReturnValue({
					where: mock().mockReturnValue({
						limit: mock().mockResolvedValue([]),
					}),
				}),
			}),
		});
	};

	// Helper: mock duplicate submit exists
	const mockDuplicateExists = () => {
		mockSelect.mockReturnValueOnce({
			from: mock().mockReturnValue({
				innerJoin: mock().mockReturnValue({
					where: mock().mockReturnValue({
						limit: mock().mockResolvedValue([{ id: "dup" }]),
					}),
				}),
			}),
		});
	};

	// Helper: mock getQuestionVariants
	const mockVariantsSelect = (variants: any[]) => {
		mockSelect.mockReturnValueOnce({
			from: mock().mockReturnValue({
				innerJoin: mock().mockReturnValue({
					where: mock().mockResolvedValue(variants),
				}),
			}),
		});
	};

	// ── getQuestion ──────────────────────────────────────────────────────────────

	describe("getQuestion", () => {
		it("should return question when found", async () => {
			const question = { id: "q1", type: "multichoice", text: "Q?" };
			mockFindFirstQuestion.mockResolvedValue(question);

			const result = await questionService.getQuestion("q1");

			expect(result).toEqual(question);
		});

		it("should throw 404 when question not found", async () => {
			mockFindFirstQuestion.mockResolvedValue(null);

			try {
				await questionService.getQuestion("missing");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
			}
		});
	});

	// ── submitQuestionVariants ───────────────────────────────────────────────────

	describe("submitQuestionVariants", () => {
		it("should throw 400 for unsupported question type", async () => {
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "matching" });
			mockVariantsSelect([]);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());

			try {
				await questionService.submitQuestionVariants("u1", "quiz-1", "q1", ["v1"]);
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(400);
			}
		});

		it("should throw 400 for truefalse with more than one variant", async () => {
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "truefalse" });
			mockVariantsSelect([makeVariant("v1", true), makeVariant("v2", false)]);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());

			try {
				await questionService.submitQuestionVariants("u1", "quiz-1", "q1", ["v1", "v2"]);
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(400);
			}
		});

		it("should throw 400 for multichoice with empty variantIds", async () => {
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "multichoice", multiAnswer: true });
			mockVariantsSelect([makeVariant("v1", true)]);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());

			try {
				await questionService.submitQuestionVariants("u1", "quiz-1", "q1", []);
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(400);
			}
		});

		it("should throw 400 for multichoice single-answer with multiple variants", async () => {
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "multichoice", multiAnswer: false });
			mockVariantsSelect([makeVariant("v1", true), makeVariant("v2", false)]);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());

			try {
				await questionService.submitQuestionVariants("u1", "quiz-1", "q1", ["v1", "v2"]);
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(400);
			}
		});

		it("should throw 400 for invalid variant IDs", async () => {
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "multichoice", multiAnswer: true });
			mockVariantsSelect([makeVariant("v1", true)]);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());

			try {
				await questionService.submitQuestionVariants("u1", "quiz-1", "q1", ["invalid-id"]);
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(400);
			}
		});

		it("should throw 409 on duplicate submit", async () => {
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "multichoice", multiAnswer: true });
			mockVariantsSelect([makeVariant("v1", true)]);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());
			mockDuplicateExists();

			try {
				await questionService.submitQuestionVariants("u1", "quiz-1", "q1", ["v1"]);
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(409);
			}
		});

		it("should return isRight=true when all correct variants selected", async () => {
			const v1 = makeVariant("v1", true);
			const v2 = makeVariant("v2", false);
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "multichoice", multiAnswer: true });
			mockVariantsSelect([v1, v2]);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());
			mockNoDuplicate();

			const insertedRow = { id: "cv1", quizId: "quiz-1", questionId: "q1", isRight: true };
			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					insert: mock().mockReturnValue({
						values: mock().mockReturnValue({
							returning: mock().mockResolvedValue([insertedRow]),
						}),
					}),
				};
				await mockAddSubmitsToSessionInTransaction(tx, "session-1", ["cv1"]);
				return await fn(tx);
			});

			const result = await questionService.submitQuestionVariants("u1", "quiz-1", "q1", ["v1"]);

			expect(result.isRight).toBe(true);
		});

		it("should return isRight=false when wrong variant selected", async () => {
			const v1 = makeVariant("v1", true);
			const v2 = makeVariant("v2", false);
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "multichoice", multiAnswer: true });
			mockVariantsSelect([v1, v2]);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());
			mockNoDuplicate();

			const insertedRow = { id: "cv1", quizId: "quiz-1", questionId: "q1", isRight: false };
			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					insert: mock().mockReturnValue({
						values: mock().mockReturnValue({
							returning: mock().mockResolvedValue([insertedRow]),
						}),
					}),
				};
				await mockAddSubmitsToSessionInTransaction(tx, "session-1", ["cv1"]);
				return await fn(tx);
			});

			const result = await questionService.submitQuestionVariants("u1", "quiz-1", "q1", ["v2"]);

			expect(result.isRight).toBe(false);
		});
	});

	// ── submitQuestionText ───────────────────────────────────────────────────────

	describe("submitQuestionText", () => {
		it("should throw 400 for wrong question type", async () => {
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "multichoice" });
			mockVariantsSelect([]);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());

			try {
				await questionService.submitQuestionText("u1", "quiz-1", "q1", "answer");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(400);
			}
		});

		it("should throw 400 for empty answer", async () => {
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "essay" });
			mockVariantsSelect([]);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());

			try {
				await questionService.submitQuestionText("u1", "quiz-1", "q1", "   ");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(400);
			}
		});

		it("should throw 400 for non-numeric answer on numerical question", async () => {
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "numerical" });
			mockVariantsSelect([makeVariant("v1", true, { text: "42" })]);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());

			try {
				await questionService.submitQuestionText("u1", "quiz-1", "q1", "not-a-number");
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(400);
			}
		});

		it("should grade numerical answer as correct within tolerance", async () => {
			const correctVariant = makeVariant("v1", true, { text: "42" });
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "numerical" });
			mockVariantsSelect([correctVariant]);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());
			mockNoDuplicate();

			const submitted = { id: "cv1", answer: "42", isRight: true };
			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					insert: mock().mockReturnValue({
						values: mock().mockReturnValue({
							returning: mock().mockResolvedValue([submitted]),
						}),
					}),
				};
				return await fn(tx);
			});

			const result = await questionService.submitQuestionText("u1", "quiz-1", "q1", "42");

			expect(result.isRight).toBe(true);
		});

		it("should grade numerical answer as wrong when outside tolerance", async () => {
			const correctVariant = makeVariant("v1", true, { text: "42" });
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "numerical" });
			mockVariantsSelect([correctVariant]);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());
			mockNoDuplicate();

			const submitted = { id: "cv1", answer: "99", isRight: false };
			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					insert: mock().mockReturnValue({
						values: mock().mockReturnValue({
							returning: mock().mockResolvedValue([submitted]),
						}),
					}),
				};
				return await fn(tx);
			});

			const result = await questionService.submitQuestionText("u1", "quiz-1", "q1", "99");

			expect(result.isRight).toBe(false);
		});

		it("should return isRight=null for essay question", async () => {
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "essay" });
			mockVariantsSelect([]);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());
			mockNoDuplicate();

			const submitted = { id: "cv1", answer: "my essay", isRight: null };
			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					insert: mock().mockReturnValue({
						values: mock().mockReturnValue({
							returning: mock().mockResolvedValue([submitted]),
						}),
					}),
				};
				return await fn(tx);
			});

			const result = await questionService.submitQuestionText("u1", "quiz-1", "q1", "my essay");

			expect(result.isRight).toBeNull();
		});
	});

	// ── submitQuestionPairs ──────────────────────────────────────────────────────

	describe("submitQuestionPairs", () => {
		it("should throw 400 for non-matching question type", async () => {
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "essay" });
			mockVariantsSelect([]);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());

			try {
				await questionService.submitQuestionPairs("u1", "quiz-1", "q1", []);
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(400);
			}
		});

		it("should return isRight=true when all pairs match correctly", async () => {
			const variants = [
				makeVariant("v1", true, { leftMatching: "A", rightMatching: "1" }),
				makeVariant("v2", true, { leftMatching: "B", rightMatching: "2" }),
			];
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "matching" });
			mockVariantsSelect(variants);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());
			mockNoDuplicate();

			const insertedRows = [
				{ id: "cv1", answerLeft: "A", answerRight: "1", isRight: true },
				{ id: "cv2", answerLeft: "B", answerRight: "2", isRight: true },
			];
			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					insert: mock().mockReturnValue({
						values: mock().mockReturnValue({
							returning: mock().mockResolvedValue(insertedRows),
						}),
					}),
				};
				return await fn(tx);
			});

			const result = await questionService.submitQuestionPairs("u1", "quiz-1", "q1", [
				{ leftMatching: "A", rightMatching: "1" },
				{ leftMatching: "B", rightMatching: "2" },
			]);

			expect(result.isRight).toBe(true);
		});

		it("should return isRight=false when a pair is wrong", async () => {
			const variants = [
				makeVariant("v1", true, { leftMatching: "A", rightMatching: "1" }),
			];
			mockFindFirstQuestion.mockResolvedValue({ id: "q1", type: "matching" });
			mockVariantsSelect(variants);
			mockGetActiveSessionOrThrow.mockResolvedValue(makeSession());
			mockNoDuplicate();

			const insertedRows = [
				{ id: "cv1", answerLeft: "A", answerRight: "WRONG", isRight: false },
			];
			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					insert: mock().mockReturnValue({
						values: mock().mockReturnValue({
							returning: mock().mockResolvedValue(insertedRows),
						}),
					}),
				};
				return await fn(tx);
			});

			const result = await questionService.submitQuestionPairs("u1", "quiz-1", "q1", [
				{ leftMatching: "A", rightMatching: "WRONG" },
			]);

			expect(result.isRight).toBe(false);
		});
	});

	// ── regradeSubmission ────────────────────────────────────────────────────────

	describe("regradeSubmission", () => {
		it("should update submission grade and return updated", async () => {
			const existing = { id: "cv1", isRight: false };
			const updated = { id: "cv1", isRight: true, explanation: "Actually correct" };
			mockFindFirstChosenVariant.mockResolvedValue(existing);
			mockUpdate.mockReturnValue({
				set: mock().mockReturnValue({
					where: mock().mockReturnValue({
						returning: mock().mockResolvedValue([updated]),
					}),
				}),
			});

			const result = await questionService.regradeSubmission("cv1", true, "Actually correct");

			expect(result).toEqual(updated);
		});

		it("should throw 404 when submission not found", async () => {
			mockFindFirstChosenVariant.mockResolvedValue(null);

			try {
				await questionService.regradeSubmission("missing", true);
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
			}
		});
	});

	// ── updateQuestion ───────────────────────────────────────────────────────────

	describe("updateQuestion", () => {
		it("should update question fields and return updated", async () => {
			const question = { id: "q1", text: "Old text", type: "essay" };
			const updated = { ...question, text: "New text" };
			mockFindFirstQuestion.mockResolvedValue(question);
			mockUpdate.mockReturnValue({
				set: mock().mockReturnValue({
					where: mock().mockReturnValue({
						returning: mock().mockResolvedValue([updated]),
					}),
				}),
			});

			const result = await questionService.updateQuestion("q1", { text: "New text" });

			expect(result).toEqual(updated);
		});

		it("should throw 404 when question not found", async () => {
			mockFindFirstQuestion.mockResolvedValue(null);

			try {
				await questionService.updateQuestion("missing", { text: "X" });
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
			}
		});
	});

	// ── updateQuestionVariants ───────────────────────────────────────────────────

	describe("updateQuestionVariants", () => {
		it("should throw 404 when question not found inside transaction", async () => {
			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					query: {
						questions: {
							findFirst: mock().mockResolvedValue(null),
						},
					},
				};
				return await fn(tx);
			});

			try {
				await questionService.updateQuestionVariants("missing", []);
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(404);
			}
		});

		it("should throw 400 for numerical question with wrong variant count", async () => {
			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					query: {
						questions: {
							findFirst: mock().mockResolvedValue({ id: "q1", type: "numerical" }),
						},
					},
				};
				return await fn(tx);
			});

			try {
				await questionService.updateQuestionVariants("q1", [
					{ text: "42", leftMatching: null, rightMatching: null, explainRight: "", explainWrong: "", isRight: false },
				]);
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.code).toBe(400);
			}
		});

		it("should succeed and return { success: true } for valid update", async () => {
			const txWhere = mock().mockResolvedValue(undefined);
			const txDelete = mock().mockReturnValue({ where: txWhere });
			const txInsert = mock().mockReturnValue({
				values: mock().mockReturnValue({
					returning: mock().mockResolvedValue([{ id: "v-new" }]),
				}),
			});

			mockDb.transaction.mockImplementation(async (fn: (tx: any) => any) => {
				const tx = {
					query: {
						questions: {
							findFirst: mock().mockResolvedValue({ id: "q1", type: "multichoice" }),
						},
						questionsVariants: {
							findMany: mock().mockResolvedValue([]),
						},
					},
					delete: txDelete,
					insert: txInsert,
					select: mock().mockReturnValue({
						from: mock().mockReturnValue({
							where: mock().mockResolvedValue([]),
						}),
					}),
				};
				return await fn(tx);
			});

			const result = await questionService.updateQuestionVariants("q1", [
				{ text: "Answer", leftMatching: null, rightMatching: null, explainRight: "Good", explainWrong: "Bad", isRight: true },
			]);

			expect(result).toEqual({ success: true });
		});
	});
});
